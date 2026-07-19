-- =============================================================================
-- BCO Golf — Calculation Layer
-- =============================================================================
-- Builds on schema.sql. Nothing here stores a result — every view reads from
-- `scores` (and config tables) and computes on the fly, so there's never a
-- second copy of a number to drift out of sync.
--
-- Two different handicap treatments are used, and it matters which one feeds
-- which view:
--   - FULL course handicap  -> Solo standings, Low Net Solo, Low Net Team
--   - MATCHUP-netted handicap (lowest player in the match set to 0, everyone
--     else reduced by that same amount) -> Team match points only
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Course handicap: Handicap Index x (Slope/113) + (Rating - Par), rounded.
-- No floor at 0 — a plus-handicap player genuinely has a negative course
-- handicap; flooring would make them indistinguishable from scratch. No
-- upper cap either — players get every stroke their index earns them.
-- Holes beyond the first 18 (or 9, on a 9-hole course) worth of strokes get
-- a second stroke on the hardest holes — see strokes_for_hole() below.
-- -----------------------------------------------------------------------------
create or replace function course_handicap(
  p_final_index numeric,
  p_slope integer,
  p_rating numeric,
  p_total_par integer
) returns integer language sql immutable as $$
  select round(p_final_index * (p_slope::numeric / 113) + (p_rating - p_total_par))::integer
$$;

-- Distributes a handicap value across a course's holes: every hole gets
-- floor(handicap / total_holes) strokes as a base, and the hardest
-- (handicap mod total_holes) holes get one additional stroke on top. For a
-- negative (plus-handicap) value, strokes are given back instead, starting
-- from the EASIEST holes rather than added starting from the hardest.
create or replace function strokes_for_hole(
  p_handicap_value integer,
  p_handicap_rank integer,
  p_total_holes integer
) returns integer language sql immutable as $$
  select case
    when p_handicap_value is null or p_handicap_value = 0 or p_total_holes <= 0 then 0
    when p_handicap_value > 0 then
      (p_handicap_value / p_total_holes) + (case when p_handicap_rank <= (p_handicap_value % p_total_holes) then 1 else 0 end)
    else
      -1 * (
        (abs(p_handicap_value) / p_total_holes)
        + (case when p_handicap_rank > (p_total_holes - (abs(p_handicap_value) % p_total_holes)) then 1 else 0 end)
      )
  end
$$;

create or replace view v_course_par as
select course_id, sum(par)::integer as total_par, count(*)::integer as hole_count
from course_holes
group by course_id;

-- Full course handicap per player, per round.
create or replace view v_player_round_handicap as
select
  r.id as round_id,
  r.event_id,
  ph.player_id,
  course_handicap(ph.final_index, c.slope, c.rating, cp.total_par) as course_handicap,
  cp.hole_count
from rounds r
join courses c on c.id = r.course_id
join v_course_par cp on cp.course_id = c.id
join player_handicaps ph on ph.event_id = r.event_id;

-- -----------------------------------------------------------------------------
-- Net score per hole using FULL course handicap. Feeds Solo standings and
-- both Low Net side games — NOT Team match points (see matchup section below).
-- -----------------------------------------------------------------------------
create or replace view v_hole_net_scores as
select
  s.round_id,
  s.player_id,
  s.hole_number,
  s.strokes,
  ch.par,
  ch.handicap_rank,
  strokes_for_hole(prh.course_handicap, ch.handicap_rank, prh.hole_count) as stroke_received,
  least(
    s.strokes - strokes_for_hole(prh.course_handicap, ch.handicap_rank, prh.hole_count),
    ch.par + 2
  ) as net_strokes,
  least(
    s.strokes - strokes_for_hole(prh.course_handicap, ch.handicap_rank, prh.hole_count),
    ch.par + 2
  ) - ch.par as net_to_par
from scores s
join rounds r on r.id = s.round_id
join course_holes ch on ch.course_id = r.course_id and ch.hole_number = s.hole_number
join v_player_round_handicap prh on prh.round_id = s.round_id and prh.player_id = s.player_id
where s.strokes is not null;

-- -----------------------------------------------------------------------------
-- Round totals, only once submitted and complete.
-- -----------------------------------------------------------------------------
create or replace view v_round_net_totals as
select
  r.event_id,
  hns.round_id,
  hns.player_id,
  sum(hns.net_to_par) as net_to_par_total,
  count(*) as holes_scored,
  sum(hns.net_strokes) as net_total
from v_hole_net_scores hns
join rounds r on r.id = hns.round_id
join round_submissions rs on rs.round_id = hns.round_id and rs.player_id = hns.player_id
where rs.status = 'submitted' and r.counts_for_solo = true
group by r.event_id, hns.round_id, hns.player_id
having count(*) = 18;

