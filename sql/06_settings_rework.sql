-- =============================================================================
-- Migration: 9/18-hole courses, matchup rollup flags, game settings rework
-- =============================================================================
-- Safe to run against an existing database — every change is guarded with
-- "if not exists".
-- =============================================================================

-- Courses can now be a 9-hole or 18-hole layout.
alter table courses
  add column if not exists holes_count integer not null default 18;

-- A matchup can be flagged in/out of the Team competition and/or the
-- Carroll Cup — some matches may not count toward either.
alter table round_matchups
  add column if not exists counts_for_team boolean not null default true,
  add column if not exists counts_for_carroll_cup boolean not null default false;

-- Game settings restructure: Poker now has its own buy-in (separate from
-- the 3-putt penalty), and Low Net collapses to a single per-player buy-in
-- used for both solo and team pots. The old low_net_solo_buy_in /
-- low_net_team_buy_in columns are left in place (unused) rather than
-- dropped, to avoid a destructive migration.
alter table game_settings
  add column if not exists poker_buy_in numeric(6,2) not null default 5,
  add column if not exists low_net_buy_in_per_player numeric(6,2) not null default 10;
