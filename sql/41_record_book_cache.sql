-- =============================================================================
-- Record Book caching layer
-- =============================================================================
-- Option B from the timeout investigation: rather than continue chasing
-- query-level optimizations on the live all-time rollup (real progress was
-- made — 3.35s down to 1.9s across two rounds of fixes — but it was still
-- failing in the app in practice, and the gap between what EXPLAIN ANALYZE
-- showed and what actually happened suggested chasing the query further
-- wasn't the reliable path forward), Record Book's all-time stats are now
-- cached, same proven shape as payout_snapshots.
--
-- Cached PER YEAR, not as one all-time blob — this matches how the data
-- actually behaves (a completed year's contribution is permanently fixed)
-- and means recalculating one newly-finished year is cheap, not a full
-- re-derivation of the club's whole history. The all-time number is just
-- a cheap aggregate over these already-computed rows.
--
-- Score, Leaderboard, Matches, and Games are UNCHANGED — still fully live.
-- This only touches Record Book's all-time Solo and Team tabs. The
-- per-year drill-down within Record Book also stays live — it was never
-- the slow part (only the un-scoped all-time query was).
--
-- This migration only builds the backend: cache tables, the views that
-- compute one year's worth of stats live (for recalculating), and the
-- cheap cached rollup views Record Book will read from. A minimal
-- Recalculate control is wired into Record Book itself in the app code
-- for now, to be relocated into Year Settings in a follow-up pass.
-- =============================================================================

create table if not exists solo_year_stats (
  id                  serial primary key,
  event_id            integer not null references events (id) on delete cascade,
  player_id           integer not null references players (id) on delete cascade,
  year_rank           integer,
  rounds_played       integer not null default 0,
  gross_strokes_sum   numeric not null default 0,
  gross_to_par_sum    numeric not null default 0,
  net_strokes_sum     numeric not null default 0,
  net_to_par_sum      numeric not null default 0,
  calculated_at       timestamptz not null default now(),
  unique (event_id, player_id)
);

create table if not exists team_year_stats (
  id             serial primary key,
  event_id       integer not null references events (id) on delete cascade,
  player_id      integer not null references players (id) on delete cascade,
  year_rank      integer,
  pts_low        numeric,
  pts_sum        numeric not null default 0,
  pts_count      integer not null default 0,
  pts_high       numeric,
  win            integer not null default 0,
  loss           integer not null default 0,
  tie            integer not null default 0,
  calculated_at  timestamptz not null default now(),
  unique (event_id, player_id)
);

alter table solo_year_stats enable row level security;
alter table team_year_stats enable row level security;

create policy "read_authenticated" on solo_year_stats for select using (auth.role() = 'authenticated');
create policy "admin_write" on solo_year_stats for all using (is_admin_user()) with check (is_admin_user());

create policy "read_authenticated" on team_year_stats for select using (auth.role() = 'authenticated');
create policy "admin_write" on team_year_stats for all using (is_admin_user()) with check (is_admin_user());

-- -----------------------------------------------------------------------------
-- Live, ONE YEAR at a time — what Recalculate actually queries. Filtering
-- v_solo_year_rank / v_team_year_rank down to a single event_id is the
-- fast path we've verified repeatedly throughout this whole investigation;
-- it's only asking for every year at once that was ever slow.
-- -----------------------------------------------------------------------------

create or replace view v_solo_year_stats_live as
select
  s.player_id,
  s.event_id,
  s.year_rank,
  rt.rounds_played,
  rt.gross_strokes_sum,
  rt.gross_to_par_sum,
  rt.net_strokes_sum,
  rt.net_to_par_sum
from v_solo_year_rank s
join (
  select
    grt.player_id,
    grt.event_id,
    count(*) as rounds_played,
    sum(grt.gross_total) as gross_strokes_sum,
    sum(grt.gross_to_par_total) as gross_to_par_sum,
    sum(nrt.net_total) as net_strokes_sum,
    sum(nrt.net_to_par_total) as net_to_par_sum
  from v_round_gross_totals grt
  join v_round_net_totals nrt on nrt.round_id = grt.round_id and nrt.player_id = grt.player_id
  group by grt.player_id, grt.event_id
) rt on rt.player_id = s.player_id and rt.event_id = s.event_id;

create or replace view v_team_year_stats_live as
select
  tp.player_id,
  tyr.event_id,
  tyr.year_rank,
  mp.pts_low,
  mp.pts_sum,
  mp.pts_count,
  mp.pts_high,
  coalesce(wl.win, 0) as win,
  coalesce(wl.loss, 0) as loss,
  coalesce(wl.tie, 0) as tie
from v_team_players tp
join v_team_year_rank tyr on tyr.team_id = tp.team_id and tyr.event_id = tp.event_id
left join (
  select m.team_id, r.event_id,
    min(m.historical_points) as pts_low,
    sum(m.historical_points) as pts_sum,
    count(*) as pts_count,
    max(m.historical_points) as pts_high
  from v_team_match_points m
  join rounds r on r.id = m.round_id
  group by m.team_id, r.event_id
) mp on mp.team_id = tp.team_id and mp.event_id = tyr.event_id
left join (
  select mr.team_id, r.event_id,
    count(*) filter (where mr.result = 'win') as win,
    count(*) filter (where mr.result = 'loss') as loss,
    count(*) filter (where mr.result = 'tie') as tie
  from v_team_match_record mr
  join rounds r on r.id = mr.round_id
  group by mr.team_id, r.event_id
) wl on wl.team_id = tp.team_id and wl.event_id = tyr.event_id;

-- -----------------------------------------------------------------------------
-- Cheap all-time rollups — cache table with a plain group-by, nothing
-- expensive left to compute at read time. Same column names/order as the
-- old v_solo_record_book / v_team_record_book so the app's existing
-- select() calls don't need to change, only which table/view they query.
-- Only years actually in the cache count — same "current year excluded"
-- behavior as before, since the current year is never recalculated into
-- this cache (see the app-side Recalculate control).
-- -----------------------------------------------------------------------------

create or replace view v_solo_record_book_cached as
select
  p.id as player_id,
  p.name,
  count(*) as appearances,
  min(s.year_rank) as best_finish,
  max(s.year_rank) as worst_finish,
  count(*) filter (where s.year_rank <= 3) as podium_count,
  sum(s.gross_strokes_sum) / nullif(sum(s.rounds_played), 0) as gross_avg_strokes,
  sum(s.gross_to_par_sum) / nullif(sum(s.rounds_played), 0) as gross_avg_to_par,
  sum(s.net_strokes_sum) / nullif(sum(s.rounds_played), 0) as net_avg_strokes,
  sum(s.net_to_par_sum) / nullif(sum(s.rounds_played), 0) as net_avg_to_par
from players p
join solo_year_stats s on s.player_id = p.id
group by p.id, p.name;

create or replace view v_team_record_book_cached as
select
  p.id as player_id,
  p.name,
  count(*) as appearances,
  min(s.year_rank) as best_finish,
  max(s.year_rank) as worst_finish,
  count(*) filter (where s.year_rank <= 3) as podium_count,
  min(s.pts_low) as pts_low,
  sum(s.pts_sum) / nullif(sum(s.pts_count), 0) as pts_avg,
  max(s.pts_high) as pts_high,
  sum(s.win) as win,
  sum(s.loss) as loss,
  sum(s.tie) as tie,
  case when (sum(s.win) + sum(s.loss) + sum(s.tie)) > 0
    then round(100.0 * sum(s.win) / (sum(s.win) + sum(s.loss) + sum(s.tie)), 1)
    else 0
  end as win_pct
from players p
join team_year_stats s on s.player_id = p.id
group by p.id, p.name;