-- -----------------------------------------------------------------------------
-- Solo standings. total_net_to_par drops the single highest round (sum-max
-- trick; a player with only one round keeps it). total_net_to_par_all_rounds
-- is the undropped sum, used as the tiebreaker per your answer.
-- -----------------------------------------------------------------------------
create or replace view v_solo_standings as
select
  event_id,
  player_id,
  count(*) as rounds_played,
  case when count(*) > 1 then sum(net_to_par_total) - max(net_to_par_total)
       else sum(net_to_par_total) end as total_net_to_par,
  sum(net_to_par_total) as total_net_to_par_all_rounds
from v_round_net_totals
group by event_id, player_id;
-- Rank: order by total_net_to_par asc, then total_net_to_par_all_rounds asc.

-- Each player's rank within their year's Solo standings (1 = best). Ties on
-- the dropped total are broken by total_net_to_par_all_rounds (the
-- undropped total) — the rule book's tiebreaker.
create or replace view v_solo_year_rank as
select
  event_id,
  player_id,
  total_net_to_par,
  rank() over (partition by event_id order by total_net_to_par asc, total_net_to_par_all_rounds asc) as year_rank
from v_solo_standings;

-- All-time Solo record book: appearances, best/worst finish, podium count,
-- and gross/net averages (both strokes and to-par), across every counted
-- round the player has on record.
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
    player_id,
    count(*) as appearances,
    min(year_rank) as best_finish,
    max(year_rank) as worst_finish,
    count(*) filter (where year_rank <= 3) as podium_count
  from v_solo_year_rank
  group by player_id
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
  group by grt.player_id
) rt on rt.player_id = p.id;

-- -----------------------------------------------------------------------------
-- Team roster helper.
-- -----------------------------------------------------------------------------
-- Deduplicated: if a player is ever accidentally linked to more than one
-- team for the same event (a Team setup data mistake — e.g. reassigned
-- without removing the old slot), this previously returned one row per
-- team, and the singles branch of v_team_hole_points would then count that
-- player's points once per team they appeared on, inflating team totals.
-- distinct on picks a single, deterministic team per player per event.
create or replace view v_team_players as
select distinct on (player_id, event_id) team_id, event_id, player_id
from (
  select id as team_id, event_id, player_a_id as player_id from teams
  union all
  select id as team_id, event_id, player_b_id as player_id from teams
) x
order by player_id, event_id, team_id;

-- =============================================================================
-- MATCHUP-NETTED HANDICAP (Team match points only)
-- Lowest full course handicap among all 4 players in a matchup is set to 0;
-- everyone else is reduced by that same amount. Example from the rule book:
-- Player A=3, Player B=7 in a match -> A=0, B=4.
-- =============================================================================
create or replace view v_matchup_participants as
select rm.id as matchup_id, rm.round_id, tp.player_id, tp.team_id
from round_matchups rm
join v_team_players tp on tp.team_id in (rm.team_a_id, rm.team_b_id);

create or replace view v_matchup_min_handicap as
select mp.matchup_id, min(prh.course_handicap) as min_handicap
from v_matchup_participants mp
join v_player_round_handicap prh on prh.round_id = mp.round_id and prh.player_id = mp.player_id
group by mp.matchup_id;

create or replace view v_matchup_player_handicap as
select
  mp.matchup_id,
  mp.round_id,
  mp.player_id,
  mp.team_id,
  prh.course_handicap as full_course_handicap,
  prh.course_handicap - mm.min_handicap as match_handicap,
  prh.hole_count
from v_matchup_participants mp
join v_player_round_handicap prh on prh.round_id = mp.round_id and prh.player_id = mp.player_id
join v_matchup_min_handicap mm on mm.matchup_id = mp.matchup_id;

-- Net score per hole using the MATCHUP-netted handicap.
create or replace view v_match_hole_net_scores as
select
  mph.matchup_id,
  mph.team_id,
  s.round_id,
  s.player_id,
  s.hole_number,
  ch.par,
  least(
    s.strokes - strokes_for_hole(mph.match_handicap, ch.handicap_rank, mph.hole_count),
    ch.par + 2
  ) as net_strokes
from v_matchup_player_handicap mph
join scores s on s.round_id = mph.round_id and s.player_id = mph.player_id
join rounds r on r.id = s.round_id
join course_holes ch on ch.course_id = r.course_id and ch.hole_number = s.hole_number
where s.strokes is not null;

-- Team best-ball (four-ball) per hole, using matchup-netted scores.
create or replace view v_team_hole_best as
select matchup_id, team_id, round_id, hole_number, min(net_strokes) as team_best_net
from v_match_hole_net_scores
group by matchup_id, team_id, round_id, hole_number;

