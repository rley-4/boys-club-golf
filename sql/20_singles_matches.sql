-- =============================================================================
-- Singles matches
-- =============================================================================
-- A matchup can now be "team" (existing 2-man best-ball pairing) or
-- "singles" (two individual players, not necessarily tied to the team
-- pairs). team_a_id/team_b_id become nullable — populated for team
-- matches, null for singles. player_a_id/player_b_id are the reverse.
-- =============================================================================

alter table round_matchups
  add column if not exists match_type text not null default 'team' check (match_type in ('team', 'singles')),
  add column if not exists player_a_id integer references players (id),
  add column if not exists player_b_id integer references players (id);

alter table round_matchups alter column team_a_id drop not null;
alter table round_matchups alter column team_b_id drop not null;

alter table round_matchups
  add constraint round_matchups_type_fields_check check (
    (match_type = 'team' and team_a_id is not null and team_b_id is not null and player_a_id is null and player_b_id is null)
    or
    (match_type = 'singles' and player_a_id is not null and player_b_id is not null and player_a_id <> player_b_id and team_a_id is null and team_b_id is null)
  );

-- v_team_hole_points now covers three cases:
--   stroke play, team match      -> computed from scores (existing branch)
--   scramble/alt shot, team match -> pulled from team_hole_results (existing branch)
--   singles match (any format)    -> each player's own net score, compared
--                                    head-to-head; points attributed to
--                                    whichever team each player is on that
--                                    year (via v_team_players), so
--                                    standings/Record Book keep working
--                                    unchanged downstream.
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
