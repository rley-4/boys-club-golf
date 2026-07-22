# BCO Golf — Refactor Plan

A prioritized, actionable plan to slim down the codebase and make it easy to
maintain by hand and by AI coding agents. Every task is scoped to be
**behavior-preserving** unless explicitly noted.

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

- [ ] **Selects (3 implementations → 1):** `FormSelect` (line 3173),
      `LightSelect` (line 2901), and the `.bco-select` CSS class.
- [ ] **Inputs → 1:** `FormInput` (line 7318) + **17 raw `<input>`** scattered inline.
- [ ] **Buttons → small variant set:** **105 raw `<button>`** plus
      `.bco-save-btn`, `.bco-nav-btn`, `.bco-step-btn`.
- [ ] **`<ScreenHeader title onBack/>`:** the `ChevronLeft` + title header is
      duplicated across **20 screens** (55 `onBack` props).
- [ ] **Badges → 1 `Pill`:** `StatusBadge`, `ProgressBadge`, `PointsBadge`, `YearPill`.
- [ ] **Stat tiles → 1 `StatTile` (with variants):** `StatBlock`, `TotalStat`,
      `StrokeBubble`, `HcpBubble`.
- [ ] **Admin menus:** `AdminSetupMenu` / `AdminResultsMenu` +
      `AdminIconButton` / `AdminIconRow` — make data-driven from a config array.

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

## P2 — Split `AppShell.jsx` into a file tree

**Why:** biggest win for "editable by AI agents" — an agent editing the poker
panel should load ~220 lines, not 9,960. The file already has clean internal
seams (each tab/screen is its own component); this is mostly *moving* them.

### Target structure

```
src/
  data/seed.js               # PLAYERS, COURSES, TEAMS, WIREFRAME_YEARS (106–362, 8088+)
  hooks/useYearRoundData.js  # (line 8453)
  lib/format.js              # ordinal, fmtDiff, fmtStat, scoreLabel, scoreTone, diffTone
  components/                # shared primitives from P0
  screens/
    ScoreEntry.jsx                 # 871–1783
    Messages.jsx                   # 1880–2101
    More.jsx                       # 2930–3067
    Games/                         # GamesTab, Poker/Skins/Ctp/LowNet panels
    Leaderboard/                   # Leaderboard, Solo/Team/CarrollCup tables, scorecards
    MatchResults.jsx               # 8151–9475
  admin/
    settings/                      # Roles, Year, TeamSetup, RoundSetup, MatchupSetup, Games, Competition
    ImportResults.jsx  ExportResults.jsx
    PlayersScreen.jsx  CoursesScreen.jsx
  RecordBook/
  AppShell.jsx               # shell only: nav, ThemeProvider, tab routing (~150 lines)
```

Target: ~40 files of 50–400 lines instead of one 9,960-line file.

### Tasks

- [ ] Move seed data to `src/data/seed.js` **first** (many components import it).
- [ ] Extract format/helper functions to `src/lib/format.js`.
- [ ] Move each screen/admin component to its own file, updating imports.
- [ ] Reduce `AppShell.jsx` to the shell + tab routing.

### ⚠️ Risk note

Module-level **mutable** arrays/objects (`PLAYERS`, `COURSES`,
`ROUND_ID_BY_LABEL`, `ROUND_COURSE`, `ROUND_FLAGS`, `ROUND_FORMATS`,
`SCORE_ROUNDS`) are hydrated in place by `App.jsx` and `refreshRoundMap`, and
imported by many components. Keep them in `data/seed.js` and import from there
so the split stays behavior-preserving. **Do not** convert them to React
state as part of this step (see P3).

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
3. **P1 — MUI adoption** (theme-driven, incremental)
4. **P2 — split `AppShell.jsx`** (seed data → helpers → screens → shell)
5. **P3 — hygiene / state model**

Steps 1–2 alone remove most of the 778 inline styles and the duplication.
