-- =============================================================================
-- Roles: Admin / Player / Viewer
-- =============================================================================
-- Replaces the binary is_admin flag with a real role, matching exactly
-- three tiers (not an open-ended, admin-definable permission system —
-- Postgres RLS policies are code, not runtime data, so "create a new role
-- with custom permissions" isn't something this can support without a much
-- bigger rebuild; these three cover what was asked for):
--
--   admin  — create/edit/remove anything.
--   player — create/edit only their own scores/round_submissions; read
--            everything else same as anyone signed in.
--   viewer — read everything; no create/edit/remove anywhere, not even
--            their own scores.
--
-- One role per player, as requested. Existing is_admin values are migrated
-- in (true -> admin), everyone else defaults to player, matching "pretty
-- much all of them will end up being Player."
-- =============================================================================

alter table players
  add column if not exists role text not null default 'player' check (role in ('admin', 'player', 'viewer'));

update players set role = 'admin' where is_admin = true;

-- is_admin is left in place, unused — non-destructive, and nothing reads
-- it anymore after this point (is_admin_user() below now derives from role).

create or replace function my_role() returns text
language sql stable as $$
  select role from players where auth_user_id = auth.uid();
$$;

create or replace function is_admin_user() returns boolean
language sql stable as $$
  select my_role() = 'admin';
$$;
