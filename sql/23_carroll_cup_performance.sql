-- =============================================================================
-- Carroll Cup — performance fix
-- =============================================================================
-- The original v_carroll_cup_side_totals / v_carroll_cup_results pair
-- built 4 UNION ALL branches (each re-running the full net-score view
-- chain), then SELF-JOINED that combined view back onto itself — forcing
-- Postgres to recompute the whole scoring stack multiple times per query,
-- which timed out.
--
-- This rewrite starts from round_matchups (a small table, tightly filtered
-- by counts_for_carroll_cup + match_type first) and uses LATERAL
-- subqueries to pull each side's total net score directly — Postgres can
-- push the matchup_id/team_id or round_id/player_id filters straight into
-- the lateral subquery instead of aggregating the entire underlying view
-- before filtering.
-- =============================================================================

drop view if exists v_carroll_cup_round_standings;
drop view if exists v_carroll_cup_standings;
drop view if exists v_carroll_cup_side_points;
drop view if exists v_carroll_cup_results;
drop view if exists v_carroll_cup_side_totals;

create or replace view v_carroll_cup_results as
select
  rm.id as matchup_id,
  rm.round_id,
  r.event_id,
  ta.name as a_name,
  tb.name as b_name,
  rost_a.side as a_color,
  rost_b.side as b_color,
  sa.total_net as a_total,
  sb.total_net as b_total,
  case when sa.total_net < sb.total_net then 1.0 when sa.total_net > sb.total_net then 0.0 else 0.5 end as a_points,
  case when sa.total_net < sb.total_net then 0.0 when sa.total_net > sb.total_net then 1.0 else 0.5 end as b_points
from round_matchups rm
join rounds r on r.id = rm.round_id and r.counts_for_carroll_cup = true and rm.match_type = 'team'
join teams ta on ta.id = rm.team_a_id
join teams tb on tb.id = rm.team_b_id
join lateral (select sum(team_best_net) as total_net from v_team_hole_best where matchup_id = rm.id and team_id = rm.team_a_id) sa on true
join lateral (select sum(team_best_net) as total_net from v_team_hole_best where matchup_id = rm.id and team_id = rm.team_b_id) sb on true
left join carroll_cup_rosters rost_a on rost_a.player_id = ta.player_a_id and rost_a.event_id = r.event_id
left join carroll_cup_rosters rost_b on rost_b.player_id = tb.player_a_id and rost_b.event_id = r.event_id

union all

select
  rm.id,
  rm.round_id,
  r.event_id,
  pa.name,
  pb.name,
  rost_a.side,
  rost_b.side,
  sa.total_net,
  sb.total_net,
  case when sa.total_net < sb.total_net then 1.0 when sa.total_net > sb.total_net then 0.0 else 0.5 end,
  case when sa.total_net < sb.total_net then 0.0 when sa.total_net > sb.total_net then 1.0 else 0.5 end
from round_matchups rm
join rounds r on r.id = rm.round_id and r.counts_for_carroll_cup = true and rm.match_type = 'singles'
join players pa on pa.id = rm.player_a_id
join players pb on pb.id = rm.player_b_id
join lateral (select sum(net_strokes) as total_net from v_hole_net_scores where round_id = rm.round_id and player_id = rm.player_a_id) sa on true
join lateral (select sum(net_strokes) as total_net from v_hole_net_scores where round_id = rm.round_id and player_id = rm.player_b_id) sb on true
left join carroll_cup_rosters rost_a on rost_a.player_id = rm.player_a_id and rost_a.event_id = r.event_id
left join carroll_cup_rosters rost_b on rost_b.player_id = rm.player_b_id and rost_b.event_id = r.event_id;

create or replace view v_carroll_cup_side_points as
select event_id, round_id, matchup_id, a_color as color, a_points as points from v_carroll_cup_results
union all
select event_id, round_id, matchup_id, b_color as color, b_points as points from v_carroll_cup_results;

create or replace view v_carroll_cup_standings as
select
  event_id,
  sum(case when color = 'red' then points else 0 end) as red_points,
  sum(case when color = 'blue' then points else 0 end) as blue_points
from v_carroll_cup_side_points
where color is not null
group by event_id;

create or replace view v_carroll_cup_round_standings as
select
  event_id,
  round_id,
  sum(case when color = 'red' then points else 0 end) as red_points,
  sum(case when color = 'blue' then points else 0 end) as blue_points
from v_carroll_cup_side_points
where color is not null
group by event_id, round_id;

-- Cheap, safe indexes on FK columns that don't get one automatically in
-- Postgres (only the referenced side of a FK is indexed by default) — helps
-- this and every other view that joins through them. (scores already has a
-- unique index starting with round_id, player_id — no new index needed there.)
create index if not exists idx_round_matchups_round_id on round_matchups (round_id);
create index if not exists idx_rounds_event_id on rounds (event_id);
