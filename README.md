# BCO Golf

## Running it right now, with no setup

```
npm install
npm run dev
```

Open the URL it prints. The app runs on the same built-in demo data it's had
throughout this whole build — nothing to configure. This confirms the UI
still works standalone before you touch Supabase at all.

## Already have a database from before?

Four things changed after the initial schema:

- **`sql/04_add_competing_flag.sql`** — adds `is_competing` to `players`. Run once if you already ran `01_schema.sql`.
- **`sql/02_calculations.sql`** — fixed a `bigint`/`integer` type mismatch in `course_handicap()`. Safe to re-run in full.
- **`sql/06_settings_rework.sql`** — adds 9/18-hole support to `courses`, rollup flags to `round_matchups`, and new fields to `game_settings`.
- **`sql/07_no_handicap_cap.sql`** — removes the old 18-stroke cap on course handicap. Above 18, the hardest holes now correctly get a second stroke (or third, etc.) rather than the cap silently capping everyone at one stroke per hole. Safe to re-run in full.

## Connecting a real backend

1. **Create a free Supabase project** at supabase.com.
2. **Run the SQL files, in order**, in the Supabase SQL Editor:
   - `sql/01_schema.sql` — all the tables
   - `sql/02_calculations.sql` — the computed views (net scores, standings, match points, skins, poker, low net)
   - `sql/03_seed.sql` — sample data matching the app's built-in demo data (same 8 players, 3 courses, teams, 2026 as the current event) so testing feels familiar
3. **Get your API keys**: Project Settings → API → copy the Project URL and the `anon` `public` key.
4. **Copy `.env.example` to `.env`** and paste those two values in.
5. **Restart the dev server** (`npm run dev`) if it was already running.

## Database migrations

