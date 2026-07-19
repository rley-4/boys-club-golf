-- =============================================================================
-- BCO Golf — Core Schema (Supabase / Postgres)
-- =============================================================================
-- Scope: foundational tables only. This is the "settings feed the source of
-- truth" layer from the diagram — config data (players, courses, teams,
-- rounds) plus the one table everything downstream is computed from (scores).
--
-- NOT in this pass (comes next, once these are settled):
--   - Views/functions for net score, net-to-par, net double bogey cap
--   - Solo standings (drop-worst-round logic)
--   - Team match points (hole-by-hole comparison + concession rules)
--   - Skins / Putting Poker / Low Net computed results
--   - Record Book rollups (career stats derived from scores + rounds)
-- Those all read FROM these tables — none of them get their own storage.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- EVENTS — one row per year. "is_current" is what Admin > Event settings
-- controls; every score/round in the app is scoped to an event_id.
-- -----------------------------------------------------------------------------
create table events (
  id            serial primary key,
  year          integer not null unique,
  rounds_played integer not null default 0,
  is_current    boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Only one event can be "current" at a time.
create unique index one_current_event on events (is_current) where is_current;

-- -----------------------------------------------------------------------------
-- PLAYERS — roster + bio. Handicap index is NOT here — it changes year to
-- year, so it lives in player_handicaps below.
-- -----------------------------------------------------------------------------
create table players (
  id            serial primary key,
  name          text not null,
  hometown      text,
  bio           text,
  joined_year   integer references events (year),
  is_competing  boolean not null default true,
  created_at    timestamptz not null default now(),
  auth_user_id  uuid references auth.users (id),
  role          text not null default 'player' check (role in ('admin', 'player', 'viewer'))
);

create unique index idx_players_auth_user_id on players (auth_user_id) where auth_user_id is not null;

-- The role linked to whoever's currently authenticated — 'admin', 'player',
-- or 'viewer'. Postgres RLS policies are code, not admin-editable data, so
-- this is deliberately a fixed three-tier model rather than an open-ended
-- roles system: admin can create/edit/remove anything; player can only
-- create/edit their own scores/round_submissions; viewer can only read.
create or replace function my_role() returns text
language sql stable as $$
  select role from players where auth_user_id = auth.uid();
$$;

create or replace function is_admin_user() returns boolean
language sql stable as $$
  select my_role() = 'admin';
$$;

-- The player_id linked to the currently-authenticated user, or null if
-- they haven't claimed a profile yet.
create or replace function my_player_id() returns integer
language sql stable as $$
  select id from players where auth_user_id = auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- PLAYER_HANDICAPS — one row per player per year. Mirrors the rule book's
-- index math directly so the calculation is auditable, not just a black-box
-- number:
--   sub_index   = (ghin_index * 0.5) + (bcin_index * 0.5)
--   final_index = sub_index * (0.95 - champ_adjustment)
-- champ_adjustment is 0.025 for a prior solo champ, 0.01 for a prior team
-- champ, 0 otherwise. Stored (not computed in a view) because GHIN/BCIN are
-- externally sourced inputs, but final_index could also be a generated
-- column once the formula is locked in.
-- -----------------------------------------------------------------------------
create table player_handicaps (
  id                serial primary key,
  player_id         integer not null references players (id) on delete cascade,
  event_id          integer not null references events (id) on delete cascade,
  ghin_index        numeric(4,1),
  bcin_index        numeric(4,1),
  sub_index         numeric(4,1),
  champ_adjustment  numeric(5,4) not null default 0,
  final_index       numeric(4,1),
  unique (player_id, event_id)
);

-- -----------------------------------------------------------------------------
-- COURSES — a course-tee combination (rating/slope are tee-specific).
-- -----------------------------------------------------------------------------
create table courses (
  id                  serial primary key,
  name                text not null,
  tee                 text not null,
  rating              numeric(4,1) not null,
  slope               integer not null check (slope between 55 and 155),
  holes_count         integer not null default 18,
  is_active_this_year boolean not null default true,
  played_event_id     integer references events (id),
  unique (name, tee)
);

-- -----------------------------------------------------------------------------
-- COURSE_HOLES — the scorecard for a course-tee. Both hole_number and
-- handicap_rank must be a 1–18 permutation per course.
-- -----------------------------------------------------------------------------
create table course_holes (
  id             serial primary key,
  course_id      integer not null references courses (id) on delete cascade,
  hole_number    integer not null check (hole_number between 1 and 18),
  par            integer not null check (par in (3, 4, 5)),
  yardage        integer not null check (yardage > 0),
  handicap_rank  integer not null check (handicap_rank between 1 and 18),
  unique (course_id, hole_number),
  unique (course_id, handicap_rank)
);

-- -----------------------------------------------------------------------------
-- TEAMS — pairings, scoped per event since pairs can change year to year.
-- -----------------------------------------------------------------------------
create table teams (
  id           serial primary key,
  event_id     integer not null references events (id) on delete cascade,
  name         text not null,
  player_a_id  integer not null references players (id),
  player_b_id  integer not null references players (id),
  check (player_a_id <> player_b_id),
  unique (event_id, name)
);

-- -----------------------------------------------------------------------------
-- CARROLL_CUP_ROSTERS — Red/Blue assignment, one row per player per event.
-- -----------------------------------------------------------------------------
create table carroll_cup_rosters (
  id        serial primary key,
  event_id  integer not null references events (id) on delete cascade,
  player_id integer not null references players (id) on delete cascade,
  side      text not null check (side in ('red', 'blue')),
  unique (event_id, player_id)
);

-- -----------------------------------------------------------------------------
-- PLAYER_COMPETED_YEARS — a player can genuinely compete across multiple
-- years, so this stays a many-to-many junction table for manually-curated
-- historical bookkeeping (Record Book filtering, import sanity-checking).
-- Deliberately independent of player_handicaps. Courses are different — a
-- course-tee is only played once per year, so that's just a single nullable
-- column (courses.played_event_id) rather than a junction table.
-- -----------------------------------------------------------------------------
create table player_competed_years (
  player_id integer not null references players (id) on delete cascade,
  event_id  integer not null references events (id) on delete cascade,
  primary key (player_id, event_id)
);

-- -----------------------------------------------------------------------------
-- ROUNDS — a round is "R1", "R2"... for a given event, tied to one course.
-- This is what Score entry, Matches, and Games all key off.
-- -----------------------------------------------------------------------------
create table rounds (
  id                      serial primary key,
  event_id                integer not null references events (id) on delete cascade,
  label                   text not null,
  course_id               integer references courses (id),
  round_order             integer not null default 0,
  counts_for_solo         boolean not null default true,
  counts_for_team         boolean not null default true,
  counts_for_carroll_cup  boolean not null default false,
  play_format             text not null default 'stroke' check (play_format in ('stroke', 'scramble', 'alternate_shot')),
  match_type              text not null default 'team' check (match_type in ('team', 'singles')),
  applies_skins           boolean not null default true,
  applies_poker           boolean not null default true,
  applies_low_net         boolean not null default true,
  applies_ctp             boolean not null default true,
  unique (event_id, label)
);

-- -----------------------------------------------------------------------------
-- ROUND_MATCHUPS — which two teams play each other in a given round. A round
-- can have more than one matchup (multiple concurrent team matches).
-- -----------------------------------------------------------------------------
create table round_matchups (
  id           serial primary key,
  round_id     integer not null references rounds (id) on delete cascade,
  match_type   text not null default 'team' check (match_type in ('team', 'singles')),
  team_a_id    integer references teams (id),
  team_b_id    integer references teams (id),
  player_a_id  integer references players (id),
  player_b_id  integer references players (id),
  check (team_a_id <> team_b_id),
  constraint round_matchups_type_fields_check check (
    (match_type = 'team' and team_a_id is not null and team_b_id is not null and player_a_id is null and player_b_id is null)
    or
    (match_type = 'singles' and player_a_id is not null and player_b_id is not null and player_a_id <> player_b_id and team_a_id is null and team_b_id is null)
  )
);

-- -----------------------------------------------------------------------------
-- SCORES — the single source of truth. One row per hole, per player, per
-- round. Everything else in the app (net score, standings, match points,
-- skins, poker) is a read computed from this table — nothing downstream
-- gets its own storage.
-- -----------------------------------------------------------------------------
create table scores (
  id          serial primary key,
  round_id    integer not null references rounds (id) on delete cascade,
  player_id   integer not null references players (id) on delete cascade,
  hole_number integer not null check (hole_number between 1 and 18),
  strokes     integer check (strokes > 0),
  putts       integer check (putts >= 0),
  updated_at  timestamptz not null default now(),
  unique (round_id, player_id, hole_number),
  constraint putts_not_more_than_strokes check (
    putts is null or strokes is null or putts <= strokes
  )
);

create index scores_round_player_idx on scores (round_id, player_id);

-- -----------------------------------------------------------------------------
-- ROUND_SUBMISSIONS — Save vs. Submit status, one row per player per round
-- (not per hole — status applies to the whole round). This is what the
-- Matches progress marker ("Thru 14" / "F") reads.
-- -----------------------------------------------------------------------------
create table round_submissions (
  id            serial primary key,
  round_id      integer not null references rounds (id) on delete cascade,
  player_id     integer not null references players (id) on delete cascade,
  status        text not null default 'in_progress' check (status in ('in_progress', 'submitted')),
  submitted_at  timestamptz,
  unique (round_id, player_id)
);

-- -----------------------------------------------------------------------------
-- CTP_RESULTS — manual entry (not derivable from scores). One winner per
-- hole per round at most.
-- -----------------------------------------------------------------------------
create table ctp_results (
  id          serial primary key,
  round_id    integer not null references rounds (id) on delete cascade,
  hole_number integer not null check (hole_number between 1 and 18),
  player_id   integer not null references players (id),
  unique (round_id, hole_number)
);

-- -----------------------------------------------------------------------------
-- GAME_SETTINGS — buy-ins/prizes, one row per event (matches Admin > Game
-- settings). Skins' per-skin payout, poker buy-ins, etc. all read from here.
-- -----------------------------------------------------------------------------
create table game_settings (
  id                        serial primary key,
  event_id                  integer not null unique references events (id) on delete cascade,
  skins_buy_in              numeric(6,2) not null default 5,
  poker_buy_in              numeric(6,2) not null default 5,
  poker_three_putt_buy_in   numeric(6,2) not null default 1,
  low_net_solo_buy_in       numeric(6,2) not null default 10,
  low_net_team_buy_in       numeric(6,2) not null default 10,
  ctp_prize                 numeric(6,2) not null default 20
);

-- -----------------------------------------------------------------------------
-- POKER_RESULTS — manual entry. The poker hand itself is resolved outside
-- the app (physical deck); the app only needs the winner so the pot — the
-- 3-putt buy-ins collected that round — can be paid out. See calculations.sql
-- for the pot math.
-- -----------------------------------------------------------------------------
create table poker_results (
  id                serial primary key,
  round_id          integer not null unique references rounds (id) on delete cascade,
  winner_player_id  integer not null references players (id)
);

-- -----------------------------------------------------------------------------
-- Competition-level (season-long) buy-ins and place payouts — Solo/Team
-- final standings, and Carroll Cup outcome. Separate from game_settings,
-- which is per-round. See calculations.sql for the payout math; RLS for
-- these two (admin write, open read) is enabled where they're created,
-- migration 30, since they don't exist yet when migration 26 runs.
-- -----------------------------------------------------------------------------
create table if not exists competition_settings (
  id                  serial primary key,
  event_id            integer not null unique references events (id) on delete cascade,
  solo_buy_in         numeric(6,2) not null default 0,
  team_buy_in         numeric(6,2) not null default 0,
  carroll_cup_buy_in  numeric(6,2) not null default 0
);

create table if not exists competition_payout_places (
  id           serial primary key,
  event_id     integer not null references events (id) on delete cascade,
  competition  text not null check (competition in ('solo', 'team', 'carroll_cup')),
  place        integer not null check (place >= 1),
  amount       numeric(8,2) not null default 0,
  unique (event_id, competition, place)
);

-- Cached payout results, per player per year — see calculations.sql /
-- migration 35 for why this is a real table rather than a view. Populated
-- by the "Recalculate" action, not written to directly by the app
-- otherwise.
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
