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
create or replace view v_team_players as
select id as team_id, event_id, player_a_id as player_id from teams
union all
select id as team_id, event_id, player_b_id as player_id from teams;

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
  gs.poker_three_putt_buy_in
    * coalesce((select sum(three_putts) from v_poker_cards pc where pc.round_id = pr.round_id), 0) as pot
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

