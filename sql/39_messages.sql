-- =============================================================================
-- Messages — simple group chat
-- =============================================================================
-- v1, deliberately minimal: one shared room, everyone signed in can read
-- it, anyone with a claimed player account can post to it. No threads, no
-- reactions, no read receipts — just a message list.
--
-- Who can send: admin and player roles, not viewer — matches the existing
-- role semantics elsewhere (viewer = read-only everywhere, not just
-- scores), rather than treating chat as a special case exempt from that
-- rule. Worth reconsidering if that's not actually what's wanted — easy to
-- loosen later.
--
-- Deleting your own message is allowed (fixing a typo by resending is
-- normal chat behavior; silently editing text after the fact isn't, so
-- there's no update policy — only insert, select, and delete of your own).
-- Admin can delete anything, for basic moderation.
-- =============================================================================

create table if not exists messages (
  id          serial primary key,
  player_id   integer not null references players (id) on delete cascade,
  body        text not null check (length(trim(body)) > 0 and length(body) <= 2000),
  created_at  timestamptz not null default now()
);

alter table messages enable row level security;

create policy "read_authenticated" on messages for select using (auth.role() = 'authenticated');

create policy "send_own" on messages for insert
  with check (player_id = my_player_id() and my_role() in ('admin', 'player'));

create policy "delete_own_or_admin" on messages for delete
  using (player_id = my_player_id() or is_admin_user());