-- Hole-by-hole points: 1 / 0.5 / 0.
-- Covers three cases: stroke play team match (computed from scores),
-- scramble/alternate shot team match (team_hole_results, manual entry),
-- and singles match — any format, each player's own net score compared
-- head-to-head, points attributed to whichever team each player is on
-- that year (via v_team_players) so standings keep working unchanged.
create or replace view v_team_hole_points as
select
  rm.id as matchup_id,
  rm.round_id,
  a.hole_number,
  rm.team_a_id,
  rm.team_b_id,
  a.team_best_net as team_a_net,
  b.team_best_net as team_b_net,
  case when a.team_best_net < b.team_best_net then 1.0
       when a.team_best_net > b.team_best_net then 0.0
       else 0.5 end as team_a_points,
  case when a.team_best_net < b.team_best_net then 0.0
       when a.team_best_net > b.team_best_net then 1.0
       else 0.5 end as team_b_points
from round_matchups rm
join rounds r on r.id = rm.round_id and r.play_format = 'stroke' and rm.match_type = 'team'
join v_team_hole_best a on a.matchup_id = rm.id and a.team_id = rm.team_a_id
join v_team_hole_best b on b.matchup_id = rm.id and b.team_id = rm.team_b_id and b.hole_number = a.hole_number

union all

select
  rm.id as matchup_id,
  rm.round_id,
  ta.hole_number,
  rm.team_a_id,
  rm.team_b_id,
  ta.net_score as team_a_net,
  tb.net_score as team_b_net,
  ta.points as team_a_points,
  tb.points as team_b_points
from round_matchups rm
join rounds r on r.id = rm.round_id and r.play_format != 'stroke' and rm.match_type = 'team'
join team_hole_results ta on ta.round_id = rm.round_id and ta.team_id = rm.team_a_id
join team_hole_results tb on tb.round_id = rm.round_id and tb.team_id = rm.team_b_id and tb.hole_number = ta.hole_number

union all

select
  rm.id as matchup_id,
  rm.round_id,
  hns_a.hole_number,
  tpa.team_id as team_a_id,
  tpb.team_id as team_b_id,
  hns_a.net_strokes as team_a_net,
  hns_b.net_strokes as team_b_net,
  case when hns_a.net_strokes < hns_b.net_strokes then 1.0
       when hns_a.net_strokes > hns_b.net_strokes then 0.0
       else 0.5 end as team_a_points,
  case when hns_a.net_strokes < hns_b.net_strokes then 0.0
       when hns_a.net_strokes > hns_b.net_strokes then 1.0
       else 0.5 end as team_b_points
from round_matchups rm
join rounds r on r.id = rm.round_id
join v_hole_net_scores hns_a on hns_a.round_id = rm.round_id and hns_a.player_id = rm.player_a_id
join v_hole_net_scores hns_b on hns_b.round_id = rm.round_id and hns_b.player_id = rm.player_b_id and hns_b.hole_number = hns_a.hole_number
left join v_team_players tpa on tpa.player_id = rm.player_a_id and tpa.event_id = r.event_id
left join v_team_players tpb on tpb.player_id = rm.player_b_id and tpb.event_id = r.event_id
where rm.match_type = 'singles';

create or replace view v_team_match_totals as
select
  matchup_id, round_id, team_a_id,
  sum(team_a_points) as team_a_points,
  team_b_id,
  sum(team_b_points) as team_b_points,
  count(*) as holes_played
from v_team_hole_points
group by matchup_id, round_id, team_a_id, team_b_id;

-- Only counts matchups from rounds flagged counts_for_team — v_team_hole_points
-- and v_team_match_totals stay unfiltered (Matches' live progress and the
-- match scorecard drill-down should keep showing real data regardless).
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
-- Rank: order by total_points desc. On a tie, look up v_team_head_to_head
-- below for the two tied teams — whoever won that head-to-head match wins
-- the tiebreak. (This lookup is a 2-team comparison, done in application
-- code rather than a single ORDER BY.)

create or replace view v_team_head_to_head as
select
  r.event_id,
  mt.round_id,
  mt.team_a_id,
  mt.team_b_id,
  mt.team_a_points,
  mt.team_b_points,
  case when mt.team_a_points > mt.team_b_points then mt.team_a_id
       when mt.team_b_points > mt.team_a_points then mt.team_b_id
       else null end as match_winner_team_id
from v_team_match_totals mt
join rounds r on r.id = mt.round_id;

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

-- =============================================================================
-- SKINS — outright lowest net score on a hole only. Two or more players
-- tied for lowest = no skin awarded that hole (per your answer).
-- =============================================================================
create or replace view v_hole_min_net as
select round_id, hole_number, min(net_strokes) as min_net
from v_hole_net_scores
group by round_id, hole_number;

create or replace view v_hole_min_counts as
select hm.round_id, hm.hole_number, hm.min_net, count(*) as players_at_min
from v_hole_min_net hm
join v_hole_net_scores hns
  on hns.round_id = hm.round_id and hns.hole_number = hm.hole_number and hns.net_strokes = hm.min_net
group by hm.round_id, hm.hole_number, hm.min_net;

