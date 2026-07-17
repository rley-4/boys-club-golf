-- =============================================================================
-- Migration: remove the 18-stroke cap on course handicap
-- =============================================================================
-- Previously course_handicap() capped at 18, and every hole got at most one
-- stroke. Removing the cap means someone with, say, a course handicap of 22
-- needs the 4 hardest holes (handicap rank 1-4) to get a SECOND stroke,
-- since there are only 18 holes to distribute strokes across (or 9, for a
-- 9-hole course). strokes_for_hole() implements that: every hole gets
-- floor(handicap / total_holes) strokes as a base, and the hardest
-- (handicap % total_holes) holes get one more on top of that.
--
-- Safe to run in full — everything here is create-or-replace.
-- =============================================================================

create or replace function course_handicap(
  p_final_index numeric,
  p_slope integer,
  p_rating numeric,
  p_total_par integer
) returns integer language sql immutable as $$
  select greatest(0, round(p_final_index * (p_slope::numeric / 113) + (p_rating - p_total_par)))::integer
$$;

create or replace function strokes_for_hole(
  p_handicap_value integer,
  p_handicap_rank integer,
  p_total_holes integer
) returns integer language sql immutable as $$
  select case
    when p_handicap_value is null or p_handicap_value <= 0 or p_total_holes <= 0 then 0
    else (p_handicap_value / p_total_holes) + (case when p_handicap_rank <= (p_handicap_value % p_total_holes) then 1 else 0 end)
  end
$$;

-- total_par already existed; hole_count is new and needed by
-- strokes_for_hole (9-hole vs 18-hole courses distribute strokes
-- differently).
create or replace view v_course_par as
select course_id, sum(par)::integer as total_par, count(*)::integer as hole_count
from course_holes
group by course_id;

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
