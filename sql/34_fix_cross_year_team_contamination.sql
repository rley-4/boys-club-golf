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
