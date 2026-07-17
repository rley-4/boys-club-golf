-- v_team_hole_points now covers both play formats:
--   stroke play  -> computed from scores (unchanged, existing branch)
--   scramble/alt shot -> pulled directly from team_hole_results (manual entry)
-- Everything downstream (v_team_match_totals, v_team_standings, Matches,
-- MatchScorecard) reads from this view, so this one change wires manual
-- non-stroke results into the whole chain.
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
join rounds r on r.id = rm.round_id and r.play_format = 'stroke'
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
join rounds r on r.id = rm.round_id and r.play_format != 'stroke'
join team_hole_results ta on ta.round_id = rm.round_id and ta.team_id = rm.team_a_id
join team_hole_results tb on tb.round_id = rm.round_id and tb.team_id = rm.team_b_id and tb.hole_number = ta.hole_number;
