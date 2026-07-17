-- =============================================================================
-- Migration: courses.played_event_id (single year, not many-to-many)
-- =============================================================================
-- A course-tee is only played once per year, so "years played" collapses
-- to a single nullable year per course rather than a set. This supersedes
-- course_played_years (migration 11) for courses — that table is left in
-- place, unused, non-destructive. Player "years competed" is unaffected and
-- still uses player_competed_years (a player genuinely can compete across
-- multiple years).
-- =============================================================================

alter table courses
  add column if not exists played_event_id integer references events (id);
