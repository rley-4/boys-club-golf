-- =============================================================================
-- Competition payout tiebreakers — Solo (5 levels) and Team (head-to-head +
-- season net-to-par + 3 levels of best-round)
-- =============================================================================
-- v_solo_year_rank and v_team_year_rank are extended in place (existing
-- columns keep their exact position — Postgres won't allow reordering an
-- existing view's columns, only appending) so anything already reading
-- year_rank from them (Record Book, Leaderboard) is unaffected — ranks
-- only change for players/teams whose ties actually get resolved by one
-- of the new, deeper tiebreak levels.
--
-- A genuine tie that survives every level combines the consecutive places
-- it spans and splits that combined amount evenly — e.g. two players dead
-- level for 1st split (place 1 + place 2) two ways, per the rule given.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SOLO — each player's 1st, 2nd, 3rd best (lowest) round net-to-par, from
-- their actual counted Solo rounds.
-- -----------------------------------------------------------------------------
create or replace view v_solo_round_ranks as
select
  event_id, player_id, round_id, net_to_par_total,
  row_number() over (partition by event_id, player_id order by net_to_par_total asc) as round_rank
from v_round_net_totals;

create or replace view v_solo_best_rounds as
select
  event_id,
  player_id,
  max(case when round_rank = 1 then net_to_par_total end) as best_round_1,
  max(case when round_rank = 2 then net_to_par_total end) as best_round_2,
  max(case when round_rank = 3 then net_to_par_total end) as best_round_3
from v_solo_round_ranks
group by event_id, player_id;

-- 1st: total_net_to_par. 2nd: total_net_to_par_all_rounds. 3rd/4th/5th:
-- best, 2nd-best, 3rd-best individual round. Ties beyond that are genuine.
create or replace view v_solo_year_rank as
select
  s.event_id,
  s.player_id,
  s.total_net_to_par,
  rank() over (
    partition by s.event_id
    order by s.total_net_to_par asc, s.total_net_to_par_all_rounds asc,
             br.best_round_1 asc nulls last, br.best_round_2 asc nulls last, br.best_round_3 asc nulls last
  ) as year_rank,
  s.total_net_to_par_all_rounds,
  br.best_round_1,
  br.best_round_2,
  br.best_round_3
from v_solo_standings s
left join v_solo_best_rounds br on br.event_id = s.event_id and br.player_id = s.player_id;

-- Which level actually decided each player's place, for the UI.
create or replace view v_solo_tiebreak_detail as
select
  vsr.event_id,
  vsr.player_id,
  vsr.year_rank,
  count(*) over (partition by vsr.event_id, vsr.year_rank) as tied_count,
  case
    when count(*) over (partition by vsr.event_id, vsr.total_net_to_par) = 1 then 'Outright'
    when count(*) over (partition by vsr.event_id, vsr.total_net_to_par, vsr.total_net_to_par_all_rounds) = 1
      then 'Tiebreak: full-round total'
    when count(*) over (partition by vsr.event_id, vsr.total_net_to_par, vsr.total_net_to_par_all_rounds, vsr.best_round_1) = 1
      then 'Tiebreak: best round'
    when count(*) over (
      partition by vsr.event_id, vsr.total_net_to_par, vsr.total_net_to_par_all_rounds, vsr.best_round_1, vsr.best_round_2
    ) = 1 then 'Tiebreak: 2nd-best round'
    when count(*) over (
      partition by vsr.event_id, vsr.total_net_to_par, vsr.total_net_to_par_all_rounds, vsr.best_round_1, vsr.best_round_2, vsr.best_round_3
    ) = 1 then 'Tiebreak: 3rd-best round'
    else 'True tie'
  end as decided_by
from v_solo_year_rank vsr;

-- -----------------------------------------------------------------------------
-- TEAM — season-long net-to-par (leverages the same best-ball data Low Net
-- Team already uses daily, summed across the whole season instead of one
-- round), plus 1st/2nd/3rd best individual round, plus head-to-head.
-- -----------------------------------------------------------------------------

-- team_best_net already existed; par is the same for every team on a given
-- hole, so min() here is just a safe way to pull it through — appended,
-- doesn't disturb v_low_net_team which selects specific columns, not *.
create or replace view v_team_hole_best_full as
select tp.team_id, hns.round_id, hns.hole_number, min(hns.net_strokes) as team_best_net, min(hns.par) as par
from v_team_players tp
join v_hole_net_scores hns on hns.player_id = tp.player_id
group by tp.team_id, hns.round_id, hns.hole_number;

create or replace view v_team_round_net_to_par as
select
  thbf.team_id,
  thbf.round_id,
  r.event_id,
  sum(thbf.team_best_net - thbf.par) as net_to_par_total
from v_team_hole_best_full thbf
join rounds r on r.id = thbf.round_id and r.counts_for_team = true
group by thbf.team_id, thbf.round_id, r.event_id
having count(*) = 18;

create or replace view v_team_season_net_to_par as
select team_id, event_id, sum(net_to_par_total) as season_net_to_par
from v_team_round_net_to_par
group by team_id, event_id;

create or replace view v_team_round_ranks as
select
  event_id, team_id, round_id, net_to_par_total,
  row_number() over (partition by event_id, team_id order by net_to_par_total asc) as round_rank
from v_team_round_net_to_par;

create or replace view v_team_best_rounds as
select
  event_id,
  team_id,
  max(case when round_rank = 1 then net_to_par_total end) as best_round_1,
  max(case when round_rank = 2 then net_to_par_total end) as best_round_2,
  max(case when round_rank = 3 then net_to_par_total end) as best_round_3
from v_team_round_ranks
group by event_id, team_id;

-- Head-to-head only applies to a clean 2-way points tie — 3+ teams tied
-- skips straight to season net-to-par, since "who beat whom" doesn't
-- resolve cleanly beyond a pair. If the pair met more than once in the
-- season, whoever won more of those meetings wins the tiebreak; an even
-- split falls through to the next level same as if they'd never played.
-- Encoded as a sort key (0 = won, 1 = lost, 0.5 = not applicable/no
-- effect) so it can sit directly in the year_rank ORDER BY below.
create or replace view v_team_h2h_adjustment as
with groups as (
  select event_id, team_id, total_points, count(*) over (partition by event_id, total_points) as tied_count
  from v_team_standings
),
pairs as (
  select g1.event_id, g1.team_id, g2.team_id as other_team_id
  from groups g1
  join groups g2 on g2.event_id = g1.event_id and g2.total_points = g1.total_points and g2.team_id <> g1.team_id
  where g1.tied_count = 2
),
pairs_h2h as (
  select
    p.event_id, p.team_id,
    count(*) filter (where h2h.match_winner_team_id = p.team_id) as wins,
    count(*) filter (where h2h.match_winner_team_id = p.other_team_id) as losses
  from pairs p
  left join v_team_head_to_head h2h
    on h2h.event_id = p.event_id
    and ((h2h.team_a_id = p.team_id and h2h.team_b_id = p.other_team_id) or (h2h.team_b_id = p.team_id and h2h.team_a_id = p.other_team_id))
  group by p.event_id, p.team_id, p.other_team_id
)
select event_id, team_id, case when wins > losses then 0 when losses > wins then 1 else 0.5 end as h2h_adjustment
from pairs_h2h
union all
select g.event_id, g.team_id, 0.5 as h2h_adjustment
from groups g
where g.tied_count <> 2;

create or replace view v_team_year_rank as
select
  vts.event_id,
  vts.team_id,
  vts.total_points,
  rank() over (
    partition by vts.event_id
    order by vts.total_points desc, coalesce(h2h.h2h_adjustment, 0.5) asc, snp.season_net_to_par asc nulls last,
             br.best_round_1 asc nulls last, br.best_round_2 asc nulls last, br.best_round_3 asc nulls last
  ) as year_rank,
  h2h.h2h_adjustment,
  snp.season_net_to_par,
  br.best_round_1,
  br.best_round_2,
  br.best_round_3
from v_team_standings vts
left join v_team_h2h_adjustment h2h on h2h.event_id = vts.event_id and h2h.team_id = vts.team_id
left join v_team_season_net_to_par snp on snp.event_id = vts.event_id and snp.team_id = vts.team_id
left join v_team_best_rounds br on br.event_id = vts.event_id and br.team_id = vts.team_id;

create or replace view v_team_tiebreak_detail as
select
  vtr.event_id,
  vtr.team_id,
  vtr.year_rank,
  count(*) over (partition by vtr.event_id, vtr.year_rank) as tied_count,
  case
    when count(*) over (partition by vtr.event_id, vtr.total_points) = 1 then 'Outright'
    when coalesce(vtr.h2h_adjustment, 0.5) != 0.5
      and count(*) over (partition by vtr.event_id, vtr.total_points, vtr.h2h_adjustment) = 1
      then 'Tiebreak: head-to-head'
    when count(*) over (partition by vtr.event_id, vtr.total_points, coalesce(vtr.h2h_adjustment, 0.5), vtr.season_net_to_par) = 1
      then 'Tiebreak: season net-to-par'
    when count(*) over (
      partition by vtr.event_id, vtr.total_points, coalesce(vtr.h2h_adjustment, 0.5), vtr.season_net_to_par, vtr.best_round_1
    ) = 1 then 'Tiebreak: best round'
    when count(*) over (
      partition by vtr.event_id, vtr.total_points, coalesce(vtr.h2h_adjustment, 0.5), vtr.season_net_to_par, vtr.best_round_1, vtr.best_round_2
    ) = 1 then 'Tiebreak: 2nd-best round'
    when count(*) over (
      partition by vtr.event_id, vtr.total_points, coalesce(vtr.h2h_adjustment, 0.5), vtr.season_net_to_par, vtr.best_round_1, vtr.best_round_2, vtr.best_round_3
    ) = 1 then 'Tiebreak: 3rd-best round'
    else 'True tie'
  end as decided_by
from v_team_year_rank vtr;

-- -----------------------------------------------------------------------------
-- Payouts: a true tie combines the consecutive places it spans (place N
-- through N + tied_count - 1) and splits that combined amount evenly —
-- not just the single place's amount. A tie resolved by any tiebreak level
-- above has tied_count = 1, so this collapses to "just that one place's
-- amount" for everyone else, unchanged from before.
-- -----------------------------------------------------------------------------
create or replace view v_solo_competition_payout as
with ranks as (
  select event_id, player_id, year_rank, count(*) over (partition by event_id, year_rank) as tied_count
  from v_solo_year_rank
),
sums as (
  select
    r.event_id, r.player_id, r.year_rank, r.tied_count,
    coalesce(
      (select sum(cpp.amount) from competition_payout_places cpp
       where cpp.event_id = r.event_id and cpp.competition = 'solo'
         and cpp.place >= r.year_rank and cpp.place < r.year_rank + r.tied_count),
      0
    ) as combined_amount
  from ranks r
)
select player_id, event_id, round(combined_amount / tied_count, 2) as amount
from sums
where combined_amount > 0;

create or replace view v_team_competition_payout as
with ranks as (
  select event_id, team_id, year_rank, count(*) over (partition by event_id, year_rank) as tied_count
  from v_team_year_rank
),
sums as (
  select
    r.event_id, r.team_id, r.year_rank, r.tied_count,
    coalesce(
      (select sum(cpp.amount) from competition_payout_places cpp
       where cpp.event_id = r.event_id and cpp.competition = 'team'
         and cpp.place >= r.year_rank and cpp.place < r.year_rank + r.tied_count),
      0
    ) as combined_amount
  from ranks r
)
select wp.player_id, s.event_id, round(s.combined_amount / (2 * s.tied_count), 2) as amount
from sums s
join teams t on t.id = s.team_id
cross join lateral (values (t.player_a_id), (t.player_b_id)) as wp(player_id)
where s.combined_amount > 0;
