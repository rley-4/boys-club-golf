-- =============================================================================
-- Row Level Security
-- =============================================================================
-- DO NOT RUN THIS UNTIL you've tested that login + claiming a player profile
-- actually works end to end (migrations 25 and 27 + the app's login/claim
-- screens, and at least one admin role assigned). Once this runs, the anon
-- key alone can no longer read or write anything — every request has to
-- come from a signed-in user, and non-admin writes are restricted per the
-- role model in migration 27. If nobody has an admin role yet, you could
-- lock yourself out of the Admin screens.
--
-- Three-tier role model (see migration 27 for the role column itself):
--   admin  — create/edit/remove anything, any year, any time.
--   player — create/edit only their own scores/round_submissions, only for
--            the currently-active year, only before that round is
--            submitted.
--   viewer — read everything; no create/edit/remove anywhere.
--
-- Pattern used throughout: a "read_authenticated" policy (select, open to
-- any signed-in user — leaderboards etc. need this regardless of role),
-- plus one write policy per table (admin-only for config tables;
-- "own row, player role, or admin" for scores/round_submissions).
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

-- Read: any signed-in user, every table, regardless of role.
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

-- Write: admin-only, for every config/admin table. Player and viewer roles
-- get no write access here at all.
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

-- Write: only the "player" role can touch their own scores/submissions —
-- explicitly role-gated, not just "whichever player_id you're linked to",
-- so a viewer linked to a player row still can't write even their own
-- scores. Admins can write anyone's, any year, any time.
--
-- Two extra restrictions for the player role specifically, matching the
-- app's Score entry behavior:
--   - only for a round belonging to whichever event is currently marked
--     is_current — browsing a past year on Score entry is read-only for
--     players even before this runs, this makes it a real rule.
--   - only before that round_submission is marked 'submitted' — once
--     submitted, only an admin can touch it further.
create policy "own_or_admin_write" on scores for all
  using (
    (
      player_id = my_player_id()
      and my_role() = 'player'
      and exists (select 1 from rounds r join events e on e.id = r.event_id where r.id = scores.round_id and e.is_current = true)
      and not exists (select 1 from round_submissions rs where rs.round_id = scores.round_id and rs.player_id = scores.player_id and rs.status = 'submitted')
    )
    or is_admin_user()
  )
  with check (
    (
      player_id = my_player_id()
      and my_role() = 'player'
      and exists (select 1 from rounds r join events e on e.id = r.event_id where r.id = scores.round_id and e.is_current = true)
      and not exists (select 1 from round_submissions rs where rs.round_id = scores.round_id and rs.player_id = scores.player_id and rs.status = 'submitted')
    )
    or is_admin_user()
  );

create policy "own_or_admin_write" on round_submissions for all
  using (
    (
      player_id = my_player_id()
      and my_role() = 'player'
      and exists (select 1 from rounds r join events e on e.id = r.event_id where r.id = round_submissions.round_id and e.is_current = true)
      and coalesce(status, '') != 'submitted'
    )
    or is_admin_user()
  )
  with check (
    (
      player_id = my_player_id()
      and my_role() = 'player'
      and exists (select 1 from rounds r join events e on e.id = r.event_id where r.id = round_submissions.round_id and e.is_current = true)
    )
    or is_admin_user()
  );

-- Write: for Scramble/Alternate Shot rounds, Score entry has a player enter
-- their TEAM's net score/points per hole rather than their own strokes —
-- there's no round_submissions-style lock for this data (it just autosaves
-- on every change), so this mirrors the scores policy minus that part:
-- only a player linked to one of that specific team's two members can
-- write to it, and only for the currently-active year.
create policy "own_team_or_admin_write" on team_hole_results for all
  using (
    (
      my_role() = 'player'
      and exists (
        select 1 from teams t
        where t.id = team_hole_results.team_id
        and (t.player_a_id = my_player_id() or t.player_b_id = my_player_id())
      )
      and exists (select 1 from rounds r join events e on e.id = r.event_id where r.id = team_hole_results.round_id and e.is_current = true)
    )
    or is_admin_user()
  )
  with check (
    (
      my_role() = 'player'
      and exists (
        select 1 from teams t
        where t.id = team_hole_results.team_id
        and (t.player_a_id = my_player_id() or t.player_b_id = my_player_id())
      )
      and exists (select 1 from rounds r join events e on e.id = r.event_id where r.id = team_hole_results.round_id and e.is_current = true)
    )
    or is_admin_user()
  );

-- players: admins can do anything. Any signed-in user can update their own
-- row (editing their own bio/hometown) or claim an unclaimed one — but see
-- the trigger below, which stops a non-admin edit from also sneaking a
-- role change through the same request.
create policy "admin_write" on players for all using (is_admin_user()) with check (is_admin_user());
create policy "self_update" on players for update
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());
create policy "claim_unclaimed" on players for update
  using (auth_user_id is null)
  with check (auth_user_id = auth.uid());

-- RLS policies restrict which ROWS a query can touch, not which COLUMNS —
-- on their own, self_update/claim_unclaimed above would let someone set
-- their own role to 'admin' in the same request that edits their bio. This
-- trigger silently reverts any role change attempted by a non-admin,
-- regardless of which policy let the row-level update through.
create or replace function prevent_self_role_escalation() returns trigger
language plpgsql as $$
begin
  if not is_admin_user() and new.role is distinct from old.role then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists players_prevent_self_role_escalation on players;
create trigger players_prevent_self_role_escalation
  before update on players
  for each row
  execute function prevent_self_role_escalation();