create or replace view v_skins as
select hns.round_id, hns.hole_number, hns.player_id as winner_player_id, hns.net_strokes
from v_hole_net_scores hns
join v_hole_min_counts c
  on c.round_id = hns.round_id and c.hole_number = hns.hole_number and c.min_net = hns.net_strokes
where c.players_at_min = 1;

create or replace view v_skins_payout as
select
  r.id as round_id,
  r.event_id,
  gs.skins_buy_in,
  (select count(distinct s.player_id) from scores s where s.round_id = r.id) as participants,
  (select count(*) from v_skins sk where sk.round_id = r.id) as skins_won,
  gs.skins_buy_in * (select count(distinct s.player_id) from scores s where s.round_id = r.id) as total_pot,
  case when (select count(*) from v_skins sk where sk.round_id = r.id) > 0
       then round(
         (gs.skins_buy_in * (select count(distinct s.player_id) from scores s where s.round_id = r.id))
         / (select count(*) from v_skins sk where sk.round_id = r.id),
         2)
       else null end as value_per_skin
from rounds r
join game_settings gs on gs.event_id = r.event_id;

-- =============================================================================
-- PUTTING POKER — cards earned are computed; the hand and its winner are
-- resolved outside the app. Pot = 3-putt buy-in x number of 3-putts that
-- round (per the rule book: "$1 for each three putt"). Assumption: "the buy
-- in" you described IS this per-3-putt pool, not a separate flat entry fee —
-- flag if that's wrong and I'll add a base buy-in field.
-- =============================================================================
create or replace view v_poker_cards as
select
  round_id,
  player_id,
  count(*) filter (where putts = 0) as zero_putts,
  count(*) filter (where putts = 1) as one_putts,
  count(*) filter (where putts = 0) * 2 + count(*) filter (where putts = 1) as cards_earned,
  count(*) filter (where putts >= 3) as three_putts
from scores
where putts is not null
group by round_id, player_id;

create or replace view v_poker_payout as
select
  pr.round_id,
  pr.winner_player_id,
  coalesce((select sum(three_putts) from v_poker_cards pc where pc.round_id = pr.round_id), 0) as total_three_putts,
  (gs.poker_buy_in * (select count(distinct s.player_id) from scores s where s.round_id = pr.round_id))
    + (gs.poker_three_putt_buy_in * coalesce((select sum(three_putts) from v_poker_cards pc where pc.round_id = pr.round_id), 0)) as pot,
  (select count(distinct s.player_id) from scores s where s.round_id = pr.round_id) as participants,
  gs.poker_buy_in * (select count(distinct s.player_id) from scores s where s.round_id = pr.round_id) as buy_in_pot,
  gs.poker_three_putt_buy_in
    * coalesce((select sum(three_putts) from v_poker_cards pc where pc.round_id = pr.round_id), 0) as three_putt_pot
from poker_results pr
join rounds r on r.id = pr.round_id
join game_settings gs on gs.event_id = r.event_id;

-- =============================================================================
-- LOW NET — FULL course handicap (not matchup-netted). Solo: individual net
-- total for the round. Team: 2-man net best ball, full handicaps.
-- =============================================================================
create or replace view v_low_net_solo as
select round_id, player_id, sum(net_strokes) as net_total
from v_hole_net_scores
group by round_id, player_id
having count(*) = 18;

create or replace view v_low_net_solo_winners as
select ln.round_id, ln.player_id, ln.net_total
from v_low_net_solo ln
join (select round_id, min(net_total) as min_total from v_low_net_solo group by round_id) m
  on m.round_id = ln.round_id and ln.net_total = m.min_total;

create or replace view v_team_hole_best_full as
select tp.team_id, hns.round_id, hns.hole_number, min(hns.net_strokes) as team_best_net
from v_team_players tp
join v_hole_net_scores hns on hns.player_id = tp.player_id
group by tp.team_id, hns.round_id, hns.hole_number;

create or replace view v_low_net_team as
select team_id, round_id, sum(team_best_net) as net_total, count(*) as holes
from v_team_hole_best_full
group by team_id, round_id
having count(*) = 18;

create or replace view v_low_net_team_winners as
select lt.team_id, lt.round_id, lt.net_total
from v_low_net_team lt
join (select round_id, min(net_total) as min_total from v_low_net_team group by round_id) m
  on m.round_id = lt.round_id and lt.net_total = m.min_total;

-- -----------------------------------------------------------------------------
-- Gross round totals, for the Solo leaderboard's Gross toggle. Same shape
-- and filter as v_round_net_totals, just summing raw strokes instead.
-- -----------------------------------------------------------------------------
create or replace view v_round_gross_totals as
select
  r.event_id,
  hns.round_id,
  hns.player_id,
  sum(hns.strokes) as gross_total,
  sum(hns.strokes) - sum(hns.par) as gross_to_par_total,
  count(*) as holes_scored
