-- Add raw net strokes (not just net-to-par) to round totals, needed for
-- Record Book's "net average, strokes" stat. New column appended at the
-- end — CREATE OR REPLACE VIEW can't reorder/insert existing columns.
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

-- Each player's rank within their year's Solo standings (1 = best). Ties on
-- the dropped total are broken by total_net_to_par_all_rounds (the
-- undropped total) — the rule book's tiebreaker — so a player who loses the
-- tiebreak gets the next rank down instead of sharing 1st.
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
