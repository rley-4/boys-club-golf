-- =============================================================================
-- Fix: Team Record Book timeout — same bug family, one layer deeper
-- =============================================================================
-- v_team_record_book's "best/worst finish" reads year_rank from
-- v_team_year_rank, which is fast when scoped to one year (verified
-- earlier: ~150-200ms) but v_team_record_book asks for it across every
-- year at once, with no event filter, since it's the all-time rollup by
-- design.
--
-- The actual culprit found via EXPLAIN ANALYZE: v_team_year_rank joined
-- v_team_h2h_adjustment as a separate view, and that view independently
-- re-derives v_team_standings a second time inside its own "groups" CTE.
-- Same "expensive thing computed more than once in one query" pattern as
-- the last four fixes — just one layer further down the chain than we'd
-- looked before. Across full club history rather than one year, that
-- duplication is what produced a 1,189-node query plan and 2+ seconds of
-- planning time alone.
--
-- This was explicitly the "keep full tiebreak accuracy, make it fast at
-- scale instead of simplifying it" option — nothing about how ties get
-- resolved changes, only how many times the expensive parts get computed.
--
-- Fix, two parts:
--   1. v_team_year_rank: the head-to-head logic (previously the separate
--      v_team_h2h_adjustment view) is now inlined as CTEs sharing the
--      SAME materialized v_team_standings scan as everything else in the
--      view, instead of triggering a second, independent one.
--   2. v_team_record_book: v_team_players and v_team_year_rank are each
--      materialized once and shared across all three stat groups
--      (appearances/finish, points, win-loss), instead of each of the
--      three going through its own separate intermediate view
--      (v_player_team_year_rank etc.) and re-deriving them independently.
--      Those three intermediate views are left in place, just unused —
--      nothing else references them.
-- =============================================================================

create or replace view v_team_year_rank as
with vts as materialized (
  select * from v_team_standings
),
team_hole_data as (
  select tp.team_id, hns.round_id, hns.hole_number, min(hns.net_strokes) as team_best_net, min(hns.par) as par
  from v_team_players tp
  join rounds r on r.event_id = tp.event_id
  join v_hole_net_scores hns on hns.player_id = tp.player_id and hns.round_id = r.id
  group by tp.team_id, hns.round_id, hns.hole_number
),
team_round_net as (
  select thd.team_id, thd.round_id, r.event_id, sum(thd.team_best_net - thd.par) as net_to_par_total
  from team_hole_data thd
  join rounds r on r.id = thd.round_id and r.counts_for_team = true
  group by thd.team_id, thd.round_id, r.event_id
  having count(*) = 18
),
season_net as (
  select team_id, event_id, sum(net_to_par_total) as season_net_to_par
  from team_round_net
  group by team_id, event_id
),
best_rounds as (
  select
    event_id,
    team_id,
    max(case when round_rank = 1 then net_to_par_total end) as best_round_1,
    max(case when round_rank = 2 then net_to_par_total end) as best_round_2,
    max(case when round_rank = 3 then net_to_par_total end) as best_round_3
  from (
    select
      event_id, team_id, net_to_par_total,
      row_number() over (partition by event_id, team_id order by net_to_par_total asc) as round_rank
    from team_round_net
  ) ranked
  group by event_id, team_id
),
groups as (
  select event_id, team_id, total_points, count(*) over (partition by event_id, total_points) as tied_count
  from vts
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
),
h2h_adjustment as (
  select event_id, team_id, case when wins > losses then 0 when losses > wins then 1 else 0.5 end as h2h_adjustment
  from pairs_h2h
  union all
  select g.event_id, g.team_id, 0.5 as h2h_adjustment
  from groups g
  where g.tied_count <> 2
)
select
  vts.event_id,
  vts.team_id,
  vts.total_points,
  rank() over (
    partition by vts.event_id
    order by vts.total_points desc, coalesce(h2h.h2h_adjustment, 0.5) asc, sn.season_net_to_par asc nulls last,
             br.best_round_1 asc nulls last, br.best_round_2 asc nulls last, br.best_round_3 asc nulls last
  ) as year_rank,
  h2h.h2h_adjustment,
  sn.season_net_to_par,
  br.best_round_1,
  br.best_round_2,
  br.best_round_3
from vts
left join h2h_adjustment h2h on h2h.event_id = vts.event_id and h2h.team_id = vts.team_id
left join season_net sn on sn.event_id = vts.event_id and sn.team_id = vts.team_id
left join best_rounds br on br.event_id = vts.event_id and br.team_id = vts.team_id;

create or replace view v_team_record_book as
with tp as materialized (
  select * from v_team_players
),
tyr as materialized (
  select * from v_team_year_rank
),
yr as (
  select
    tp.player_id,
    count(distinct tyr.event_id) as appearances,
    min(tyr.year_rank) as best_finish,
    max(tyr.year_rank) as worst_finish,
    count(*) filter (where tyr.year_rank <= 3) as podium_count
  from tp
  join tyr on tyr.team_id = tp.team_id and tyr.event_id = tp.event_id
  join events e on e.id = tyr.event_id and e.is_current = false
  group by tp.player_id
),
mp as (
  select
    tp.player_id,
    min(m.historical_points) as pts_low,
    avg(m.historical_points) as pts_avg,
    max(m.historical_points) as pts_high
  from tp
  join v_team_match_points m on m.team_id = tp.team_id
  join rounds r on r.id = m.round_id
  join events e on e.id = r.event_id and e.is_current = false
  group by tp.player_id
),
wl as (
  select
    tp.player_id,
    count(*) filter (where mr.result = 'win') as win,
    count(*) filter (where mr.result = 'loss') as loss,
    count(*) filter (where mr.result = 'tie') as tie
  from tp
  join v_team_match_record mr on mr.team_id = tp.team_id
  join rounds r on r.id = mr.round_id
  join events e on e.id = r.event_id and e.is_current = false
  group by tp.player_id
)
select
  p.id as player_id,
  p.name,
  yr.appearances,
  yr.best_finish,
  yr.worst_finish,
  yr.podium_count,
  mp.pts_low,
  mp.pts_avg,
  mp.pts_high,
  wl.win,
  wl.loss,
  wl.tie,
  case when (wl.win + wl.loss + wl.tie) > 0 then round(100.0 * wl.win / (wl.win + wl.loss + wl.tie), 1) else 0 end as win_pct
from players p
join yr on yr.player_id = p.id
join mp on mp.player_id = p.id
join wl on wl.player_id = p.id;