from v_hole_net_scores hns
join rounds r on r.id = hns.round_id
join round_submissions rs on rs.round_id = hns.round_id and rs.player_id = hns.player_id
where rs.status = 'submitted'
group by r.event_id, hns.round_id, hns.player_id
having count(*) = 18;
-- =============================================================================

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


-- -----------------------------------------------------------------------------
-- CTP: buy-in is per round, per player (not per hole). Pot = buy-in x
-- participants; split evenly across however many par-3 holes the round's
-- ACTUAL course has (not assumed to be 4).
-- -----------------------------------------------------------------------------
create or replace view v_ctp_par3_holes as
select r.id as round_id, ch.hole_number
from rounds r
join course_holes ch on ch.course_id = r.course_id and ch.par = 3;

create or replace view v_ctp_payout as
select
  r.id as round_id,
  r.event_id,
  gs.ctp_prize as ctp_buy_in,
  (select count(distinct s.player_id) from scores s where s.round_id = r.id) as participants,
  (select count(*) from v_ctp_par3_holes p3 where p3.round_id = r.id) as par3_holes,
  gs.ctp_prize * (select count(distinct s.player_id) from scores s where s.round_id = r.id) as total_pot,
  case when (select count(*) from v_ctp_par3_holes p3 where p3.round_id = r.id) > 0 then
    round(
      (gs.ctp_prize * (select count(distinct s.player_id) from scores s where s.round_id = r.id))
      / (select count(*) from v_ctp_par3_holes p3 where p3.round_id = r.id),
      2
    )
  else null end as value_per_hole
from rounds r
join game_settings gs on gs.event_id = r.event_id;

-- -----------------------------------------------------------------------------
-- Per-player payout rows, one game at a time — each only counts rounds
-- where that game is actually flagged applicable, even though the
-- underlying result views (v_skins, v_low_net_solo_winners, etc.) don't
-- check that flag themselves.
-- -----------------------------------------------------------------------------

-- Skins: one payout row per skin won.
create or replace view v_skins_player_payout as
select sk.winner_player_id as player_id, r.event_id, sk.round_id, sp.value_per_skin as amount
from v_skins sk
join rounds r on r.id = sk.round_id and r.applies_skins = true
join v_skins_payout sp on sp.round_id = sk.round_id;

-- Low Net Solo: pot split evenly across everyone tied for lowest net.
create or replace view v_low_net_solo_payout as
select
  w.player_id,
  r.event_id,
  w.round_id,
  round(
    (gs.low_net_solo_buy_in * (select count(distinct s.player_id) from scores s where s.round_id = w.round_id))
    / (select count(*) from v_low_net_solo_winners w2 where w2.round_id = w.round_id),
    2
  ) as amount
from v_low_net_solo_winners w
join rounds r on r.id = w.round_id and r.applies_low_net = true
join game_settings gs on gs.event_id = r.event_id;

-- Low Net Team: buy-in is per PLAYER (pot = buy-in x total participants,
-- same convention as the other games). Tied winning teams split the pot
-- evenly across every player on every tied team — e.g. two teams tied
-- means 4 players split it, not 2 splits of a per-team half.
create or replace view v_low_net_team_payout as
with pot as (
  select
    w.round_id,
    gs.low_net_team_buy_in * (select count(distinct s.player_id) from scores s where s.round_id = w.round_id) as total_pot,
    (select count(*) from v_low_net_team_winners w2 where w2.round_id = w.round_id) as winning_teams
  from (select distinct round_id from v_low_net_team_winners) w
  join rounds r on r.id = w.round_id and r.applies_low_net = true
  join game_settings gs on gs.event_id = r.event_id
)
select
  wp.player_id,
  r.event_id,
  w.round_id,
  round(pot.total_pot / (pot.winning_teams * 2), 2) as amount
from v_low_net_team_winners w
join teams t on t.id = w.team_id
join pot on pot.round_id = w.round_id
join rounds r on r.id = w.round_id
cross join lateral (values (t.player_a_id), (t.player_b_id)) as wp(player_id);

-- Poker: winner takes the whole pot.
create or replace view v_poker_player_payout as
select pp.winner_player_id as player_id, r.event_id, pp.round_id, pp.pot as amount
from v_poker_payout pp
join rounds r on r.id = pp.round_id and r.applies_poker = true;

-- CTP: each hole's winner gets that hole's split of the round's pot.
create or replace view v_ctp_player_payout as
select cr.player_id, r.event_id, cr.round_id, cp.value_per_hole as amount
from ctp_results cr
join rounds r on r.id = cr.round_id and r.applies_ctp = true
join v_ctp_payout cp on cp.round_id = cr.round_id;

