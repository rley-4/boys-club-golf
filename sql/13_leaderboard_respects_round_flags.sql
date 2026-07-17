-- =============================================================================
-- Migration: leaderboard totals respect counts_for_solo / counts_for_team
-- =============================================================================
-- Solo: filtered directly in v_round_net_totals, since nothing else depends
-- on it besides Solo standings and the Solo leaderboard's per-round column
-- (and Export, which should match the leaderboard anyway).
--
-- Team: NOT filtered in v_team_hole_points / v_team_match_totals — those
-- also feed Matches' live point totals and the match scorecard drill-down,
-- which should keep showing real progress on a round regardless of whether
-- it counts toward the Team standings. Instead, the filter is applied only
-- in v_team_standings' final sum, so the leaderboard total is correct while
-- Matches stays untouched.
--
-- Carroll Cup isn't wired to real computation yet, so nothing to change
-- here — that filter is UI-only (see conversation) until Carroll Cup has a
-- real scoring rule.
-- =============================================================================

create or replace view v_round_net_totals as
select
  r.event_id,
  hns.round_id,
  hns.player_id,
  sum(hns.net_to_par) as net_to_par_total,
  count(*) as holes_scored
from v_hole_net_scores hns
join rounds r on r.id = hns.round_id
join round_submissions rs on rs.round_id = hns.round_id and rs.player_id = hns.player_id
where rs.status = 'submitted' and r.counts_for_solo = true
group by r.event_id, hns.round_id, hns.player_id
having count(*) = 18;

create or replace view v_team_standings as
select
  t.event_id,
  t.id as team_id,
  t.name,
  coalesce(sum(case when r.counts_for_team = true and mt.team_a_id = t.id then mt.team_a_points
                     when r.counts_for_team = true and mt.team_b_id = t.id then mt.team_b_points end), 0) as total_points,
  count(case when r.counts_for_team = true then mt.matchup_id end) as matches_played
from teams t
left join v_team_match_totals mt on mt.team_a_id = t.id or mt.team_b_id = t.id
left join rounds r on r.id = mt.round_id
group by t.event_id, t.id, t.name;
