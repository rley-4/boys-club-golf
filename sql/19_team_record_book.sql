-- =============================================================================
-- Team Record Book
-- =============================================================================
-- Teams are re-formed every year (a new `teams` row per event), so unlike
-- Solo, there's no single persistent "team" to build a record for. This
-- tracks PLAYERS across whichever team they were paired with each year,
-- via v_team_players (already exists).
--
-- 9-hole matches: doubled ONLY for the Pts/Match low/avg/high stat below,
-- so a 9-hole match's points sit on the same scale as an 18-hole one for
-- historical comparison. Win/loss/tie is untouched — doubling both teams'
-- points equally in the same match never changes who won it — and the live
-- Team leaderboard/Matches are untouched too, since this doubling only
-- happens inside these Record Book views.
-- =============================================================================

-- Team's rank within their year's Team standings (1 = best). No
-- head-to-head tiebreaker applied yet — ties share a rank for now.
create or replace view v_team_year_rank as
select
  event_id,
  team_id,
  total_points,
  rank() over (partition by event_id order by total_points desc) as year_rank
from v_team_standings;

-- One row per team per match, with the historical (9-hole-doubled) points
-- alongside the real ones.
create or replace view v_team_match_points as
select
  round_id, matchup_id, team_a_id as team_id, team_a_points as points, holes_played,
  case when holes_played <= 9 then team_a_points * 2 else team_a_points end as historical_points
from v_team_match_totals
union all
select
  round_id, matchup_id, team_b_id as team_id, team_b_points as points, holes_played,
  case when holes_played <= 9 then team_b_points * 2 else team_b_points end as historical_points
from v_team_match_totals;

-- One row per team per match, with a win/loss/tie result — based on real
-- (undoubled) points, since doubling both sides equally never changes who won.
create or replace view v_team_match_record as
select
  round_id, matchup_id, team_a_id as team_id,
  case when team_a_points > team_b_points then 'win'
       when team_a_points < team_b_points then 'loss'
       else 'tie' end as result
from v_team_match_totals
union all
select
  round_id, matchup_id, team_b_id as team_id,
  case when team_b_points > team_a_points then 'win'
       when team_b_points < team_a_points then 'loss'
       else 'tie' end as result
from v_team_match_totals;

-- A player's finish, per year, via whichever team they were on.
create or replace view v_player_team_year_rank as
select tp.player_id, tp.event_id, tyr.team_id, tyr.total_points, tyr.year_rank
from v_team_players tp
join v_team_year_rank tyr on tyr.team_id = tp.team_id and tyr.event_id = tp.event_id;

-- A player's match points, via whichever team they were on.
create or replace view v_player_team_match_points as
select tp.player_id, m.round_id, m.matchup_id, m.team_id, m.points, m.holes_played, m.historical_points
from v_team_players tp
join v_team_match_points m on m.team_id = tp.team_id;

-- A player's match results, via whichever team they were on.
create or replace view v_player_team_match_record as
select tp.player_id, tp.team_id, r.round_id, r.matchup_id, r.result
from v_team_players tp
join v_team_match_record r on r.team_id = tp.team_id;

-- All-time Team record book: appearances, best/worst finish, podium count,
-- Pts/Match low/avg/high (historical, 9-hole-doubled), and win/loss/tie.
create or replace view v_team_record_book as
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
join (
  select
    player_id,
    count(distinct event_id) as appearances,
    min(year_rank) as best_finish,
    max(year_rank) as worst_finish,
    count(*) filter (where year_rank <= 3) as podium_count
  from v_player_team_year_rank
  group by player_id
) yr on yr.player_id = p.id
join (
  select
    player_id,
    min(historical_points) as pts_low,
    avg(historical_points) as pts_avg,
    max(historical_points) as pts_high
  from v_player_team_match_points
  group by player_id
) mp on mp.player_id = p.id
join (
  select
    player_id,
    count(*) filter (where result = 'win') as win,
    count(*) filter (where result = 'loss') as loss,
    count(*) filter (where result = 'tie') as tie
  from v_player_team_match_record
  group by player_id
) wl on wl.player_id = p.id;
