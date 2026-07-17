-- =============================================================================
-- Auth: link accounts to players
-- =============================================================================
-- Every account is invited by the organizer (via the Supabase Dashboard —
-- Authentication -> Users -> Invite user; no code needed for that part, and
-- it deliberately keeps the service-role key out of the client entirely).
-- On first login, the person "claims" one player row, linking their auth
-- account to it. From then on, the app knows who they are.
--
-- Admin is modeled as a flag on players, not a separate table — for a group
-- this size the organizer is also a player, so this keeps things simple. If
-- that stops being true later, this can be split into its own table without
-- much disruption (the is_admin_user() helper below is the only place that
-- would need to change).
-- =============================================================================

alter table players
  add column if not exists auth_user_id uuid references auth.users (id),
  add column if not exists is_admin boolean not null default false;

create unique index if not exists idx_players_auth_user_id on players (auth_user_id) where auth_user_id is not null;

-- True if the currently-authenticated user is linked to a player marked admin.
create or replace function is_admin_user() returns boolean
language sql stable as $$
  select exists (
    select 1 from players where auth_user_id = auth.uid() and is_admin = true
  );
$$;

-- The player_id linked to the currently-authenticated user, or null if
-- they haven't claimed a profile yet.
create or replace function my_player_id() returns integer
language sql stable as $$
  select id from players where auth_user_id = auth.uid();
$$;
