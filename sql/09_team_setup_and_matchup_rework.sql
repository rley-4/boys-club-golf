-- =============================================================================
-- Migration: course active-this-year flag; matchup rollup flags move to
-- round level (not per-matchup)
-- =============================================================================
-- Safe to run against an existing database — every change is additive.
-- =============================================================================

-- Courses: same pattern as players.is_competing — a simple flag, not
-- historically tracked per year, just "is this course-tee in play this
-- year." Filters the course dropdown on Round-Course settings.
alter table courses
  add column if not exists is_active_this_year boolean not null default true;

-- Rounds: counts_for_team / counts_for_carroll_cup now live here instead of
-- on round_matchups, since every matchup within a round should share the
-- same rollup setting — one flag per round, not one per matchup that could
-- drift out of sync with its siblings.
alter table rounds
  add column if not exists counts_for_team boolean not null default true,
  add column if not exists counts_for_carroll_cup boolean not null default false;

-- round_matchups.counts_for_team / counts_for_carroll_cup are left in place,
-- unused, rather than dropped — non-destructive, same pattern as the old
-- low_net_solo_buy_in / low_net_team_buy_in columns.
