-- =============================================================================
-- Row Level Security
-- =============================================================================
-- DO NOT RUN THIS UNTIL you've tested that login + claiming a player profile
-- actually works end to end (migration 25 + the app's login/claim screens).
-- Once this runs, the anon key alone can no longer read or write anything —
-- every request has to come from a signed-in user, and non-admin writes are
-- restricted to that user's own scores. If nobody has claimed the admin
-- account yet, you could lock yourself out of the Admin screens.
--
-- Pattern used throughout: a "read_authenticated" policy (select, open to
-- any signed-in user — leaderboards etc. need this), plus one write policy
-- per table (admin-only for config tables; "own row or admin" for scores
-- and round_submissions specifically).
--
-- Note on views: this app's leaderboard/stats views (v_solo_standings and
-- friends) may or may not be affected by these policies depending on how
-- Supabase created them (a view normally runs as its owner, which can
-- bypass RLS) — but every screen that reads/writes a TABLE directly
-- (Players, Courses, Teams, Rounds, Matchups, Score entry, Admin) goes
-- through these policies directly, so test broadly after applying, not
-- just the views.
-- =============================================================================

alter table events enable row level security;
alter table players enable row level security;
alter table player_handicaps enable row level security;
alter table courses enable row level security;
alter table course_holes enable row level security;
alter table teams enable row level security;
alter table carroll_cup_rosters enable row level security;
alter table player_competed_years enable row level security;
alter table course_played_years enable row level security;
alter table rounds enable row level security;
alter table round_matchups enable row level security;
alter table scores enable row level security;
alter table round_submissions enable row level security;
alter table ctp_results enable row level security;
alter table game_settings enable row level security;
alter table poker_results enable row level security;
alter table team_hole_results enable row level security;

-- Read: any signed-in user, every table.
create policy "read_authenticated" on events for select using (auth.role() = 'authenticated');
create policy "read_authenticated" on players for select using (auth.role() = 'authenticated');
create policy "read_authenticated" on player_handicaps for select using (auth.role() = 'authenticated');
create policy "read_authenticated" on courses for select using (auth.role() = 'authenticated');
create policy "read_authenticated" on course_holes for select using (auth.role() = 'authenticated');
create policy "read_authenticated" on teams for select using (auth.role() = 'authenticated');
create policy "read_authenticated" on carroll_cup_rosters for select using (auth.role() = 'authenticated');
create policy "read_authenticated" on player_competed_years for select using (auth.role() = 'authenticated');
create policy "read_authenticated" on course_played_years for select using (auth.role() = 'authenticated');
create policy "read_authenticated" on rounds for select using (auth.role() = 'authenticated');
create policy "read_authenticated" on round_matchups for select using (auth.role() = 'authenticated');
create policy "read_authenticated" on scores for select using (auth.role() = 'authenticated');
create policy "read_authenticated" on round_submissions for select using (auth.role() = 'authenticated');
create policy "read_authenticated" on ctp_results for select using (auth.role() = 'authenticated');
create policy "read_authenticated" on game_settings for select using (auth.role() = 'authenticated');
create policy "read_authenticated" on poker_results for select using (auth.role() = 'authenticated');
create policy "read_authenticated" on team_hole_results for select using (auth.role() = 'authenticated');

-- Write: admin-only, for every config/admin table.
create policy "admin_write" on events for all using (is_admin_user()) with check (is_admin_user());
create policy "admin_write" on player_handicaps for all using (is_admin_user()) with check (is_admin_user());
create policy "admin_write" on courses for all using (is_admin_user()) with check (is_admin_user());
create policy "admin_write" on course_holes for all using (is_admin_user()) with check (is_admin_user());
create policy "admin_write" on teams for all using (is_admin_user()) with check (is_admin_user());
create policy "admin_write" on carroll_cup_rosters for all using (is_admin_user()) with check (is_admin_user());
create policy "admin_write" on player_competed_years for all using (is_admin_user()) with check (is_admin_user());
create policy "admin_write" on course_played_years for all using (is_admin_user()) with check (is_admin_user());
create policy "admin_write" on rounds for all using (is_admin_user()) with check (is_admin_user());
create policy "admin_write" on round_matchups for all using (is_admin_user()) with check (is_admin_user());
create policy "admin_write" on ctp_results for all using (is_admin_user()) with check (is_admin_user());
create policy "admin_write" on game_settings for all using (is_admin_user()) with check (is_admin_user());
create policy "admin_write" on poker_results for all using (is_admin_user()) with check (is_admin_user());
create policy "admin_write" on team_hole_results for all using (is_admin_user()) with check (is_admin_user());

-- Write: a player can only touch their own scores/submissions — or an admin, any.
create policy "own_or_admin_write" on scores for all
  using (player_id = my_player_id() or is_admin_user())
  with check (player_id = my_player_id() or is_admin_user());
create policy "own_or_admin_write" on round_submissions for all
  using (player_id = my_player_id() or is_admin_user())
  with check (player_id = my_player_id() or is_admin_user());

-- players: admins can do anything. A claimed user can update their own row
-- (editing their own bio/hometown, say) but can't reassign it to someone
-- else. An UNCLAIMED row (auth_user_id is null) can be claimed by any
-- signed-in user, as long as they're only linking it to themselves — this
-- is the self-service "which player are you" flow on first login.
create policy "admin_write" on players for all using (is_admin_user()) with check (is_admin_user());
create policy "self_update" on players for update
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());
create policy "claim_unclaimed" on players for update
  using (auth_user_id is null)
  with check (auth_user_id = auth.uid());
