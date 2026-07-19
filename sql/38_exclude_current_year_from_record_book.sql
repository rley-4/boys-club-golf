-- =============================================================================
-- Fix: Record Book counting the current, still-in-progress year toward
-- all-time stats
-- =============================================================================
-- v_solo_record_book and v_team_record_book aggregated across every year
-- with no regard for events.is_current — so a year that's only partway
-- played (a handful of rounds in, most of the season still ahead) was
-- being counted alongside fully-completed seasons in appearances,
-- best/worst finish, podium count, averages, and win/loss record. A
-- partial season isn't comparable to a finished one, so it was skewing
-- the numbers exactly as reported.
--
-- Fix: every subquery feeding these two views now excludes rows belonging
-- to the current event. A player whose only appearance so far is the
-- current, unfinished year now correctly doesn't show up in Record Book
-- at all yet — same instinct as everything else here: a season that isn't
-- over yet shouldn't be compared against ones that are.
--
-- v_player_team_match_points and v_player_team_match_record didn't carry
-- event_id before; added here since v_team_record_book needs it to filter.
-- Neither view is used anywhere else, so this is a safe append.
-- =============================================================================

create or replace view v_player_team_match_points as
select tp.player_id, m.round_id, m.matchup_id, m.team_id, m.points, m.holes_played, m.historical_points, tp.event_id
from v_team_players tp
join v_team_match_points m on m.team_id = tp.team_id;

create or replace view v_player_team_match_record as
select tp.player_id, tp.team_id, r.round_id, r.matchup_id, r.result, tp.event_id
from v_team_players tp
join v_team_match_record r on r.team_id = tp.team_id;

create or replace view v_solo_record_book as
select
  p.id as player_id,
  p.name,
  yr.appearances,
  yr.best_finish,
  yr.worst_finish,
  yr.podium_count,
  rt.gross_avg_strokes,
  rt.gross_avg_to_par,
  rt.net_avg_strokes,
  rt.net_avg_to_par
from players p
join (
  select
    vsr.player_id,
    count(*) as appearances,
    min(vsr.year_rank) as best_finish,
    max(vsr.year_rank) as worst_finish,
    count(*) filter (where vsr.year_rank <= 3) as podium_count
  from v_solo_year_rank vsr
  join events e on e.id = vsr.event_id and e.is_current = false
  group by vsr.player_id
) yr on yr.player_id = p.id
join (
  select
    grt.player_id,
    avg(grt.gross_total) as gross_avg_strokes,
    avg(grt.gross_to_par_total) as gross_avg_to_par,
    avg(nrt.net_total) as net_avg_strokes,
    avg(nrt.net_to_par_total) as net_avg_to_par
  from v_round_gross_totals grt
  join v_round_net_totals nrt on nrt.round_id = grt.round_id and nrt.player_id = grt.player_id
  join events e on e.id = grt.event_id and e.is_current = false
  group by grt.player_id
) rt on rt.player_id = p.id;

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
    ptyr.player_id,
    count(distinct ptyr.event_id) as appearances,
    min(ptyr.year_rank) as best_finish,
    max(ptyr.year_rank) as worst_finish,
    count(*) filter (where ptyr.year_rank <= 3) as podium_count
  from v_player_team_year_rank ptyr
  join events e on e.id = ptyr.event_id and e.is_current = false
  group by ptyr.player_id
) yr on yr.player_id = p.id
join (
  select
    ptmp.player_id,
    min(ptmp.historical_points) as pts_low,
    avg(ptmp.historical_points) as pts_avg,
    max(ptmp.historical_points) as pts_high
  from v_player_team_match_points ptmp
  join events e on e.id = ptmp.event_id and e.is_current = false
  group by ptmp.player_id
) mp on mp.player_id = p.id
join (
  select
    ptmr.player_id,
    count(*) filter (where ptmr.result = 'win') as win,
    count(*) filter (where ptmr.result = 'loss') as loss,
    count(*) filter (where ptmr.result = 'tie') as tie
  from v_player_team_match_record ptmr
  join events e on e.id = ptmr.event_id and e.is_current = false
  group by ptmr.player_id
) wl on wl.player_id = p.id;
