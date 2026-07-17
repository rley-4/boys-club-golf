-- =============================================================================
-- Migration: gross round totals (for the Solo leaderboard's Gross toggle)
-- =============================================================================
-- v_round_net_totals already existed for the handicap (net) view. This is
-- the same shape, summing raw strokes instead — same submitted+18-holes
-- filter, so a round only counts once it's actually finished.
-- =============================================================================

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
