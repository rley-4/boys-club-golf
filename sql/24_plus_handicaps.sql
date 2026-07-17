-- =============================================================================
-- Plus (negative) handicaps
-- =============================================================================
-- course_handicap() floored at 0, which made a plus-handicap player (index
-- below scratch, or an easy course relative to their index) indistinguishable
-- from a dead-scratch player — understating them relative to the field, and
-- (via v_matchup_player_handicap's min-of-foursome netting) understating
-- everyone else's strokes against them in match play too.
--
-- strokes_for_hole() now handles a negative value by giving strokes back
-- starting from the EASIEST holes (highest handicap rank) rather than
-- adding them starting from the hardest — the standard stroke-allocation
-- convention in reverse. The result is negative, so net = gross -
-- strokeReceived correctly comes out higher than gross on those holes.
-- =============================================================================

create or replace function course_handicap(
  p_final_index numeric,
  p_slope integer,
  p_rating numeric,
  p_total_par integer
) returns integer language sql immutable as $$
  select round(p_final_index * (p_slope::numeric / 113) + (p_rating - p_total_par))::integer
$$;

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