Migrations are managed with the [Supabase CLI](https://supabase.com/docs/guides/local-development), installed as a dev dependency (so `npm install` gets it — nothing to install globally). The `supabase/` folder holds `config.toml` and, going forward, a `supabase/migrations/` folder of timestamped SQL files. The CLI keeps a ledger of which migrations a database has already had applied, so you apply *the diff* instead of eyeballing which numbered file to run.

**npm commands** (thin wrappers around the CLI):

| Command | What it does |
| --- | --- |
| `npm run db:link` | One-time: link this repo to your Supabase project (`npm run db:link -- --project-ref <ref>`). Needs an access token — run `npx supabase login` first. |
| `npm run migrate:new -- <name>` | Create a new timestamped migration file under `supabase/migrations/`. |
| `npm run migrate:up` | Apply all un-applied migrations to the linked (remote) database (`supabase db push`). |
| `npm run migrate:list` | Show which migrations are applied locally vs. remotely. |
| `npm run migrate:diff -- -f <name>` | Generate a migration from schema changes you've made (e.g. via Studio). |
| `npm run migrate:reset` | Rebuild the **local** database from scratch by replaying every migration — the fastest way to prove a clean install still works end to end. |
| `npm run supabase:start` / `npm run supabase:stop` | Start/stop the local Supabase stack (Postgres, Studio, etc.) for offline development. Requires Docker. |

**Typical flow for a schema change:**

1. `npm run migrate:new -- add_something` — creates `supabase/migrations/<timestamp>_add_something.sql`.
2. Write your SQL in that file. Keep it idempotent where practical (`add column if not exists`, `create or replace view`).
3. `npm run migrate:reset` — verify it applies cleanly against a fresh local DB.
4. `npm run migrate:up` — apply it to the real project when you're happy.

**About the existing `sql/` files:** the numbered files in `sql/` (`01_schema.sql` … `41_record_book_cache.sql`) are the historical record and still work if you paste them into the Supabase SQL Editor in order (see "Connecting a real backend" above). They are **not** yet under CLI management. To move to a fully tool-managed workflow, do this once: create `supabase/migrations/` and copy each `sql/NN_*.sql` into it renamed with a sortable timestamp-style prefix (e.g. `00001_schema.sql`, `00002_calculations.sql`, …) preserving order, then run `npm run migrate:reset` to confirm they replay cleanly. After that, `sql/` can be retired in favor of `supabase/migrations/`.

## What's actually wired to Supabase right now

This is a first pass — "portions" driving off the backend, not the whole app yet:

- **Players and Courses** load from Supabase on startup (falls back to the built-in demo data if Supabase isn't configured, or if the load fails for any reason — you'll see a banner on the Score tab if that happens).
- **More → Players**: "Add player" writes a real `players` row plus a `player_handicaps` row for the current event. The "Competing this year" toggle persists too.
- **More → Courses**: "Add course-tee" is now a two-step flow — course metadata, then a real 18-hole entry grid (par/yardage/handicap rank, validated as a proper 1–18 permutation) — and both get written to `courses` and `course_holes`.
- **Admin → Event settings**: Team pairs and Rounds (which now includes course assignment *and* team matchups together, since in the database a round's course is just a column on the round itself — see note below) are live: add/edit/remove any of them and it writes straight to `teams`, `rounds`, and `round_matchups`. Editing a round or its matchups also refreshes Score/Matches immediately, no year-switch required.
  - **Current Year is still local-only** for now (adding new years / editing rounds-played doesn't touch the `events` table).
  - **Carroll Cup roster is now live** — assignments on Admin → Team setup persist to `carroll_cup_rosters`, and Score entry's Carroll Cup badge reads from there.
- **Score entry's Team badge, Carroll Cup badge, and Pops (match handicap)** are now fully live — they read real teams, that round's real matchup, and the real Carroll Cup roster, falling back to the mock roster only if nothing's loaded (offline mode, or nothing set up yet for that round).
- **Player list only shows people flagged "competing this year"** — toggle under More → Players. Defaults to true for everyone.
- **Round selects the course automatically** — no separate course picker in Score entry. Which course a round maps to comes from `rounds.course_id`, and re-syncs whenever Current Year changes, or whenever a round is edited on Event settings.
- **Score entry Save/Submit** actually writes to the `scores` and `round_submissions` tables — as an upsert keyed on Round+Player+Hole (Save) and Round+Player (submission status), so re-saving overwrites rather than duplicating. Selecting a player + round also *reads back* whatever's already saved — reload the page, or come back later, and progress should still be there. This is the main thing worth testing.

**A structural note**: "Round courses" and "Round matchups" used to be two separate lists in the UI. They're now one — a "Rounds" section — because in the real schema a round's course is a column on the `rounds` row itself (not a separate table), so keeping them as independent lists risked them referring to different rounds by mistake. If you were relying on the old split, this is the fix, not a regression.

- **Leaderboard → Solo and Team**, **Matches' point totals**, and **all four Games panels** (Skins, Poker, CTP, Low Net) read real computed data — see the `stats.js` section below for specifics.
- **Admin → Import results** — see below.

**Still mock, not wired yet:**
- **Carroll Cup** (leaderboard totals + per-round matches) — paused pending a real scoring rule, since it was never actually specified (see conversation).
- **Record Book** (all-time solo/team records, year drill-down) — hasn't been tackled yet.

## What to actually test

1. Run through setup above.
2. Go to **Score**, pick a player and round (R1–R4 have courses assigned via the seed data; R5/R6 don't exist in the backend yet, so they'll say "saving locally only").
3. Enter a few holes, hit **Save**. Check the Supabase dashboard's Table Editor — you should see rows appear in `scores` and `round_submissions`.
4. Reload the page, reselect the same player/round — your entries should reappear, pulled from Supabase rather than memory.
5. Fill in all 18 holes + putts, hit **Submit** — `round_submissions.status` should flip to `submitted`.
6. Try a second "player" (open the app in another browser tab, pick a different player) to get a feel for multiple people saving into the same backend at once.

## Project structure

```
src/
  App.jsx              bootstraps live data (or falls back to demo data), then renders AppShell
  AppShell.jsx          the whole UI — all tabs, all screens
  main.jsx              Vite entry point
  lib/
    supabaseClient.js   creates the Supabase client from .env
    api.js               every Supabase read/write call for config data (players, courses, teams, rounds, matchups, scores) lives here
    stats.js              every computed-result read (standings, points, skins, poker, low net) lives here — thin wrappers around the views in 02_calculations.sql, not reimplemented logic
sql/
  01_schema.sql          tables
  02_calculations.sql     computed views
  03_seed.sql             sample data (regenerate via `node scripts/gen-seed.mjs` if you tweak the source data in scripts/gen-seed.mjs)
```

**`stats.js` is now wired into Leaderboard (Solo, Team), Matches' points, and all four Games panels.**
- **Skins**: real per-hole winners and pot math from `v_skins`/`v_skins_payout`.
- **Poker**: real card counts from `v_poker_cards`, plus a genuinely new feature — a winner-selection UI that writes to `poker_results` (this never existed before; the mock version had no way to record a winner at all).
- **CTP**: the "Save all" flow now actually diffs against `ctp_results` and upserts/deletes per hole, instead of being purely local state.
- **Low Net**: both Solo and Team read real net totals (`v_low_net_solo`/`v_low_net_team`), plus a new `v_round_gross_totals` lookup for Solo's Gross column.

**Admin → Import results is now real** — download a CSV template (Player, Round, Year, then Strokes/Putts for holes 1–18), fill it in, upload it, and it upserts straight into `scores` + `round_submissions` (marked `submitted`), row by row, with per-row validation errors shown after import (unknown player, round/year not found, bad hole data, etc.). This is the fastest way to backfill a lot of historical or already-played rounds without tapping through Score entry hole by hole.

**One shared match scorecard, two entry points**: tapping into a match's points — from either Matches or the Team leaderboard's round columns — opens the same `MatchScorecard` component: Hole, Team A net best ball, Team B net best ball, Points A, Points B, reading straight from `v_team_hole_points`. This replaced the older Team leaderboard drill-down (which showed individual player scores) — deliberately simplified per request, and now there's exactly one implementation instead of two that could drift apart.

**Admin → Team setup now has its own year selector**, independent of the global Current Year — you can set up next year's team pairs and Carroll Cup roster before this year's event has even happened, and each year is a genuinely separate `event_id`, so editing one year's teams can never touch another year's saved results. "+Add year" here creates a real `events` row via a new `createEvent()` call.

**Score page**: hole info reordered — Hole number, then Par/Yardage/Hcp stacked beside it.

**Leaderboard**: Team column now stacks Team name (bold) / Player A / Player B instead of a slash-joined string; Total column dropped the "/max possible" denominator. Carroll Cup is now a real table — big totals stay at top, then a Round × Red/Blue points table below, tapping a round drills into that round's individual matchups. Still wireframed with manual/mock data — no backend rule exists for Carroll Cup scoring yet (see earlier conversation).

**Players**: "Joined year" is gone, replaced by a **Years competed** multi-select (2022–2025, wireframe only — same toggle pattern as "Competing this year," not yet saved to Supabase). Also improved the Edit error banner to show the *actual* Supabase error message instead of a generic one — if editing still fails, the banner will now say why, which should make the next fix a lot more precise.

**Courses**: added a **Years played** multi-select, same wireframe pattern, ahead of historical CSV imports.

**Admin → Year settings** (renamed from "General"): now lists every real year in the database with an editable, persisted "rounds played" per year, and a "Set current" action per row — properly live via new `fetchEvents`/`updateEvent`/`setCurrentEvent` calls (the last one correctly clears the old current-year flag first, since only one event can be current at a time).

**Admin → Round-Course settings** and **Admin → Matchup setup** both gained their own independent year selectors, same pattern as Team setup — each resolves its own `event_id`, so you can configure a future or past year's rounds/matchups without touching the currently-active year. Editing rounds/matchups only pushes a live refresh to Score/Matches if you're editing the year that's actually current.

**Admin → Export results now pulls live data.** Solo/Team leaderboard and Skins/Poker (all rounds) export real numbers when connected — Solo/Team Record Book entries stay mock, clearly labeled in the checkbox text, since Record Book itself isn't live yet.

**Admin → Game settings is now fully live** — loads/saves real values per event via `game_settings` (no new migration needed; the columns already existed from earlier sessions, they just weren't being read or written). This isn't just persistence — it now actually feeds the active Games screen:
- **Skins and Poker payouts were already reading `game_settings` at the SQL level** (`v_skins_payout`/`v_poker_payout`) — they just had nothing real to read before. Now they do.
- **Low Net** gained a pot summary it never had (Solo: buy-in × players; Team: buy-in × 2 × teams), computed from live settings.
- **CTP** now shows the real $/hole prize inline.

**Players' "Years competed" and Courses' "Years played" are now live**, via two new junction tables (`player_competed_years`, `course_played_years` — migration `11_years_competed_played.sql`). Deliberately kept independent of `player_handicaps`/`rounds` rather than derived from them — a player might not have a handicap on file for a year they're known to have played, and a course might be known-played in a year with no round data imported yet, so this stays simple manually-curated bookkeeping rather than something that could silently delete real handicap/round data when toggled off. Same toggle UI as before, now backed by real years and real saves; still falls back to local-only toggling if there's no Supabase connection.

**Record Book stays mock, as agreed** — no changes made there.

**Courses' "Years played" changed from multi-select to single-select** — a course-tee is only played once per year, so it's now one dropdown (`courses.played_event_id`, a plain nullable column) instead of the multi-toggle chips from last round. That superseded `course_played_years` for courses specifically; that table is now unused (left in place, non-destructive) and was removed from the fresh-install schema since there's no reason a new database would ever populate it. Players' "Years competed" is unchanged — a player genuinely can compete across multiple years, so it stays multi-select via `player_competed_years`.

Courses also gained a **top-of-screen year filter** — multi-select pills that narrow the course list to whichever year(s) you pick (e.g. select 2025 to see only courses played that year); leave nothing selected to see everything. Migration to run: `sql/12_course_played_year_single.sql`.

**Leaderboard columns now respect Round setup's Solo/Team/Carroll Cup checkboxes.** Uncheck a round's box and its column disappears from that leaderboard entirely — but this isn't just a UI filter, since a hidden column whose score still secretly counted toward the Total would be worse than not filtering at all:
- **Solo**: `v_round_net_totals` now only includes rounds flagged `counts_for_solo` — so the Total (and which round gets dropped as the high round) is computed correctly over just the counted rounds, not silently including hidden ones.
- **Team**: filtered one level higher, in `v_team_standings` specifically — `v_team_hole_points`/`v_team_match_totals` stay unfiltered on purpose, since those also feed Matches' live point totals and the match scorecard drill-down, which should keep showing real progress on a round regardless of whether it counts toward the Team standings.
- **Carroll Cup**: UI-only filter (no live scoring yet) — defaults to showing everything until real round flags load, since Carroll Cup's checkbox defaults to *unchecked*, unlike Solo/Team's default-*checked*.

Migration to run: `sql/13_leaderboard_respects_round_flags.sql`.

**Admin → Import results gained a fourth template: Matchups.** One row per matchup — Year, Round, Home Team, Away Team. Resolves the round the same way Score import does (Year + Round label → real round), then resolves both teams by name for that year. Skips a row if that exact pairing already exists for the round (either team as home or away), so re-uploading the same file won't create duplicates. This is the fastest way to set up a full round's matchups at once instead of adding them one at a time on Matchup setup.

**"Competing this year" and "Active this year" are now computed, not manually toggled.** Now that Years competed (players) and Year played (courses) are both live, keeping a separate manual flag was redundant and could drift out of sync with them. Both are now derived automatically:
- **Players**: competing = they have a `player_competed_years` row for whatever year is currently selected. `fetchPlayers()` computes this directly — the old `is_competing` column and `updatePlayerCompeting()` are gone from the code (column left in place in the DB, unused, non-destructive).
- **Courses**: active = `courses.played_event_id` matches the current year's event. Computed client-side in `AppShell`'s `refreshRoundMap` (and at boot) by comparing against the resolved event each time Current Year changes — no fetch needed, since `played_event_id` already comes back with every course. `updateCourseActive()` is gone the same way.

Both admin screens still show the status (Players: "Competing this year," Courses: "Active this year") — they're just read-only badges now, with a note pointing at the actual control (the Years competed / Year played field) that determines them. The current year's chip is highlighted on Players' Years-competed list so the connection is visible at a glance. No new migration — this only removes code, not columns.

**Bug fix**: Player Edit was throwing "Can't find variable: updatePlayerHandicap" — the function existed in `api.js` and was called, but never actually imported into `AppShell.jsx`. One-line fix.

**Players: handicap is now explicitly per-year.** Editing Name/Hometown/Bio is its own small form, unchanged in spirit — those stay single values, not tied to any year. Handicap Index is gone from that form entirely; in its place, each player's expanded card has a **"Handicap by year"** list — same row pattern as Year settings (Year on the left, an editable value on the right), one row per real year in the database, live-loaded the first time you expand that player and saved per-row via the now-fixed `updatePlayerHandicap`. Editing the *current* year's row also updates the flat `handicapIndex` the rest of the app reads (Score entry, leaderboards, etc.); editing a past year's history doesn't touch anything live. New player "Handicap index" field now says which year it's for.

**Admin → Import results now supports three templates** — Scores (existing), **Players**, and **Courses**, switchable via tabs at the top:
- **Players template**: Name, Hometown, Bio, Year, Handicap Index, Competing. Matches existing players by name — updates their info and that year's handicap if found, creates a new player if not.
- **Courses template**: Name, Tee, Rating, Slope, Holes (9/18), then Par/Yardage/Handicap for holes 1–18. Only creates *new* course-tees — an existing name+tee combo is skipped rather than risking overwritten hole data.

**Admin → Round-Course settings renamed to "Round setup"** and restructured: each round now has three checkboxes — **Solo / Team / Carroll Cup** — for which competitions that round's scores roll up into. This required a real schema addition: `rounds.counts_for_solo` (migration `10_counts_for_solo.sql`), joining the `counts_for_team`/`counts_for_carroll_cup` columns added last session.

**Admin → Matchup setup simplified** — the "Counts toward Team"/"Counts toward Carroll Cup" checkboxes moved out (now live on Round setup, one setting per round instead of duplicated per matchup). Also matches Team setup and Round setup: "+Add year" removed from both Matchup setup and Team setup — year creation lives solely on Year settings now, to avoid three different places that could each spawn events out of sync.

**Players and Courses got wireframe multi-year toggles** ("Years competed" / "Years played", 2022–2025) — same interaction pattern as the existing "Competing this year" toggle, but not yet persisted to Supabase, per request (UI first, backend later).

**Admin → Courses**: courses now have an "Active this year" flag (same pattern as players' "Competing this year"), and **Round-Course settings' course dropdown filters to only active courses** — a course from a prior year won't clutter the picker unless it's still flagged active. A round already pointing at a now-inactive course still shows correctly (labeled "inactive this year") rather than silently breaking.

**Admin → Matchup setup was restructured**: matchups are now grouped under their round (matching how it worked before the Round-Course/Matchup split), with **"Counts toward Team competition" and "Counts toward Carroll Cup" moved to the round level** instead of per-matchup — every matchup in a round shares one setting now, so they can't drift out of sync with each other. Matchup rows are labeled Home team / Away team. This moved the two flags from `round_matchups` to `rounds` in the schema (migration `09_team_setup_and_matchup_rework.sql`) — the old columns on `round_matchups` are left in place, unused, non-destructive.

## Setting up real accounts (Auth + Roles)

Three migrations, run in order, plus one dashboard step — no code to write.

**1. Run `sql/25_auth_player_linking.sql`.** Adds `players.auth_user_id`, plus helper functions. Safe to run any time — doesn't restrict anything by itself.

**2. Run `sql/27_roles.sql`.** Adds `players.role` ('admin' / 'player' / 'viewer', defaulting to 'player') and updates the helper functions to use it. Also safe to run any time on its own.

**3. Make your own account an admin.** Once you've invited and claimed your own profile (next step), either use Admin → Roles in the app once you can reach it, or run this once in the SQL editor, swapping in your name:
```sql
update players set role = 'admin' where name = 'Your Name';
```

**4. Invite people — from the Supabase Dashboard, not the app.** Authentication → Users → **Invite user** → enter their email. This is deliberate: sending invites requires the service-role key, which must never live in client-side code, so there's no "send invite" button in the app itself. Each invited person gets an email with a link.

**5. What happens when they click it:** the app detects the invite link, shows a "set your password" screen, then a one-time "which player are you?" screen that links their account to their player row. After that, they just sign in normally. New players default to the "player" role — use Admin → Roles afterward to switch anyone to "viewer" (not competing this year) or "admin" (helps run things).

**6. Don't run `sql/26_row_level_security.sql` yet.** Test the full invite → set password → claim → sign-in flow first, with at least one admin account confirmed working. RLS is what actually enforces the role rules (admin = anything, player = only their own scores, viewer = read-only) — before it's on, that's just documented intent, and the Admin → Roles screen is a UX nicety, not real enforcement. Once RLS is on, the anon key alone can't read or write anything without a signed-in user, so if nobody has an admin role yet, you'd lock yourself out of Admin. Run it only once you're confident login + role assignment works end to end.

**Demo/local mode is untouched** — with no `.env` configured, the app skips the whole login flow and runs on the built-in mock data, same as always.



## Deploying it for real testing with the group

Once you're happy testing locally:

1. Push this folder to a GitHub repo.
2. Import it in Vercel or Netlify (either connects directly to GitHub).
3. Add the same two `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` values as environment variables in the hosting dashboard.
4. Deploy — you'll get a real URL to share with the group.

No changes to the code are needed for that step; it's the same build either way.
