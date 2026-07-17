-- =============================================================================
-- Migration: add is_competing flag to players
-- =============================================================================
-- Run this once against your existing database (you already ran
-- 01_schema.sql before this column existed). Safe to run even if some of
-- this already exists — the "if not exists" guards make it idempotent.
-- =============================================================================

alter table players
  add column if not exists is_competing boolean not null default true;
