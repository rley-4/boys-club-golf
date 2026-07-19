-- =============================================================================
-- Fix: v_low_net_team_payout (and v_low_net_solo_payout) re-deriving the
-- expensive team-hole-scoring chain many times over
-- =============================================================================
-- Same class of bug as migrations 32-34, found via EXPLAIN ANALYZE this
-- time rather than by inspection: v_low_net_team_payout referenced
-- v_low_net_team_winners TWICE — once directly, once again as a correlated
-- subquery evaluated per round. v_low_net_team_winners itself sits on top
-- of the expensive v_team_hole_best_full -> v_hole_net_scores chain, so
-- each correlated re-invocation re-derived that whole chain from scratch.
-- Confirmed via EXPLAIN ANALYZE: this one view accounted for 3.8s of a
-- 4.6s total query, with a nested loop re-running the expensive branch
-- 230 times over. v_low_net_solo_payout has the identical structural
-- pattern (cheaper in practice since Solo's underlying chain is simpler,
-- but fixed here too rather than left as a latent risk).
--
-- Fix: compute the winners set once via a CTE (using a window function for
-- the tied-count instead of a second correlated query), then reuse that
-- single CTE for everything downstream.
-- =============================================================================

create or replace view v_low_net_solo_payout as
with winners as (
  select w.player_id, w.round_id, count(*) over (partition by w.round_id) as tied_count
  from v_low_net_solo_winners w
)
select
  w.player_id,
  r.event_id,
  w.round_id,
  round(
    (gs.low_net_solo_buy_in * (select count(distinct s.player_id) from scores s where s.round_id = w.round_id)) / w.tied_count,
    2
  ) as amount
from winners w
join rounds r on r.id = w.round_id and r.applies_low_net = true
join game_settings gs on gs.event_id = r.event_id;

create or replace view v_low_net_team_payout as
with winners as (
  select w.team_id, w.round_id, count(*) over (partition by w.round_id) as winning_teams
  from v_low_net_team_winners w
),
pot as (
  select
    w.round_id,
    w.winning_teams,
    gs.low_net_team_buy_in * (select count(distinct s.player_id) from scores s where s.round_id = w.round_id) as total_pot
  from (select distinct round_id, winning_teams from winners) w
  join rounds r on r.id = w.round_id and r.applies_low_net = true
  join game_settings gs on gs.event_id = r.event_id
)
select
  wp.player_id,
  r.event_id,
  w.round_id,
  round(pot.total_pot / (pot.winning_teams * 2), 2) as amount
from winners w
join teams t on t.id = w.team_id
join pot on pot.round_id = w.round_id
join rounds r on r.id = w.round_id
cross join lateral (values (t.player_a_id), (t.player_b_id)) as wp(player_id);
