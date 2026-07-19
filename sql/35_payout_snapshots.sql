-- =============================================================================
-- Payout snapshots — cached per player, per year
-- =============================================================================
-- Everything payout-related up to now has been fully live (computed fresh
-- from game_settings/competition_settings + actual results on every view).
-- That was the right call while this data lived on two admin-only,
-- occasional-use screens. Now that it's about to power Players and Record
-- Book — surfaces regular players will actually browse, possibly often —
-- and given a closed-out year's numbers are permanently final, a cache
-- makes real sense: recompute once (via the "Recalculate" action), read
-- many times, no risk of hitting a slow live query every time someone
-- checks their own earnings.
--
-- One row per player per year, combining both Games and Competition
-- payouts (the two are always recalculated together, since a single
-- "Recalculate" click needs to produce one consistent snapshot rather than
-- two that could get out of sync with each other).
-- =============================================================================

create table if not exists payout_snapshots (
  id                     serial primary key,
  event_id               integer not null references events (id) on delete cascade,
  player_id              integer not null references players (id) on delete cascade,
  game_winnings          numeric(10,2) not null default 0,
  game_buy_ins           numeric(10,2) not null default 0,
  competition_winnings   numeric(10,2) not null default 0,
  competition_buy_ins    numeric(10,2) not null default 0,
  total_winnings         numeric(10,2) not null default 0,
  total_buy_ins          numeric(10,2) not null default 0,
  net                    numeric(10,2) not null default 0,
  calculated_at          timestamptz not null default now(),
  unique (event_id, player_id)
);

alter table payout_snapshots enable row level security;
create policy "read_authenticated" on payout_snapshots for select using (auth.role() = 'authenticated');
create policy "admin_write" on payout_snapshots for all using (is_admin_user()) with check (is_admin_user());