-- -----------------------------------------------------------------------------
-- Winnings, all five payout sources combined, per player per year.
-- -----------------------------------------------------------------------------
create or replace view v_player_year_winnings as
select player_id, event_id, sum(amount) as total_winnings
from (
  select player_id, event_id, amount from v_skins_player_payout
  union all
  select player_id, event_id, amount from v_low_net_solo_payout
  union all
  select player_id, event_id, amount from v_low_net_team_payout
  union all
  select player_id, event_id, amount from v_poker_player_payout
  union all
  select player_id, event_id, amount from v_ctp_player_payout
) all_payouts
group by player_id, event_id;

-- -----------------------------------------------------------------------------
-- Buy-ins owed, per player per year. Assumption, since there's no separate
-- "who opted into which game" tracking: anyone who logged any score for a
-- round is assumed to have bought into every game flagged applicable for
-- that round (Low Net Team only if they're actually on a team that year).
-- Poker's 3-putt penalty is per-player, based on their own putting that
-- round, not a flat fee. Flag if participation actually varies more than
-- this in practice — this would need a real opt-in table to track properly.
-- -----------------------------------------------------------------------------
create or replace view v_player_year_buyins as
select
  s.player_id,
  r.event_id,
  sum(
    (case when r.applies_skins then gs.skins_buy_in else 0 end)
    + (case when r.applies_poker then gs.poker_buy_in + gs.poker_three_putt_buy_in * coalesce(pc.three_putts, 0) else 0 end)
    + (case when r.applies_low_net then gs.low_net_solo_buy_in else 0 end)
    + (case when r.applies_low_net and exists (
        select 1 from teams t where t.event_id = r.event_id and (t.player_a_id = s.player_id or t.player_b_id = s.player_id)
      ) then gs.low_net_team_buy_in else 0 end)
    + (case when r.applies_ctp then gs.ctp_prize else 0 end)
  ) as total_buy_ins
from (select distinct round_id, player_id from scores) s
join rounds r on r.id = s.round_id
join game_settings gs on gs.event_id = r.event_id
left join v_poker_cards pc on pc.round_id = s.round_id and pc.player_id = s.player_id
group by s.player_id, r.event_id;

-- -----------------------------------------------------------------------------
-- Net view combining both — this is what the Games admin payouts table reads.
-- -----------------------------------------------------------------------------
create or replace view v_player_year_payouts as
select
  coalesce(w.player_id, b.player_id) as player_id,
  coalesce(w.event_id, b.event_id) as event_id,
  coalesce(w.total_winnings, 0) as total_winnings,
  coalesce(b.total_buy_ins, 0) as total_buy_ins,
  coalesce(w.total_winnings, 0) - coalesce(b.total_buy_ins, 0) as net
from v_player_year_winnings w
full outer join v_player_year_buyins b on b.player_id = w.player_id and b.event_id = w.event_id;

-- -----------------------------------------------------------------------------
-- Solo: the place amount splits evenly across anyone tied for that exact
-- finishing rank (v_solo_year_rank already resolves the tiebreaker, so
-- ties here mean a genuine dead-heat even after that).
-- -----------------------------------------------------------------------------
create or replace view v_solo_competition_payout as
select
  vsr.player_id,
  vsr.event_id,
  round(cpp.amount / count(*) over (partition by vsr.event_id, vsr.year_rank), 2) as amount
from v_solo_year_rank vsr
join competition_payout_places cpp on cpp.event_id = vsr.event_id and cpp.competition = 'solo' and cpp.place = vsr.year_rank;

-- -----------------------------------------------------------------------------
-- Team: the place amount is per FINISH, split across both players on every
-- team tied at that finish (2 players x however many tied teams).
-- -----------------------------------------------------------------------------
create or replace view v_team_competition_payout as
select
  wp.player_id,
  vtr.event_id,
  round(cpp.amount / (2 * count(*) over (partition by vtr.event_id, vtr.year_rank)), 2) as amount
from v_team_year_rank vtr
join teams t on t.id = vtr.team_id
join competition_payout_places cpp on cpp.event_id = vtr.event_id and cpp.competition = 'team' and cpp.place = vtr.year_rank
cross join lateral (values (t.player_a_id), (t.player_b_id)) as wp(player_id);

-- -----------------------------------------------------------------------------
-- Carroll Cup: place 1 = winning side's pool, place 2 = losing side's pool,
-- each split evenly across everyone on that side. An exact tie (equal
-- points) splits BOTH places' amounts across everyone on both sides.
-- -----------------------------------------------------------------------------
create or replace view v_carroll_cup_competition_payout as
with standings as (
  select event_id, red_points, blue_points,
    case when red_points > blue_points then 'red'
         when blue_points > red_points then 'blue'
         else 'tie' end as outcome
  from v_carroll_cup_standings
),
side_counts as (
  select event_id, side, count(*) as n from carroll_cup_rosters group by event_id, side
)
select
  cr.player_id,
  cr.event_id,
  case
    when s.outcome = 'tie' then
      round((coalesce(p1.amount, 0) + coalesce(p2.amount, 0)) / nullif((select sum(n) from side_counts sc where sc.event_id = cr.event_id), 0), 2)
    when cr.side = s.outcome then
      round(coalesce(p1.amount, 0) / nullif((select n from side_counts sc where sc.event_id = cr.event_id and sc.side = cr.side), 0), 2)
    else
      round(coalesce(p2.amount, 0) / nullif((select n from side_counts sc where sc.event_id = cr.event_id and sc.side = cr.side), 0), 2)
  end as amount
from carroll_cup_rosters cr
join standings s on s.event_id = cr.event_id
left join competition_payout_places p1 on p1.event_id = cr.event_id and p1.competition = 'carroll_cup' and p1.place = 1
left join competition_payout_places p2 on p2.event_id = cr.event_id and p2.competition = 'carroll_cup' and p2.place = 2;

-- -----------------------------------------------------------------------------
-- Combined: winnings and buy-ins across all three competitions.
-- -----------------------------------------------------------------------------
create or replace view v_competition_winnings as
select player_id, event_id, sum(amount) as total_winnings
from (
  select player_id, event_id, amount from v_solo_competition_payout
  union all
  select player_id, event_id, amount from v_team_competition_payout
  union all
  select player_id, event_id, amount from v_carroll_cup_competition_payout
) x
group by player_id, event_id;

create or replace view v_competition_buyins as
select player_id, event_id, sum(amount) as total_buy_ins
from (
  select vsr.player_id, vsr.event_id, cs.solo_buy_in as amount
  from v_solo_year_rank vsr
  join competition_settings cs on cs.event_id = vsr.event_id

  union all

  select wp.player_id, vtr.event_id, cs.team_buy_in as amount
  from v_team_year_rank vtr
  join teams t on t.id = vtr.team_id
  join competition_settings cs on cs.event_id = vtr.event_id
  cross join lateral (values (t.player_a_id), (t.player_b_id)) as wp(player_id)

  union all

  select cr.player_id, cr.event_id, cs.carroll_cup_buy_in as amount
  from carroll_cup_rosters cr
  join competition_settings cs on cs.event_id = cr.event_id
) x
group by player_id, event_id;

create or replace view v_competition_payouts as
select
  coalesce(w.player_id, b.player_id) as player_id,
  coalesce(w.event_id, b.event_id) as event_id,
  coalesce(w.total_winnings, 0) as total_winnings,
  coalesce(b.total_buy_ins, 0) as total_buy_ins,
  coalesce(w.total_winnings, 0) - coalesce(b.total_buy_ins, 0) as net
from v_competition_winnings w
full outer join v_competition_buyins b on b.player_id = w.player_id and b.event_id = w.event_id;

-- -----------------------------------------------------------------------------
-- Grand total: Game payouts (migration 29) + Competition payouts, combined.
-- -----------------------------------------------------------------------------
create or replace view v_player_year_grand_total as
select
  coalesce(g.player_id, c.player_id) as player_id,
  coalesce(g.event_id, c.event_id) as event_id,
  coalesce(g.total_winnings, 0) + coalesce(c.total_winnings, 0) as total_winnings,
  coalesce(g.total_buy_ins, 0) + coalesce(c.total_buy_ins, 0) as total_buy_ins,
  (coalesce(g.total_winnings, 0) + coalesce(c.total_winnings, 0)) - (coalesce(g.total_buy_ins, 0) + coalesce(c.total_buy_ins, 0)) as net
from v_player_year_payouts g
full outer join v_competition_payouts c on c.player_id = g.player_id and c.event_id = g.event_id;

-- =============================================================================
-- NOTE: the views below supersede earlier definitions of v_solo_year_rank,
-- v_team_year_rank, v_team_hole_best_full, v_solo_competition_payout, and
-- v_team_competition_payout appearing earlier in this file (migration 31,
-- appended rather than surgically edited in place — CREATE OR REPLACE VIEW
-- is order-dependent, so whichever definition runs last wins; the earlier
-- ones are dead code kept only for history, not actually in effect).
-- =============================================================================
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

-- =============================================================================
-- Fix: Competition payouts timing out
-- =============================================================================
-- Same root cause as the earlier Carroll Cup timeout: v_team_year_rank
-- joined FOUR separate views (v_team_h2h_adjustment, v_team_season_net_to_par,
-- v_team_best_rounds, plus v_team_standings directly) that each
-- independently re-derived v_team_hole_best_full -> v_hole_net_scores (a
-- moderately expensive chain on its own — course handicaps, stroke
-- allocation, etc.) from scratch. Views aren't cached across separate
-- references the way a CTE is, so that chain was getting fully recomputed
-- several times over within a single query. v_solo_year_rank had a milder
-- version of the same issue.
--
-- Fix: consolidate each into ONE view with internal CTEs, so the expensive
-- base computation happens exactly once and everything downstream (season
-- net-to-par, best rounds, final rank) is derived from that single pass.
-- v_team_hole_best_full itself is untouched and stays as a real view, since
-- v_low_net_team and v_low_net_team_winners still use it directly — this
-- only stops v_team_year_rank from redundantly re-deriving it multiple
-- times internally.
-- =============================================================================

create or replace view v_solo_year_rank as
with best_rounds as (
  select
    event_id,
    player_id,
    max(case when round_rank = 1 then net_to_par_total end) as best_round_1,
    max(case when round_rank = 2 then net_to_par_total end) as best_round_2,
    max(case when round_rank = 3 then net_to_par_total end) as best_round_3
  from (
    select
      event_id, player_id, net_to_par_total,
      row_number() over (partition by event_id, player_id order by net_to_par_total asc) as round_rank
    from v_round_net_totals
  ) ranked
  group by event_id, player_id
)
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
left join best_rounds br on br.event_id = s.event_id and br.player_id = s.player_id;

create or replace view v_team_year_rank as
with team_hole_data as (
  select tp.team_id, hns.round_id, hns.hole_number, min(hns.net_strokes) as team_best_net, min(hns.par) as par
  from v_team_players tp
  join v_hole_net_scores hns on hns.player_id = tp.player_id
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
from v_team_standings vts
left join v_team_h2h_adjustment h2h on h2h.event_id = vts.event_id and h2h.team_id = vts.team_id
left join season_net sn on sn.event_id = vts.event_id and sn.team_id = vts.team_id
left join best_rounds br on br.event_id = vts.event_id and br.team_id = vts.team_id;

create or replace view v_solo_competition_payout as
with ranks as (
  select event_id, player_id, year_rank, count(*) over (partition by event_id, year_rank) as tied_count
  from v_solo_year_rank
)
select r.player_id, r.event_id, round(ps.combined_amount / r.tied_count, 2) as amount
from ranks r
join lateral (
  select coalesce(sum(cpp.amount), 0) as combined_amount
  from competition_payout_places cpp
  where cpp.event_id = r.event_id and cpp.competition = 'solo'
    and cpp.place >= r.year_rank and cpp.place < r.year_rank + r.tied_count
) ps on true
where ps.combined_amount > 0;

create or replace view v_team_competition_payout as
with ranks as (
  select event_id, team_id, year_rank, count(*) over (partition by event_id, year_rank) as tied_count
  from v_team_year_rank
)
select wp.player_id, r.event_id, round(ps.combined_amount / (2 * r.tied_count), 2) as amount
from ranks r
join teams t on t.id = r.team_id
cross join lateral (values (t.player_a_id), (t.player_b_id)) as wp(player_id)
join lateral (
  select coalesce(sum(cpp.amount), 0) as combined_amount
  from competition_payout_places cpp
  where cpp.event_id = r.event_id and cpp.competition = 'team'
    and cpp.place >= r.year_rank and cpp.place < r.year_rank + r.tied_count
) ps on true
where ps.combined_amount > 0;

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

-- =============================================================================
-- Fix: cross-year team contamination in Low Net Team and Team tiebreakers
-- =============================================================================
-- v_team_players has one row per player per YEAR (a different team_id each
-- season). v_team_hole_best_full joined it to v_hole_net_scores matching
-- ONLY on player_id, with no check that the round's year actually matches
-- the team's year. For any player who's been on more than one team across
-- different years, that meant every hole they've ever scored got matched
-- against EVERY team they've ever been on, not just the one from the
-- matching season — so a 2022 team could show up in a 2024 round's Low Net
-- Team results (with the DB's real name for that OTHER year, or falling
-- back to "Team {id}" if that team_id isn't in the current year's team
-- list at all, which is exactly the symptom reported: names for teams
-- that "don't exist" for the year actually being viewed).
--
-- Same bug existed in two places: the standalone v_team_hole_best_full
-- view (feeds Low Net Team on Games), and duplicated inline inside
-- v_team_year_rank's own CTE (feeds the Team competition tiebreakers) —
-- the second one was copied from the first when that view was consolidated
-- for the earlier timeout fix, carrying the bug along with it.
-- =============================================================================

create or replace view v_team_hole_best_full as
select tp.team_id, hns.round_id, hns.hole_number, min(hns.net_strokes) as team_best_net, min(hns.par) as par
from v_team_players tp
join rounds r on r.event_id = tp.event_id
join v_hole_net_scores hns on hns.player_id = tp.player_id and hns.round_id = r.id
group by tp.team_id, hns.round_id, hns.hole_number;

create or replace view v_team_year_rank as
with team_hole_data as (
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
from v_team_standings vts
left join v_team_h2h_adjustment h2h on h2h.event_id = vts.event_id and h2h.team_id = vts.team_id
left join season_net sn on sn.event_id = vts.event_id and sn.team_id = vts.team_id
left join best_rounds br on br.event_id = vts.event_id and br.team_id = vts.team_id;

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
