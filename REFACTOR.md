# BCO Golf — Refactor Plan

A prioritized, actionable plan to slim down the codebase and make it easy to
maintain by hand and by AI coding agents. Every task is scoped to be
**behavior-preserving** unless explicitly noted.

> For the current directory layout and routing structure (i.e. where things
> ended up, not the plan to get there), see the **Architecture** section in
> `README.md`. This file stays focused on what changed and why.

## The core problem

The app logic is well-organized *except* for one file:

- `src/AppShell.jsx` is **9,960 lines** (~83% of all source), holding **~70
  components**, **778 inline `style={{}}` objects**, **46 distinct hardcoded hex
  colors**, and a full copy of the seed data.
- MUI is already a dependency but barely used: **3 `sx` uses vs 778 inline
  styles**. `theme.js` exists but is bypassed by hardcoded literals.

Everything below flows from fixing that one file. The data layer
(`lib/api.js`, `lib/stats.js`), auth screens, and SQL migrations are healthy and
mostly left alone.

---

## Priority legend

- **P0** — do first; low-risk, behavior-preserving, unlocks everything else.
- **P1** — high impact, moderate effort.
- **P2** — larger structural change, do after P0/P1.
- **P3** — nice-to-have / ongoing hygiene.

---

## P0 — Centralize design tokens

**Why:** the same hex values are copy-pasted hundreds of times despite
`theme.js` existing. One place to change instead of 129.

Current literal usage in `AppShell.jsx`:

| Color | Count | Meaning | Already in theme? |
|---|---|---|---|
| `#1B4332` | 129 | primary green | yes (`primary.main`) |
| `#8A8371` | 111 | muted label text | no |
| `#6B6455` | 62 | secondary text | yes (`text.secondary`) |
| `#FFFFFF` | 62 | paper / white | partial |
| `#B4AE9E` | 58 | disabled text | yes (`text.disabled`) |
| `#2C2A22` | 55 | primary text | yes (`text.primary`) |
| `#E4DFCE` | 47 | divider | yes (`divider`) |
| `#DCD6C4` | 36 | input border | no |
| `#F3EFE2` | 34 | contrast/paper | yes (`primary.contrastText`) |
| `#DCEFE3` | 16 | chip/success bg | no |

### Tasks

- [x] Expand `src/theme.js` palette so every recurring color is a token.
- [x] Add a custom `theme.bco` namespace for golf-specific tones (chip greens,
      banner colors, muted labels, input borders) and fonts (`Fraunces`,
      `IBM Plex Mono`, `Inter`).
- [x] Register the app fonts through the theme/typography instead of the
      `@import` inside `SHARED_STYLES`. (Fonts now load via a `<link>` in
      `index.html`, kept in sync with `theme.bco.fonts`; the duplicate
      `@import`s in `AppShell.jsx` and `LoginScreen.jsx` were removed.)
- [ ] Replace hardcoded hex literals with theme tokens as components are
      touched (bulk-driven by later steps, not a separate sweep).

---

## P0 — Extract shared primitives + collapse duplicates

**Why:** several near-identical implementations exist. Each should become
**one** shared component in `src/components/`. This removes the bulk of the 778
inline styles and the duplication in a single pass.

### Duplicates to collapse

