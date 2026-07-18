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
