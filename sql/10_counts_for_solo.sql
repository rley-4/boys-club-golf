-- =============================================================================
-- Migration: add counts_for_solo to rounds
-- =============================================================================
-- Rounds already had counts_for_team / counts_for_carroll_cup (added in
-- 09_team_setup_and_matchup_rework.sql). This adds the third: whether a
-- round's scores count toward Solo standings. All three now live together
-- on Round setup (formerly Round-Course settings) rather than split across
-- screens.
-- =============================================================================

alter table rounds
  add column if not exists counts_for_solo boolean not null default true;
