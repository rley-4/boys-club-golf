-- =============================================================================
-- Migration: player_competed_years and course_played_years
-- =============================================================================
-- Simple junction tables — which years a player is considered to have
-- competed, and which years a course-tee was actually played. Deliberately
-- independent of player_handicaps / rounds (a player might not have a
-- handicap on file for a year they're known to have played, and a course
-- might be known-played in a year with no round data imported yet) — this
-- is manually-curated historical bookkeeping, mainly for Record Book
-- filtering and import sanity-checking, not derived from other tables.
-- =============================================================================

create table if not exists player_competed_years (
  player_id integer not null references players (id) on delete cascade,
  event_id  integer not null references events (id) on delete cascade,
  primary key (player_id, event_id)
);

create table if not exists course_played_years (
  course_id integer not null references courses (id) on delete cascade,
  event_id  integer not null references events (id) on delete cascade,
  primary key (course_id, event_id)
);
