-- =============================================================================
-- Fix: v_competition_payouts still timing out after migration 32
-- =============================================================================
-- migration 32 fixed each rank view's INTERNAL redundancy, but
-- v_competition_payouts (winnings full outer join buy-ins) has both halves
-- independently referencing v_solo_year_rank and v_team_year_rank —
-- v_competition_winnings pulls them in via v_solo/team_competition_payout,
-- v_competition_buyins pulls them in again separately. So even efficient,
-- each rank view was still being computed twice over within one query.
--
-- This consolidates the whole thing into one view: solo_ranks/team_ranks
-- CTEs compute v_solo_year_rank/v_team_year_rank exactly once each, and
-- both the winnings and buy-ins branches reuse those same CTEs instead of
-- re-deriving them.
--
-- v_competition_winnings and v_competition_buyins are left in place as
-- standalone views (still correct, just not what v_competition_payouts
-- uses anymore) in case anything else ever wants them directly.
-- =============================================================================

create or replace view v_competition_payouts as
with solo_ranks as (
  select event_id, player_id, year_rank, count(*) over (partition by event_id, year_rank) as tied_count
  from v_solo_year_rank
),
team_ranks as (
  select event_id, team_id, year_rank, count(*) over (partition by event_id, year_rank) as tied_count
  from v_team_year_rank
),
solo_winnings as (
  select
    r.player_id, r.event_id,
    round(
      coalesce(
        (select sum(cpp.amount) from competition_payout_places cpp
         where cpp.event_id = r.event_id and cpp.competition = 'solo'
           and cpp.place >= r.year_rank and cpp.place < r.year_rank + r.tied_count),
        0
      ) / r.tied_count,
      2
    ) as amount
  from solo_ranks r
),
team_winnings as (
  select
    wp.player_id, r.event_id,
    round(
      coalesce(
        (select sum(cpp.amount) from competition_payout_places cpp
         where cpp.event_id = r.event_id and cpp.competition = 'team'
           and cpp.place >= r.year_rank and cpp.place < r.year_rank + r.tied_count),
        0
      ) / (2 * r.tied_count),
      2
    ) as amount
  from team_ranks r
  join teams t on t.id = r.team_id
  cross join lateral (values (t.player_a_id), (t.player_b_id)) as wp(player_id)
),
all_winnings as (
  select player_id, event_id, amount from solo_winnings where amount > 0
  union all
  select player_id, event_id, amount from team_winnings where amount > 0
  union all
  select player_id, event_id, amount from v_carroll_cup_competition_payout
),
solo_buyins as (
  select sr.player_id, sr.event_id, cs.solo_buy_in as amount
  from solo_ranks sr
  join competition_settings cs on cs.event_id = sr.event_id
),
team_buyins as (
  select wp.player_id, tr.event_id, cs.team_buy_in as amount
  from team_ranks tr
  join teams t on t.id = tr.team_id
  join competition_settings cs on cs.event_id = tr.event_id
  cross join lateral (values (t.player_a_id), (t.player_b_id)) as wp(player_id)
),
carroll_buyins as (
  select cr.player_id, cr.event_id, cs.carroll_cup_buy_in as amount
  from carroll_cup_rosters cr
  join competition_settings cs on cs.event_id = cr.event_id
),
all_buyins as (
  select player_id, event_id, amount from solo_buyins
  union all
  select player_id, event_id, amount from team_buyins
  union all
  select player_id, event_id, amount from carroll_buyins
),
winnings_agg as (
  select player_id, event_id, sum(amount) as total_winnings from all_winnings group by player_id, event_id
),
buyins_agg as (
  select player_id, event_id, sum(amount) as total_buy_ins from all_buyins group by player_id, event_id
)
select
  coalesce(w.player_id, b.player_id) as player_id,
  coalesce(w.event_id, b.event_id) as event_id,
  coalesce(w.total_winnings, 0) as total_winnings,
  coalesce(b.total_buy_ins, 0) as total_buy_ins,
  coalesce(w.total_winnings, 0) - coalesce(b.total_buy_ins, 0) as net
from winnings_agg w
full outer join buyins_agg b on b.player_id = w.player_id and b.event_id = w.event_id;
