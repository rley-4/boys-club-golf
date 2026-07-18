-- =============================================================================
-- Fix: Team leaderboard totals not matching the visible per-round breakdown
-- =============================================================================
-- Root cause: v_team_players (team_id, event_id, player_id) is built as a
-- UNION ALL of every team's player_a_id and player_b_id. If a player is
-- ever accidentally linked to more than one team for the same event (a
-- Team setup mistake — reassigned to a new team without clearing the old
-- slot, a duplicated team row, etc.), this returned one row per team that
-- player appeared on. The singles branch of v_team_hole_points joins
-- through this view to figure out which team a player's points belong to
-- — with a duplicate row, that player's hole points got counted once per
-- team, inflating v_team_match_totals and therefore v_team_standings'
-- total_points, without a matching extra column showing up in the
-- round-by-round breakdown (which matches by round label, not by this
-- duplicated join) — hence a Total that doesn't equal the sum of the
-- visible per-round numbers.
--
-- This makes the view deterministic (one team per player per event) so it
-- can't happen going forward. It does NOT fix bad underlying data — if a
-- player is genuinely listed as player_a_id or player_b_id on two teams
-- for the same event, that's still worth cleaning up in Team setup. This
-- query finds any such cases:
--
--   select event_id, player_id, count(*) as team_count
--   from (
--     select id as team_id, event_id, player_a_id as player_id from teams
--     union all
--     select id as team_id, event_id, player_b_id as player_id from teams
--   ) x
--   group by event_id, player_id
--   having count(*) > 1;
-- =============================================================================

create or replace view v_team_players as
select distinct on (player_id, event_id) team_id, event_id, player_id
from (
  select id as team_id, event_id, player_a_id as player_id from teams
  union all
  select id as team_id, event_id, player_b_id as player_id from teams
) x
order by player_id, event_id, team_id;