- [x] **Selects (3 implementations → 1):** `FormSelect` (line 3173),
      `LightSelect` (line 2901), and the `.bco-select` CSS class. (`LightSelect`
      turned out to be dead code — deleted. `FormSelect` moved to
      `src/components/FormSelect.jsx`. The `.bco-select` CSS class is a
      differently-shaped dark-background select used only in the score-entry
      header bar; left as-is rather than force it into `FormSelect`'s shape.)
- [x] **Inputs → 1:** `FormInput` (line 7318) + **17 raw `<input>`** scattered inline.
      (`FormInput` moved to `src/components/FormInput.jsx` and now covers every
      settings/admin text field; the raw `<input>`s that remain are the
      dark-header score/net-score inputs and CSV file pickers, which aren't the
      same control and are left for the P1 MUI `TextField` pass.)
- [x] **Buttons → small variant set:** **105 raw `<button>`** plus
      `.bco-save-btn`, `.bco-nav-btn`, `.bco-step-btn`. (Added
      `src/components/Button.jsx` with `save`/`nav`/`step` variants and swapped
      every call site that used those three CSS classes. The one save-button
      with conditional styling (score-entry Submit button) and the ~90 other
      one-off inline-styled buttons are deferred to the P1 MUI `Button`
      migration, where they get replaced outright instead of re-wrapped twice.)
- [x] **`<ScreenHeader title onBack/>`:** the `ChevronLeft` + title header is
      duplicated across **20 screens** (55 `onBack` props). (Added
      `src/components/ScreenHeader.jsx` with `large`/`compact` variants; all 19
      call sites converted.)
- [x] **Badges → 1 `Pill`:** `StatusBadge`, `ProgressBadge`, `PointsBadge`, `YearPill`.
      (Added `src/components/Pill.jsx`; the four components are now thin
      wrappers around it so none of their call sites needed to change.)
- [x] **Stat tiles → 1 `StatTile` (with variants):** `StatBlock`, `TotalStat`,
      `StrokeBubble`, `HcpBubble`. (Added `src/components/StatTile.jsx` with a
      `variant` prop; same thin-wrapper approach as `Pill`.)
- [x] **Admin menus:** `AdminSetupMenu` / `AdminResultsMenu` +
      `AdminIconButton` / `AdminIconRow` — make data-driven from a config array.
      (Both menus now render from `ADMIN_SETUP_SECTIONS` / `ADMIN_RESULTS_SECTIONS`
      config arrays via a shared `AdminMenu`.)

### New home

```
src/components/
  ScreenHeader.jsx
  FormSelect.jsx
  FormInput.jsx
  Button.jsx        # variants: primary/nav/step
  Pill.jsx
  StatTile.jsx
  Banner.jsx
```

---

## P2 — Split `AppShell.jsx` into a file tree

**Why:** biggest win for "editable by AI agents" — an agent editing the poker
panel should load ~220 lines, not 9,960. The file already has clean internal
seams (each tab/screen is its own component); this is mostly *moving* them.
Promoted ahead of P1 — see the reorder note above.

**Status: done.** `AppShell.jsx` is now 334 lines — `ThemeProvider`, the
`TABS` config, `SHARED_STYLES`, and the `activeTab` switch that renders each
screen. Every screen/admin component now lives in its own file under
`src/screens/`, `src/admin/`, `src/components/`, or `src/lib/`.

> **Update (post-routing work):** `src/admin/` was subsequently moved to
> `src/screens/admin/` — admin is just more route-mounted screens, so it now
> lives alongside the rest of `screens/` instead of as a sibling top-level
> folder. The tree below reflects the structure *as of the P2 split*; see
> `README.md`'s Architecture section for the current layout.

### Target structure

```
src/
  data/dummyData.js          # PLAYERS, COURSES, TEAMS, WIREFRAME_YEARS, + ROUND_* mutable maps (done)
  hooks/useYearRoundData.js  # (done)
  lib/format.js              # ordinal, fmtDiff, fmtStat, scoreLabel, scoreTone, diffTone (done)
  lib/handicap.js            # calcCourseHandicap, strokesForHole, computeMatchPops(Live) (done)
  components/                # shared primitives from P0, + YearRoundPicker.jsx (done)
  screens/
    ScoreEntry.jsx                 # done
    Messages.jsx                   # done
    More.jsx                       # done
    Games.jsx                      # done — GamesTab, Poker/Skins/Ctp/LowNet panels
    MatchResults.jsx               # done — MatchResultsTab + progress/side/row helpers
    Leaderboard/                   # done — index.jsx, SoloTable.jsx, TeamTable.jsx,
                                    #  CarrollCupTable.jsx, MatchScorecard.jsx, tiebreak.js
  admin/
    settings/                      # done — Roles, Year, TeamSetup, RoundSetup, MatchupSetup, GamesSetup/Results, CompetitionSetup/Results
    ImportResults.jsx  ExportResults.jsx   # done
    AdminMenus.jsx                         # done — AdminSetupMenu/AdminResultsMenu/AdminMenu + config
    PlayersScreen.jsx  CoursesScreen.jsx   # done
  screens/RecordBook.jsx      # done
  AppShell.jsx               # shell only: nav, ThemeProvider, tab routing — done, 334 lines
```

Target: ~40 files of 50–400 lines instead of one 9,960-line file. Progress:
9960 → 9443 (seed data, external commit) → 8120 → 6472 → 4219 → 334 lines. **P2 complete.**

### Tasks

- [x] Move seed data to `src/data/dummyData.js` **first** (many components
      import it). (Named `dummyData.js` rather than `seed.js` — matches the
      comment header already in the file describing it as wireframe/demo data.)
- [x] Extract format/helper functions to `src/lib/format.js`.
- [x] Extract `useYearRoundData` to `src/hooks/useYearRoundData.js`.
- [x] Extract `YearPill`/`YearRoundPicker`/`RoundPicker` to
      `src/components/YearRoundPicker.jsx`.
- [x] Move `MessagesScreen` to `src/screens/Messages.jsx`.
- [x] Move `GamesTab` + Poker/Skins/Ctp/LowNet panels to `src/screens/Games.jsx`.
- [x] Extract shared `FormField` to `src/components/FormField.jsx` (used by
      ~30 admin forms).
- [x] Move `PlayersScreen` to `src/admin/PlayersScreen.jsx`.
- [x] Move `CoursesScreen` (+ `defaultHoles`/`validateHoles`) to
      `src/admin/CoursesScreen.jsx`.
- [x] Extract shared yearly-stats helpers (`soloRecordsSorted`,
      `teamRecordsSorted`, `seededRand`, `attendedYears`, `yearlySoloStat`,
      `yearlyTeamStat` — used by both Record Book and Export) to
      `src/lib/yearlyStats.js`.
- [x] Move `RecordBook` (+ `EarningsTable`) to `src/screens/RecordBook.jsx`.
- [x] Extract shared admin-settings chrome to `src/components/`
      (`SettingsSection`, `RemoveButton`/`AddRowButton`,
      `RecalcRow`/`LastCalculatedNote`/`RecalculateControl`,
      `AutoComputedNote`) and `formatCalculatedAt` to `lib/format.js`.
- [x] Move all nine admin `settings/*` screens to `src/admin/settings/`:
      Roles, Year, TeamSetup, RoundSetup, MatchupSetup, GamesSetup,
      GamesResults, CompetitionSetup, CompetitionResults. Along the way,
      fixed a real bug (`AutoComputedNote` was an undefined reference in
      several of these screens after the earlier Games extraction — same-file
      function hoisting had been masking it) and deleted a dead
      `COMPETITION_LABELS` constant.
- [x] Move `ImportResults`/`ExportResults` to `src/admin/ImportResults.jsx` /
      `src/admin/ExportResults.jsx`.
- [x] Move `AdminSetupMenu`/`AdminResultsMenu`/`AdminMenu` +
      `AdminIconButton`/`AdminIconRow`/`GolfClubIcon` + the
      `ADMIN_SETUP_SECTIONS`/`ADMIN_RESULTS_SECTIONS` config to
      `src/admin/AdminMenus.jsx`.
- [x] Move `More` to `src/screens/More.jsx`.
- [x] Move `ScoreEntry` (+ local `StatusBadge`/`StrokeBubble`/`HcpBubble`/
      `TotalStat` helpers) to `src/screens/ScoreEntry.jsx`, and its
      handicap math (`calcCourseHandicap`, `strokesForHole`,
      `computeMatchPops`, `computeMatchPopsLive`) to `src/lib/handicap.js`.
- [x] Move `Leaderboard` + `SoloTable`/`TeamTable`/`CarrollCupTable` +
      scorecards/tiebreak helpers to `src/screens/Leaderboard/`.
- [x] Move `MatchResultsTab` (+ `computeMatchProgress`/`ProgressBadge`/
      `MatchTeamSide`/`PlayerRow`) to `src/screens/MatchResults.jsx`.
- [x] Reduce `AppShell.jsx` to the shell + tab routing (4219 → 334 lines).

### ⚠️ Risk note

Module-level **mutable** arrays/objects (`PLAYERS`, `COURSES`,
`ROUND_ID_BY_LABEL`, `ROUND_COURSE`, `ROUND_FLAGS`, `ROUND_FORMATS`,
`SCORE_ROUNDS`) are hydrated in place by `App.jsx` and `refreshRoundMap`, and
imported by many components. Keep them in `data/dummyData.js` and import from
there so the split stays behavior-preserving. **Do not** convert them to
React state as part of this step (see P3).

---

## P1 — Adopt MUI where it replaces hand-rolled UI

**Why:** MUI is already installed but used in exactly one spot
(`BottomNavigation` + `Paper`). Doing this **theme-driven** (after P0) keeps the
look identical while deleting styling code and gaining accessibility. Build the
P0 primitives on top of these where practical.

| Hand-rolled now | MUI replacement | Wins |
|---|---|---|
| `<select>` ×11 + 3 impls | `Select` / `TextField select` | styling, a11y, keyboard |
| `<input>` ×17 + `FormInput` | `TextField` | labels, validation, errors |
| `<button>` ×105 | `Button` / `IconButton` | variants, disabled, ripple |
| 13 `<table>` + `.bco-table` | `Table` family | sticky headers, less markup |
| `StatusBadge` / pills | `Chip` | color/size built in |
| custom modals/confirms | `Dialog` | focus trap, escape, a11y |
| `.bco-seg` toggles | `ToggleButtonGroup` | state handling |
| `Banner` | `Alert` | severity tones |
| sidebar/spacing flex divs | `Stack` / `Box` | fewer inline flex styles |

Reference: `.cursor/rules/mui-and-styling.mdc` (links MUI component/API/`sx`/theming docs).

### Tasks

- [ ] Migrate the P0 primitives to wrap MUI equivalents.
- [ ] Swap tables to the MUI `Table` family.
- [ ] Replace custom modals/confirms with `Dialog`.
- [ ] Replace `Banner` with `Alert`, segmented toggles with `ToggleButtonGroup`.

---

## P3 — Ongoing hygiene / longer-term

- [ ] Replace the in-place mutation of module-level arrays (`PLAYERS`,
      `COURSES`, `ROUND_*`) with React context/state. Larger behavior change —
      do only after P2 lands and is verified.
- [ ] Consolidate tiny one-off helpers into `lib/format.js` rather than
      scattering or over-splitting them.
- [ ] Delete `SHARED_STYLES` CSS-in-JS once its rules are absorbed into the
      theme + MUI components.

### Explicitly leave alone

- `lib/api.js` (817 lines) and `lib/stats.js` (445) — cohesive data layers.
- Auth screens (`LoginScreen`, `SetPasswordScreen`, `ClaimProfileScreen`) —
  appropriately sized and separated; do not merge.
- SQL migration numbering — keep as-is.

---

## Suggested execution order

1. **P0 — theme tokens** (no behavior change, low risk)
2. **P0 — shared primitives + collapse duplicates**
3. **P2 — split `AppShell.jsx`** (seed data → helpers → screens → shell)
4. **P1 — MUI adoption** (theme-driven, incremental)
5. **P3 — hygiene / state model**

Steps 1–2 alone remove most of the 778 inline styles and the duplication.

**Reordered 2026-07-21:** P2 (file split) was originally scheduled after P1
(MUI adoption), but the file split is the higher-leverage change for the
project's actual goal — a 9,960-line file is the thing making both humans
and AI agents slow to work in, not the lack of MUI components. Splitting
first also means the P1 MUI swaps happen in small, focused files instead of
one giant one. P1 is unaffected by this reorder — it's still theme-driven
and incremental, it just now lands on top of the split file tree.
