-- =============================================================================
-- Carroll Cup — real computation
-- =============================================================================
-- Reuses the same round_matchups already set up for the regular Team
-- competition (team or singles, per the round's match_type — see
-- migration 21). A round only produces Carroll Cup results if it's flagged
-- counts_for_carroll_cup. Unlike the regular Team format (points per hole),
-- Carroll Cup is exactly 1 / 0.5 / 0 for the WHOLE match — decided by
-- comparing each side's total net score for the round (team best-ball
-- total, or individual net total for singles), not hole-by-hole.
--
-- Points are attributed to whichever roster side (red/blue) each side of
-- the matchup belongs to. For a team match, both team members are assumed
-- to be on the same Carroll Cup side (a mixed-roster team is a data-entry
-- edge case this doesn't try to resolve) — the team's side is read off its
-- first player (player_a_id).
-- =============================================================================

-- One row per side of a Carroll-Cup-eligible matchup, with that side's
-- total net score for the round.
create or replace view v_carroll_cup_side_totals as
select rm.id as matchup_id, rm.round_id, r.event_id, 'A' as side, rm.team_a_id as team_id, null::integer as player_id, sum(a.team_best_net) as total_net
from round_matchups rm
join rounds r on r.id = rm.round_id and r.counts_for_carroll_cup = true and rm.match_type = 'team'
join v_team_hole_best a on a.matchup_id = rm.id and a.team_id = rm.team_a_id
group by rm.id, rm.round_id, r.event_id, rm.team_a_id

union all

select rm.id, rm.round_id, r.event_id, 'B', rm.team_b_id, null::integer, sum(b.team_best_net)
from round_matchups rm
join rounds r on r.id = rm.round_id and r.counts_for_carroll_cup = true and rm.match_type = 'team'
join v_team_hole_best b on b.matchup_id = rm.id and b.team_id = rm.team_b_id
group by rm.id, rm.round_id, r.event_id, rm.team_b_id

union all

select rm.id, rm.round_id, r.event_id, 'A', null::integer, rm.player_a_id, sum(hns.net_strokes)
from round_matchups rm
join rounds r on r.id = rm.round_id and r.counts_for_carroll_cup = true and rm.match_type = 'singles'
join v_hole_net_scores hns on hns.round_id = rm.round_id and hns.player_id = rm.player_a_id
group by rm.id, rm.round_id, r.event_id, rm.player_a_id

union all

select rm.id, rm.round_id, r.event_id, 'B', null::integer, rm.player_b_id, sum(hns.net_strokes)
from round_matchups rm
join rounds r on r.id = rm.round_id and r.counts_for_carroll_cup = true and rm.match_type = 'singles'
join v_hole_net_scores hns on hns.round_id = rm.round_id and hns.player_id = rm.player_b_id
group by rm.id, rm.round_id, r.event_id, rm.player_b_id;

-- One row per matchup: both sides' totals, the resulting 1/0.5/0 points,
-- and which Carroll Cup color each side belongs to.
create or replace view v_carroll_cup_results as
select
  a.matchup_id,
  a.round_id,
  a.event_id,
  coalesce(ta.name, pa.name) as a_name,
  coalesce(tb.name, pb.name) as b_name,
  coalesce(rost_a.side, rost_a2.side) as a_color,
  coalesce(rost_b.side, rost_b2.side) as b_color,
  a.total_net as a_total,
  b.total_net as b_total,
  case when a.total_net < b.total_net then 1.0 when a.total_net > b.total_net then 0.0 else 0.5 end as a_points,
  case when a.total_net < b.total_net then 0.0 when a.total_net > b.total_net then 1.0 else 0.5 end as b_points
from v_carroll_cup_side_totals a
join v_carroll_cup_side_totals b on b.matchup_id = a.matchup_id and b.side = 'B'
left join teams ta on ta.id = a.team_id
left join players pa on pa.id = a.player_id
left join carroll_cup_rosters rost_a on rost_a.player_id = ta.player_a_id and rost_a.event_id = a.event_id
left join carroll_cup_rosters rost_a2 on rost_a2.player_id = a.player_id and rost_a2.event_id = a.event_id
left join teams tb on tb.id = b.team_id
left join players pb on pb.id = b.player_id
left join carroll_cup_rosters rost_b on rost_b.player_id = tb.player_a_id and rost_b.event_id = b.event_id
left join carroll_cup_rosters rost_b2 on rost_b2.player_id = b.player_id and rost_b2.event_id = b.event_id
where a.side = 'A';

-- One row per side per matchup, for clean summing by color.
create or replace view v_carroll_cup_side_points as
select event_id, round_id, matchup_id, a_color as color, a_points as points from v_carroll_cup_results
union all
select event_id, round_id, matchup_id, b_color as color, b_points as points from v_carroll_cup_results;

-- All-time (per event) Red vs Blue totals.
create or replace view v_carroll_cup_standings as
select
  event_id,
  sum(case when color = 'red' then points else 0 end) as red_points,
  sum(case when color = 'blue' then points else 0 end) as blue_points
from v_carroll_cup_side_points
where color is not null
group by event_id;

-- Per-round Red vs Blue totals, for the round-by-round table.
create or replace view v_carroll_cup_round_standings as
select
  event_id,
  round_id,
  sum(case when color = 'red' then points else 0 end) as red_points,
  sum(case when color = 'blue' then points else 0 end) as blue_points
from v_carroll_cup_side_points
where color is not null
group by event_id, round_id;
