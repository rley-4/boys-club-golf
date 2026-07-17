-- Team/Singles is now decided once per round (not per matchup) — every
-- matchup in a round shares the same format. round_matchups.match_type
-- (added in migration 20) stays as the per-row value the SQL views already
-- key off of, kept in sync by the app whenever a round's toggle changes;
-- this new column is what the UI actually shows/edits.
alter table rounds
  add column if not exists match_type text not null default 'team' check (match_type in ('team', 'singles'));
