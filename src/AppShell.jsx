import React, { useState, useMemo, useRef, useEffect } from "react";
import Papa from "papaparse";
import { signOut } from "./lib/auth.js";
import {
  fetchSoloStandings,
  fetchSoloRoundTotals,
  fetchSoloRoundGrossTotals,
  fetchCarrollCupStandings,
  fetchCarrollCupRoundStandings,
  fetchCarrollCupMatchResults,
  fetchHoleNetScores,
  fetchTeamStandings,
  fetchTeamMatchTotals,
  fetchTeamHolePoints,
  fetchSkins,
  fetchPokerCards,
  fetchLowNetSolo,
  fetchLowNetTeam,
} from "./lib/stats.js";
import {
  fetchScoresForRound,
  upsertScores,
  upsertSubmission,
  clearScores,
  verifyRoundBelongsToEvent,
  fetchEventByYear,
  fetchPlayers,
  fetchEvents,
  fetchRounds,
  fetchPlayerYearPayouts,
  fetchCompetitionPayouts,
  fetchGrandTotalPayouts,
  fetchPayoutSnapshot,
  fetchPayoutSnapshotTimestamp,
  fetchSoloTiebreakDetail,
  fetchTeamTiebreakDetail,
  updatePlayer,
  updatePlayerHandicap,
  fetchAllPlayerCompetedYears,
  setPlayerCompetedYear,
  createPlayer,
  createCourse,
  createCourseHoles,
  fetchTeams,
  fetchTeamHoleResults,
  upsertTeamHoleResult,
  fetchRoundMatchups,
  createRoundMatchup,
  fetchCarrollCupRoster,
} from "./lib/api.js";
import { Flag, Trophy, Coins, MoreHorizontal, BookOpen, ChevronRight, Swords, User, Calendar, Users, Import, Upload, MessagesSquare } from "lucide-react";
import { ThemeProvider, Paper, BottomNavigation, BottomNavigationAction } from "@mui/material";
import theme from "./theme.js";
import { ScreenHeader } from "./components/ScreenHeader.jsx";
import { Pill } from "./components/Pill.jsx";
import { StatTile } from "./components/StatTile.jsx";
import { FormSelect } from "./components/FormSelect.jsx";
import { FormInput } from "./components/FormInput.jsx";
import { Banner } from "./components/Banner.jsx";
import { FormField } from "./components/FormField.jsx";
import { AutoComputedNote } from "./components/AutoComputedNote.jsx";
import { SettingsSection } from "./components/SettingsSection.jsx";
import { RemoveButton, AddRowButton } from "./components/RowButtons.jsx";
import { RecalcRow, LastCalculatedNote, RecalculateControl } from "./components/RecalculateControl.jsx";
import { Button } from "./components/Button.jsx";
import { scoreLabel, scoreTone, fmtDiff, fmtStat, diffTone, ordinal, formatCalculatedAt } from "./lib/format.js";
import { useYearRoundData } from "./hooks/useYearRoundData.js";
import { teamRecordsSorted, soloRecordsSorted, seededRand, attendedYears, yearlySoloStat, yearlyTeamStat, soloResults, teamResults } from "./lib/yearlyStats.js";
import { MessagesScreen } from "./screens/Messages.jsx";
import { GamesTab } from "./screens/Games.jsx";
import { PlayersScreen } from "./admin/PlayersScreen.jsx";
import { CoursesScreen } from "./admin/CoursesScreen.jsx";
import { RecordBook } from "./screens/RecordBook.jsx";
import { RolesSettings } from "./admin/settings/Roles.jsx";
import { YearSettings } from "./admin/settings/Year.jsx";
import { TeamSetupSettings } from "./admin/settings/TeamSetup.jsx";
import { RoundSetupSettings } from "./admin/settings/RoundSetup.jsx";
import { MatchupSetupSettings } from "./admin/settings/MatchupSetup.jsx";
import { GamesSetupSettings } from "./admin/settings/GamesSetup.jsx";
import { GamesResultsSettings } from "./admin/settings/GamesResults.jsx";
import { CompetitionSetupSettings } from "./admin/settings/CompetitionSetup.jsx";
import { CompetitionResultsSettings } from "./admin/settings/CompetitionResults.jsx";
import { YearPill, YearRoundPicker, RoundPicker } from "./components/YearRoundPicker.jsx";
import {
  COURSES,
  ROUND_COURSE,
  WIREFRAME_YEARS,
  PLAYERS,
  SOLO_STANDINGS,
  TEAM_STANDINGS,
  CARROLL_CUP_STANDINGS,
  CARROLL_CUP_TOTAL_POINTS,
  CARROLL_CUP_MATCHES_BY_ROUND,
  CARROLL_CUP_ROSTER_DEFAULT,
  TEAM_RECORDS,
  SOLO_RECORDS,
  RECORD_YEARS,
  TEAMS,
  MATCHES_BY_ROUND,
  SKINS_PREVIEW,
  POKER_PREVIEW,
  SCORE_ROUNDS,
  ROUND_ID_BY_LABEL,
  ROUND_FLAGS,
  ROUND_FORMATS,
} from "./data/dummyData.js";

export { COURSES, ROUND_COURSE, WIREFRAME_YEARS, PLAYERS, SCORE_ROUNDS, ROUND_ID_BY_LABEL, ROUND_FLAGS, ROUND_FORMATS };
// Score entry always writes to the current event year.
const CURRENT_YEAR = RECORD_YEARS[0];

// ---------------------------------------------------------------------------
// USGA Course Handicap formula:
// Course Handicap = Handicap Index x (Slope / 113) + (Course Rating - Par)
// rounded to the nearest whole number.
// BCO rule: no upper cap — players get every stroke their index earns them.
// ---------------------------------------------------------------------------
function calcCourseHandicap(handicapIndex, slope, rating, par) {
  const raw = handicapIndex * (slope / 113) + (rating - par);
  // No floor at 0 — a plus-handicap player (index below scratch, or a very
  // easy course relative to their index) genuinely has a negative course
  // handicap. Flooring it at 0 would make them indistinguishable from a
  // dead-scratch player, which understates how good they are relative to
  // the field. See strokesForHole for how a negative value is applied.
  return Math.round(raw);
}

// Distributes a handicap value across a course's holes. For a positive
// value: every hole gets a base number of strokes (floor(value /
// totalHoles)), and the hardest (value % totalHoles) holes get one
// additional stroke on top — this is what makes a course handicap above 18
// actually mean something.
//
// For a negative (plus-handicap) value, strokes are given back instead —
// same distribution logic, but starting from the EASIEST holes (the
// highest handicap rank number) rather than the hardest, per standard
// stroke-allocation convention. The return value is negative, so net =
// gross - strokeReceived correctly comes out HIGHER than gross on those
// holes (a plus player's net score is harder to beat than their gross).
function strokesForHole(handicapValue, handicapRank, totalHoles) {
  if (handicapValue == null || handicapValue === 0 || !totalHoles) return 0;
  if (handicapValue > 0) {
    const base = Math.floor(handicapValue / totalHoles);
    const remainder = handicapValue % totalHoles;
    return base + (handicapRank <= remainder ? 1 : 0);
  }
  const absValue = Math.abs(handicapValue);
  const base = Math.floor(absValue / totalHoles);
  const remainder = absValue % totalHoles;
  const extra = handicapRank > totalHoles - remainder ? 1 : 0;
  return -(base + extra);
}

// Match-play "Pops" — only meaningful in the context of a specific foursome
// (this player's team vs. their round's opponent team). The lowest course
// handicap among all 4 players is set to 0; everyone else is reduced by
// that same amount. This mirrors v_matchup_player_handicap in
// calculations.sql exactly. This is the offline/fallback version, using the
// mock TEAMS/MATCHES_BY_ROUND roster — see computeMatchPopsLive below for
// the real one, used whenever Score entry has loaded live teams/matchups.
function computeMatchPops(player, roundLabel, course, totalPar) {
  if (!player) return null;
  const team = TEAMS.find((t) => t.players.includes(player.name));
  if (!team) return null;
  const match = (MATCHES_BY_ROUND[roundLabel] || []).find((m) => m.teamA === team.name || m.teamB === team.name);
  if (!match) return null;
  const opponentName = match.teamA === team.name ? match.teamB : match.teamA;
  const opponent = TEAMS.find((t) => t.name === opponentName);
  if (!opponent) return null;

  const foursome = [...team.players, ...opponent.players]
    .map((name) => PLAYERS.find((p) => p.name === name))
    .filter(Boolean);
  if (foursome.length < 4) return null;

  const chs = foursome.map((p) => calcCourseHandicap(p.handicapIndex, course.slope, course.rating, totalPar));
  const minCH = Math.min(...chs);
  const playerCH = calcCourseHandicap(player.handicapIndex, course.slope, course.rating, totalPar);
  return playerCH - minCH;
}

// Same rule as computeMatchPops, but sourced from real teams/matchups
// (roundId is a real rounds.id, teams is [{id, name, players:[nameA,nameB]}]
// from fetchTeams, matchups is the fetchRoundMatchups() result).
function computeMatchPopsLive(player, roundId, teams, matchups, course, totalPar) {
  if (!player || !roundId) return null;
  const team = teams.find((t) => t.players.includes(player.name));
  if (!team) return null;
  const matchup = matchups.find((m) => m.roundId === roundId && (m.teamAId === team.id || m.teamBId === team.id));
  if (!matchup) return null;
  const opponentId = matchup.teamAId === team.id ? matchup.teamBId : matchup.teamAId;
  const opponent = teams.find((t) => t.id === opponentId);
  if (!opponent) return null;

  const foursome = [...team.players, ...opponent.players]
    .map((name) => PLAYERS.find((p) => p.name === name))
    .filter(Boolean);
  if (foursome.length < 4) return null;

  const chs = foursome.map((p) => calcCourseHandicap(p.handicapIndex, course.slope, course.rating, totalPar));
  const minCH = Math.min(...chs);
  const playerCH = calcCourseHandicap(player.handicapIndex, course.slope, course.rating, totalPar);
  return playerCH - minCH;
}

const MEDAL_TONES = {
  gold: { bg: "#F5E1A4", fg: "#7A5C0A" },
  silver: { bg: "#E4E4E4", fg: "#5A5A5A" },
  bronze: { bg: "#EAD0B3", fg: "#8A5A2B" },
};

const NET_DOUBLE_BOGEY = 2; // cap: net score can be at most par + 2

const TABS = [
  { key: "score", label: "Score", icon: Flag },
  { key: "leaderboard", label: "Leaderboard", icon: Trophy },
  { key: "matches", label: "Matches", icon: Swords },
  { key: "games", label: "Games", icon: Coins },
  { key: "messages", label: "Messages", icon: MessagesSquare },
  { key: "more", label: "More", icon: MoreHorizontal },
];

const SHARED_STYLES = `
  .bco-mono { font-family: 'IBM Plex Mono', monospace; }
  .bco-display { font-family: 'Fraunces', serif; }
  .bco-step-btn {
    width: 44px; height: 44px; border-radius: 999px;
    border: 1px solid #C9C2AC; background: #FFFFFF; color: #1B4332;
    font-size: 20px; font-weight: 600; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: transform 0.06s ease, background 0.15s ease;
  }
  .bco-step-btn:active { transform: scale(0.94); background: #F0EBDD; }
  .bco-nav-btn {
    border: none; background: transparent; color: #6B6455;
    font-size: 13px; font-weight: 600; letter-spacing: 0.02em;
    cursor: pointer; padding: 6px 10px; border-radius: 8px;
  }
  .bco-nav-btn:hover { background: #F0EBDD; }
  .bco-nav-btn:disabled { opacity: 0.3; cursor: default; }
  .bco-nav-btn:disabled:hover { background: transparent; }
  .bco-hole-chip {
    width: 30px; height: 30px; border-radius: 7px; border: 1px solid transparent;
    font-size: 11px; font-weight: 600; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
  }
  .bco-select {
    width: 100%; box-sizing: border-box;
    background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.25);
    border-radius: 8px; padding: 8px 12px; color: #F3EFE2; font-size: 14px;
    font-family: 'Inter', sans-serif; appearance: none;
  }
  .bco-select option { color: #2C2A22; }
  .bco-select-course { font-family: 'Fraunces', serif; font-weight: 600; font-size: 17px; }
  .bco-save-btn {
    width: 100%; border: none; border-radius: 10px; padding: 13px;
    font-size: 14px; font-weight: 600; cursor: pointer;
    font-family: 'Inter', sans-serif; letter-spacing: 0.01em;
    background: #1B4332; color: #F3EFE2;
  }
  .bco-save-btn:active { transform: scale(0.99); }
  .bco-chip-missing { border: 1px dashed #C9564F !important; }
  .bco-seg { display: flex; background: #EDEAE0; border-radius: 9px; padding: 3px; gap: 3px; }
  .bco-seg-btn {
    flex: 1; border: none; background: none; padding: 7px 0; border-radius: 7px;
    font-size: 12.5px; font-weight: 600; font-family: 'Inter', sans-serif; cursor: pointer;
    color: #6B6455;
  }
  .bco-seg-btn.active { background: #FFFFFF; color: #1B4332; }
  table.bco-table { width: 100%; border-collapse: collapse; }
  table.bco-table th {
    text-align: left; font-size: 10.5px; font-weight: 600; color: #8A8371;
    letter-spacing: 0.02em; padding: 0 6px 8px; border-bottom: 1px solid #E4DFCE;
  }
  table.bco-table td { padding: 9px 6px; border-bottom: 1px solid #EFEBDE; vertical-align: middle; }

  /* Responsive shell — fluid with the actual browser width, not a fixed
     toggle. Mobile fills the actual viewport edge-to-edge (100vw/100vh,
     never more — no page-level scroll of its own) with a fixed bottom
     nav; desktop keeps the centered card with a sidebar. */
  .bco-page-wrapper { padding: 0; min-height: 100vh; background: transparent; }
  .bco-shell {
    width: 100vw;
    height: 100vh;
    max-width: 100vw;
    max-height: 100vh;
    margin: 0;
    display: flex;
    flex-direction: column;
    font-family: 'Inter', system-ui, sans-serif;
    background: #FBF8F1;
    border: none;
    border-radius: 0;
    overflow: hidden;
  }
  /* Bottom padding here is what keeps the fixed MUI bottom nav (64px tall,
     plus any iOS home-indicator inset) from covering the last bit of
     content on every screen — every screen's content scrolls inside this
     div, so one padding rule here covers all of them. */
  .bco-shell-content { flex: 1; overflow-y: auto; padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px)); }
  .bco-sticky-header { position: sticky; top: 0; z-index: 10; background: #FBF8F1; }
  .bco-content-inner { max-width: none; margin: 0; height: 100%; }
  .bco-bottombar-mui { display: block; }
  .bco-score-header, .bco-score-footer { border-radius: 0; }
  .bco-sidebar { display: none; }

  @media (min-width: 768px) {
    .bco-shell {
      flex-direction: row;
    }
    .bco-shell-content { padding-bottom: 0; }
    .bco-sidebar {
      display: flex; flex-direction: column;
      width: 190px; flex-shrink: 0;
      border-right: 1px solid #E4DFCE; background: #F3EFE2;
      padding: 18px 10px;
      overflow-y: auto;
    }
    .bco-content-inner { max-width: 720px; margin: 0 auto; height: 100%; }
    .bco-bottombar-mui { display: none; }
    .bco-score-header, .bco-score-footer { border-radius: 14px; }
  }
`;

export default function AppShell({ initialYear, isLive = false, loadError = null, myPlayer = null } = {}) {
  const [activeTab, setActiveTab] = useState("score");
  // Shared across Score and Matches so match progress reflects live saves.
  // Key: "year-round-playerId" -> { entries: { [hole]: {strokes, putts} }, status: "in-progress" | "submitted" }
  const [scoresStore, setScoresStore] = useState({});
  // The event year everything gets saved under — configurable on Admin > Event settings.
  const [currentYear, setCurrentYear] = useState(initialYear ?? CURRENT_YEAR);
  // The current event's real database id — Players/Courses/Teams/Rounds admin
  // screens need this to know which event to write against.
  const [currentEventId, setCurrentEventId] = useState(null);
  // Bumped after ROUND_ID_BY_LABEL/ROUND_COURSE are re-hydrated below, purely
  // to force a re-render (mutating those shared objects doesn't trigger one
  // on its own). Admin screens also bump this after they add/edit/remove a
  // round or round-course assignment, so Score/Matches pick up the change
  // immediately instead of waiting for a year switch.
  const [roundMapVersion, setRoundMapVersion] = useState(0);
  const forceRoundMapRefresh = () => setRoundMapVersion((v) => v + 1);

  const refreshRoundMap = async () => {
    if (!isLive) return;
    try {
      const event = await fetchEventByYear(currentYear);
      Object.keys(ROUND_ID_BY_LABEL).forEach((k) => delete ROUND_ID_BY_LABEL[k]);
      Object.keys(ROUND_COURSE).forEach((k) => delete ROUND_COURSE[k]);
      Object.keys(ROUND_FLAGS).forEach((k) => delete ROUND_FLAGS[k]);
      Object.keys(ROUND_FORMATS).forEach((k) => delete ROUND_FORMATS[k]);
      setCurrentEventId(event ? event.id : null);
      if (event) {
        const rounds = await fetchRounds(event.id);
        const sorted = [...rounds].sort((a, b) => (a.round_order ?? 0) - (b.round_order ?? 0));
        SCORE_ROUNDS.length = 0;
        sorted.forEach((r) => {
          SCORE_ROUNDS.push(r.label);
          ROUND_ID_BY_LABEL[r.label] = r.id;
          const course = COURSES.find((c) => c.id === r.course_id);
          if (course) ROUND_COURSE[r.label] = course;
          ROUND_FLAGS[r.label] = {
            countsForSolo: r.counts_for_solo !== false,
            countsForTeam: r.counts_for_team !== false,
            countsForCarrollCup: r.counts_for_carroll_cup === true,
            appliesSkins: r.applies_skins !== false,
            appliesPoker: r.applies_poker !== false,
            appliesLowNet: r.applies_low_net !== false,
            appliesCtp: r.applies_ctp !== false,
          };
          ROUND_FORMATS[r.label] = r.play_format || "stroke";
        });

        // The "HI" badge, and who shows up as an available player in Score
        // entry, should always reflect whichever year is currently selected
        // on Year settings — both are recomputed here, not just at boot.
        try {
          const freshPlayers = await fetchPlayers(event.id);
          freshPlayers.forEach((fp) => {
            const existing = PLAYERS.find((p) => p.id === fp.id);
            if (existing) {
              existing.handicapIndex = fp.handicapIndex;
              existing.competing = fp.competing;
            }
          });
        } catch (err) {
          console.error("Failed to refresh player handicaps for", currentYear, err);
        }

        // A course is "active this year" exactly when it's the course
        // played in the currently-selected year — computed here rather
        // than stored, so it can never drift out of sync with
        // played_event_id.
        COURSES.forEach((c) => {
          c.isActiveThisYear = c.playedEventId === event.id;
        });
      } else {
        // No event for this year at all — nothing is "this year's" course,
        // and nobody's marked competing.
        COURSES.forEach((c) => {
          c.isActiveThisYear = false;
        });
        PLAYERS.forEach((p) => {
          p.competing = false;
        });
      }
      forceRoundMapRefresh();
    } catch (err) {
      console.error("Failed to load rounds for", currentYear, err);
    }
  };

  // Re-fetch which rounds belong to Current Year, and which course each maps
  // to, every time Current Year changes — not just once at boot. Without
  // this, saving after switching years would still write against whichever
  // year's round_id happened to be cached, defeating the point of scoping
  // saves by Round-Player-Year.
  useEffect(() => {
    if (!isLive) return;
    refreshRoundMap();
  }, [currentYear, isLive]);

  const screenContent = (
    <>
      {activeTab === "score" && (
        <ScoreEntry
          scoresStore={scoresStore}
          setScoresStore={setScoresStore}
          currentYear={currentYear}
          isLive={isLive}
          loadError={loadError}
          currentEventId={currentEventId}
          myPlayer={myPlayer}
        />
      )}
      {activeTab === "leaderboard" && <Leaderboard isLive={isLive} currentEventId={currentEventId} currentYear={currentYear} />}
      {activeTab === "matches" && <MatchResultsTab scoresStore={scoresStore} currentYear={currentYear} isLive={isLive} currentEventId={currentEventId} />}
      {activeTab === "games" && <GamesTab currentYear={currentYear} isLive={isLive} currentEventId={currentEventId} myPlayer={myPlayer} />}
      {activeTab === "messages" && <MessagesScreen isLive={isLive} myPlayer={myPlayer} />}
      {activeTab === "more" && (
        <More currentYear={currentYear} setCurrentYear={setCurrentYear} isLive={isLive} currentEventId={currentEventId} refreshRoundMap={refreshRoundMap} myPlayer={myPlayer} />
      )}
    </>
  );

  return (
    <ThemeProvider theme={theme}>
      <style>{SHARED_STYLES}</style>
      <div className="bco-shell">
        <div className="bco-sidebar">
          <div className="bco-display" style={{ fontSize: 17, fontWeight: 600, color: "#1B4332", padding: "0 10px", marginBottom: 18 }}>
            BCO Golf
          </div>
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  border: "none",
                  background: active ? "#DCEFE3" : "transparent",
                  color: active ? "#1B4332" : "#6B6455",
                  borderRadius: 8,
                  padding: "9px 10px",
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  cursor: "pointer",
                  fontFamily: "'Inter', sans-serif",
                  textAlign: "left",
                  marginBottom: 2,
                }}
              >
                <Icon size={17} strokeWidth={active ? 2.3 : 1.8} />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="bco-shell-content">
          <div className="bco-content-inner">{screenContent}</div>
        </div>

        <Paper
          elevation={3}
          className="bco-bottombar-mui"
          sx={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <BottomNavigation showLabels value={activeTab} onChange={(event, newValue) => setActiveTab(newValue)} sx={{ bgcolor: "#F3EFE2", height: 64 }}>
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.key;
              return (
                <BottomNavigationAction
                  key={t.key}
                  label={t.label}
                  value={t.key}
                  icon={<Icon size={20} strokeWidth={active ? 2.3 : 1.8} />}
                  sx={{
                    color: "#A39C89",
                    minWidth: 0,
                    padding: "6px 0",
                    fontFamily: "'Inter', sans-serif",
                    "&.Mui-selected": { color: "#1B4332" },
                    "& .MuiBottomNavigationAction-label": { fontSize: "10.5px !important", fontWeight: 600, fontFamily: "'Inter', sans-serif" },
                  }}
                />
              );
            })}
          </BottomNavigation>
        </Paper>
      </div>
    </ThemeProvider>
  );
}

// ---------------------------------------------------------------------------
// Score entry tab
// ---------------------------------------------------------------------------
function ScoreEntry({ scoresStore, setScoresStore, currentYear, isLive, loadError, currentEventId, myPlayer }) {
  const yr = useYearRoundData(isLive, currentYear);
  const [selectedPlayerId, setSelectedPlayerId] = useState(() => (myPlayer ? String(myPlayer.id) : ""));
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [teamOptionsList, setTeamOptionsList] = useState([]);
  const [teamHoleResults, setTeamHoleResults] = useState({}); // "teamId-hole" -> {netScore, points}
  const [teamSaveStatus, setTeamSaveStatus] = useState(null); // null | "saving" | "saved" | "error"
  const [selectedRound, setSelectedRound] = useState("R1");
  const [holeIndex, setHoleIndex] = useState(0);
  const [saveStatus, setSaveStatus] = useState(null); // null | "saved" | "no-player" | "missing" | "submitted"
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null); // null | "syncing" | "synced" | "sync-error"
  const [liveTeams, setLiveTeams] = useState(null); // null = use mock TEAMS
  const [liveMatchups, setLiveMatchups] = useState(null); // null = use mock MATCHES_BY_ROUND
  const [liveCarrollRoster, setLiveCarrollRoster] = useState(null); // null = use mock CARROLL_CUP_ROSTER_DEFAULT

  // Who's competing in whichever year is selected here — NOT the global
  // Current Year's .competing flag, since this screen has its own
  // independent year picker now. Using the global flag would show players
  // who didn't actually play the year being browsed.
  const [competedByPlayer, setCompetedByPlayer] = useState({}); // playerId -> [eventId, ...]

  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchAllPlayerCompetedYears();
        if (cancelled) return;
        const map = {};
        rows.forEach((r) => {
          if (!map[r.player_id]) map[r.player_id] = [];
          map[r.player_id].push(r.event_id);
        });
        setCompetedByPlayer(map);
      } catch (err) {
        console.error("Failed to load players' competed years:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive]);

  // Keep the selected round valid whenever the selected year's rounds load
  // or the year changes.
  useEffect(() => {
    if (!isLive) return;
    if (yr.rounds.length === 0) return;
    if (!yr.rounds.some((r) => r.label === selectedRound)) {
      setSelectedRound(yr.rounds[0].label);
      setHoleIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, yr.rounds]);

  // Real teams, that round's matchups, and the Carroll Cup roster — this is
  // what makes the Team badge, Carroll Cup badge, and Pops reflect whatever
  // is actually set up on Admin, instead of the placeholder roster. Scoped
  // to whichever year is selected here, not the global Current Year.
  useEffect(() => {
    if (!isLive || !yr.selectedEventId) {
      setLiveTeams(null);
      setLiveMatchups(null);
      setLiveCarrollRoster(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [dbTeams, dbMatchups, dbRoster] = await Promise.all([
          fetchTeams(yr.selectedEventId),
          fetchRoundMatchups(yr.selectedEventId),
          fetchCarrollCupRoster(yr.selectedEventId),
        ]);
        if (cancelled) return;
        setLiveTeams(
          dbTeams.map((t) => ({
            id: t.id,
            name: t.name,
            players: [PLAYERS.find((p) => p.id === t.player_a_id)?.name, PLAYERS.find((p) => p.id === t.player_b_id)?.name].filter(Boolean),
          }))
        );
        setLiveMatchups(dbMatchups);
        const rosterMap = {};
        dbRoster.forEach((r) => {
          rosterMap[r.player_id] = r.side;
        });
        setLiveCarrollRoster(rosterMap);
      } catch (err) {
        console.error("Failed to load live teams/matchups/roster:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, yr.selectedEventId]);

  // The round drives the course now — no separate course picker. Resolved
  // from this screen's own year selection (yr.rounds), not the global
  // SCORE_ROUNDS/ROUND_COURSE/ROUND_FORMATS — those track whatever year
  // Score entry writes to by default, which may not be the year being
  // browsed here. Falls back to the mock shape when offline.
  const liveRound = isLive ? yr.rounds.find((r) => r.label === selectedRound) : null;
  const course = isLive ? (liveRound ? COURSES.find((c) => c.id === liveRound.courseId) : null) || COURSES[0] : ROUND_COURSE[selectedRound] || COURSES[0];
  const playFormat = isLive ? liveRound?.playFormat || "stroke" : ROUND_FORMATS[selectedRound] || "stroke";
  const isNonStrokePlay = playFormat !== "stroke";
  const roundId = isLive ? liveRound?.id || null : ROUND_ID_BY_LABEL[selectedRound] || null;
  const teamRoundId = roundId;

  useEffect(() => {
    if (!isNonStrokePlay || !isLive || !currentEventId || !teamRoundId) return;
    let cancelled = false;
    (async () => {
      try {
        const [teams, results] = await Promise.all([fetchTeams(currentEventId), fetchTeamHoleResults(teamRoundId)]);
        if (cancelled) return;
        setTeamOptionsList(teams.map((t) => ({ value: t.id, label: t.name })));
        const map = {};
        results.forEach((r) => {
          map[`${r.team_id}-${r.hole_number}`] = { netScore: r.net_score, points: r.points };
        });
        setTeamHoleResults(map);
      } catch (err) {
        console.error("Failed to load team hole results:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isNonStrokePlay, isLive, currentEventId, teamRoundId]);

  const saveTeamHoleResult = async (holeNumber, field, value) => {
    if (!selectedTeamId) return;
    const key = `${selectedTeamId}-${holeNumber}`;
    const current = teamHoleResults[key] || { netScore: null, points: null };
    const next = { ...current, [field]: value === "" ? null : field === "netScore" ? Number(value) : Number(value) };
    setTeamHoleResults((prev) => ({ ...prev, [key]: next }));
    if (!isLive || !teamRoundId) return;
    setTeamSaveStatus("saving");
    try {
      await upsertTeamHoleResult(teamRoundId, Number(selectedTeamId), holeNumber, next);
      setTeamSaveStatus("saved");
    } catch (err) {
      console.error("Failed to save team hole result:", err);
      setTeamSaveStatus("error");
    }
  };

  const totalPar = useMemo(() => course.holes.reduce((s, h) => s + h.par, 0), [course]);

  const activePlayers = useMemo(() => {
    if (!isLive || !yr.selectedEventId) return PLAYERS.filter((p) => p.competing !== false);
    return PLAYERS.filter((p) => (competedByPlayer[p.id] || []).includes(yr.selectedEventId));
  }, [isLive, yr.selectedEventId, competedByPlayer]);
  const player = PLAYERS.find((p) => p.id === Number(selectedPlayerId)) || null;
  const storeKey = player ? `${yr.selectedYear}-${selectedRound}-${player.id}` : null;
  const record = storeKey ? scoresStore[storeKey] : null;
  const entries = record?.entries || {};
  const status = record?.status || null; // null | "in-progress" | "submitted"

  const courseHandicap = player ? calcCourseHandicap(player.handicapIndex, course.slope, course.rating, totalPar) : null;
  const matchPops = player
    ? liveTeams && liveMatchups
      ? computeMatchPopsLive(player, roundId, liveTeams, liveMatchups, course, totalPar)
      : computeMatchPops(player, selectedRound, course, totalPar)
    : null;

  // When live and the round exists in the backend, load whatever's already
  // saved for this player/round on selection — this is what makes "reload
  // the page and your progress is still there" actually testable.
  useEffect(() => {
    if (!isLive || !roundId || !player || !storeKey) return;
    let cancelled = false;
    (async () => {
      try {
        const loaded = await fetchScoresForRound(roundId, player.id);
        if (cancelled) return;
        setScoresStore((prev) => ({ ...prev, [storeKey]: loaded }));
      } catch (err) {
        console.error("Failed to load scores from Supabase:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, roundId, player?.id]);

  const hole = course.holes[holeIndex];
  const entry = entries[hole.number] || { strokes: null, putts: null };
  const strokeReceived = strokesForHole(courseHandicap, hole.handicap, course.holes.length);
  const matchStrokeReceived = strokesForHole(matchPops, hole.handicap, course.holes.length);

  const rawNet = entry.strokes != null ? entry.strokes - strokeReceived : null;
  const netCapValue = hole.par + NET_DOUBLE_BOGEY;
  const capApplied = rawNet != null && rawNet > netCapValue;

  const setEntry = (holeNumber, patch) => {
    if (!storeKey) return;
    setScoresStore((prev) => {
      const prevRecord = prev[storeKey] || { entries: {}, status: null };
      // An admin editing an already-submitted round is correcting a value,
      // not un-submitting it — status stays "submitted". A non-admin can't
      // reach this path at all once submitted (inputs are disabled), but
      // keeping the old revert-to-in-progress behavior here too as a
      // defensive fallback.
      const nextStatus =
        prevRecord.status === "submitted" ? (myPlayer?.role === "admin" ? "submitted" : "in-progress") : prevRecord.status || "in-progress";
      return {
        ...prev,
        [storeKey]: {
          status: nextStatus,
          entries: {
            ...prevRecord.entries,
            [holeNumber]: {
              strokes: prevRecord.entries[holeNumber]?.strokes ?? null,
              putts: prevRecord.entries[holeNumber]?.putts ?? null,
              ...patch,
            },
          },
        },
      };
    });
    setSaveStatus(null);
  };

  const adjustStrokes = (delta) => {
    const base = entry.strokes ?? hole.par;
    setEntry(hole.number, { strokes: Math.max(1, base + delta) });
  };
  const adjustPutts = (delta) => {
    const base = entry.putts ?? 0;
    setEntry(hole.number, { putts: Math.max(0, base + delta) });
  };

  const goTo = (i) => setHoleIndex(Math.min(course.holes.length - 1, Math.max(0, i)));

  const handleRoundChange = (round) => {
    setSelectedRound(round);
    setHoleIndex(0);
    setSaveStatus(null);
    setAttemptedSubmit(false);
  };

  const missingStrokes = useMemo(
    () => course.holes.filter((h) => entries[h.number]?.strokes == null).map((h) => h.number),
    [entries, course]
  );
  const missingPutts = useMemo(
    () => course.holes.filter((h) => entries[h.number]?.putts == null).map((h) => h.number),
    [entries, course]
  );
  const missingAny = useMemo(() => new Set([...missingStrokes, ...missingPutts]), [missingStrokes, missingPutts]);

  const totals = useMemo(() => {
    const sumRange = (holes) =>
      holes.reduce((sum, h) => {
        const s = entries[h.number]?.strokes;
        return s != null ? sum + s : sum;
      }, 0);
    const out = course.holes.slice(0, 9);
    const inn = course.holes.slice(9, 18);
    return {
      out: sumRange(out),
      inn: sumRange(inn),
      tot: sumRange(course.holes),
      parOut: out.reduce((s, h) => s + h.par, 0),
      parIn: inn.reduce((s, h) => s + h.par, 0),
      scoredOut: out.filter((h) => entries[h.number]?.strokes != null).length,
      scoredIn: inn.filter((h) => entries[h.number]?.strokes != null).length,
    };
  }, [entries, course]);

  const diff = entry.strokes != null ? entry.strokes - hole.par : null;
  const tone = diff != null ? scoreTone(diff) : null;

  // Once submitted, a non-admin can't change anything further — matches
  // what the RLS policy (sql/26) enforces at the database level once
  // that's turned on; this is the same rule applied client-side so the UI
  // is consistent even before RLS is live.
  const isAdmin = myPlayer?.role === "admin";
  const canEdit = status !== "submitted" || isAdmin;

  // Autosave — debounced so a burst of stroke/putt taps doesn't fire a
  // network call per click. Skipped entirely once locked (submitted, and
  // not an admin), and while there's nothing entered yet.
  const autosaveTimeout = useRef(null);
  useEffect(() => {
    if (!player || !storeKey || !isLive || !roundId) return;
    if (!canEdit) return;
    if (Object.keys(entries).length === 0) return;
    if (autosaveTimeout.current) clearTimeout(autosaveTimeout.current);
    autosaveTimeout.current = setTimeout(async () => {
      setSyncStatus("syncing");
      try {
        await upsertScores(roundId, player.id, entries);
        await upsertSubmission(roundId, player.id, status === "submitted" ? "submitted" : "in_progress");
        setSyncStatus("synced");
      } catch (err) {
        console.error("Autosave failed:", err);
        setSyncStatus("sync-error");
      }
    }, 800);
    return () => {
      if (autosaveTimeout.current) clearTimeout(autosaveTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, storeKey, player, roundId, isLive, canEdit]);

  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  const handleSubmitClick = () => {
    setAttemptedSubmit(true);
    if (!player) {
      setSaveStatus("no-player");
      return;
    }
    if (missingStrokes.length > 0 || missingPutts.length > 0) {
      setSaveStatus("missing");
      return;
    }
    setShowSubmitConfirm(true);
  };

  const handleConfirmSubmit = async () => {
    setScoresStore((prev) => ({ ...prev, [storeKey]: { ...prev[storeKey], status: "submitted" } }));
    setSaveStatus("submitted");
    setShowSubmitConfirm(false);

    if (isLive && roundId) {
      setSyncStatus("syncing");
      try {
        await upsertScores(roundId, player.id, entries);
        await upsertSubmission(roundId, player.id, "submitted");
        setSyncStatus("synced");
      } catch (err) {
        console.error("Failed to submit to Supabase:", err);
        setSyncStatus("sync-error");
      }
    }
  };

  // UX-level only, same as the Admin menu gating — the real enforcement is
  // RLS (sql/26), not this. Viewers can look at everything on this page,
  // just can't save.
  const isViewer = myPlayer?.role === "viewer";

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearStatus, setClearStatus] = useState(null); // null | "clearing" | "error"

  const handleClearScores = async () => {
    if (!player || !roundId || !canEdit) return;
    setClearStatus("clearing");
    try {
      if (isLive && yr.selectedEventId) {
        // Freshness check — the round this page loaded should still
        // actually belong to whichever year is selected here. Guards
        // against the admin having changed a round's setup since this page
        // was loaded (this app doesn't live-sync across sessions).
        const belongs = await verifyRoundBelongsToEvent(roundId, yr.selectedEventId);
        if (!belongs) {
          setClearStatus("error");
          return;
        }
        await clearScores(roundId, player.id);
      }
      setScoresStore((prev) => {
        const next = { ...prev };
        delete next[storeKey];
        return next;
      });
      setAttemptedSubmit(false);
      setSaveStatus(null);
      setShowClearConfirm(false);
      setClearStatus(null);
    } catch (err) {
      console.error("Failed to clear scores:", err);
      setClearStatus("error");
    }
  };

  const playerTeam = player ? (liveTeams || TEAMS).find((t) => t.players.includes(player.name)) : null;
  const carrollSide = player ? (liveCarrollRoster ? liveCarrollRoster[player.id] : CARROLL_CUP_ROSTER_DEFAULT[player.name]) : null;

  return (
    <div>
      {loadError && (
        <div style={{ margin: "12px 20px 0" }}>
          <Banner tone="error">Couldn't load live data from Supabase ({loadError}) — showing local demo data instead.</Banner>
        </div>
      )}
      <div className="bco-score-header bco-sticky-header" style={{ background: "#1B4332", color: "#F3EFE2", padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <select
            className="bco-mono"
            value={yr.selectedYear}
            onChange={(e) => yr.setSelectedYear(Number(e.target.value))}
            style={{
              fontSize: 11,
              fontWeight: 600,
              background: "rgba(255,255,255,0.14)",
              color: "#F3EFE2",
              border: "none",
              padding: "5px 8px",
              borderRadius: 6,
              flexShrink: 0,
            }}
          >
            {(yr.years.length > 0 ? yr.years : [currentYear]).map((y) => (
              <option key={y} value={y} style={{ color: "#2C2A22" }}>
                {y}
              </option>
            ))}
          </select>
          <select
            className="bco-select"
            value={selectedRound}
            onChange={(e) => handleRoundChange(e.target.value)}
            style={{ width: 66, padding: "5px 6px", fontSize: 13, fontWeight: 600, flexShrink: 0 }}
          >
            {(isLive && yr.rounds.length > 0 ? yr.rounds.map((r) => r.label) : SCORE_ROUNDS).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.3 }}>
            {course.name} — {course.tee} · <span className="bco-mono">{course.rating}/{course.slope}</span>
          </span>
        </div>

        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <select
            className="bco-select"
            value={selectedPlayerId}
            onChange={(e) => {
              setSelectedPlayerId(e.target.value);
              setSaveStatus(null);
            }}
            style={{ flex: 1, minWidth: 120 }}
          >
            <option value="" style={{ color: "#8A8371" }}>
              Select player…
            </option>
            {activePlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {player && (
            <>
              <span style={{ fontSize: 10.5, fontWeight: 600, background: "rgba(255,255,255,0.14)", padding: "4px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>
                {playerTeam?.name || "No team"}
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  padding: "4px 8px",
                  borderRadius: 6,
                  whiteSpace: "nowrap",
                  background: carrollSide === "red" ? "#F7DCDA" : carrollSide === "blue" ? "#DCE7F2" : "rgba(255,255,255,0.14)",
                  color: carrollSide === "red" ? "#8C2F2A" : carrollSide === "blue" ? "#26456B" : "#F3EFE2",
                }}
              >
                {carrollSide === "red" ? "Red" : carrollSide === "blue" ? "Blue" : "—"}
              </span>
            </>
          )}
        </div>

        {player && (
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            <HcpBubble label="HI" value={player.handicapIndex.toFixed(1)} />
            <HcpBubble label="CH" value={courseHandicap} />
            <HcpBubble label="Pops" value={matchPops ?? "–"} />
          </div>
        )}
      </div>

      {isNonStrokePlay ? (
        <div style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: 11.5, color: "#8A8371", marginBottom: 10 }}>
            {selectedRound} is a {playFormat === "scramble" ? "scramble" : "alternate shot"} round — team net score
            and hole points, entered manually.
          </div>
          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", border: "1px solid #DCD6C4", borderRadius: 8, padding: "9px 10px", fontSize: 13, fontFamily: "'Inter', sans-serif", marginBottom: 14 }}
          >
            <option value="">Select team…</option>
            {teamOptionsList.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          {selectedTeamId && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <Button variant="nav" onClick={() => goTo(holeIndex - 1)} disabled={holeIndex === 0}>
                  ← Prev
                </Button>
                <span style={{ fontSize: 12, color: "#8A8371", fontWeight: 600 }}>
                  Hole {hole.number} of {course.holes.length}
                </span>
                <Button variant="nav" onClick={() => goTo(holeIndex + 1)} disabled={holeIndex === course.holes.length - 1}>
                  Next →
                </Button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6455", marginBottom: 6 }}>NET SCORE</div>
                  <input
                    type="number"
                    value={teamHoleResults[`${selectedTeamId}-${hole.number}`]?.netScore ?? ""}
                    onChange={(e) => saveTeamHoleResult(hole.number, "netScore", e.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", border: "1px solid #DCD6C4", borderRadius: 8, padding: "10px", fontSize: 16, fontFamily: "'IBM Plex Mono', monospace", textAlign: "center" }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6455", marginBottom: 6 }}>HOLE POINTS</div>
                  <select
                    value={teamHoleResults[`${selectedTeamId}-${hole.number}`]?.points ?? ""}
                    onChange={(e) => saveTeamHoleResult(hole.number, "points", e.target.value)}
                    style={{ width: "100%", boxSizing: "border-box", border: "1px solid #DCD6C4", borderRadius: 8, padding: "10px", fontSize: 14, fontFamily: "'Inter', sans-serif" }}
                  >
                    <option value="">—</option>
                    <option value="1">1</option>
                    <option value="0.5">1/2</option>
                    <option value="0">0</option>
                  </select>
                </div>
              </div>

              {teamSaveStatus === "saving" && <div style={{ fontSize: 11, color: "#8A8371", marginTop: 10 }}>Saving…</div>}
              {teamSaveStatus === "error" && <div style={{ marginTop: 10 }}><Banner tone="error">Couldn't save — check console.</Banner></div>}
              {!isLive && <div style={{ fontSize: 11, color: "#B4AE9E", marginTop: 10 }}>Not connected — entries won't be saved.</div>}
            </>
          )}
        </div>
      ) : (
        <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px 0" }}>
        <Button variant="nav" onClick={() => goTo(holeIndex - 1)} disabled={holeIndex === 0}>
          ← Prev
        </Button>
        <span style={{ fontSize: 12, color: "#8A8371", fontWeight: 600 }}>
          {selectedRound} · Hole {hole.number} of {course.holes.length}
        </span>
        <Button variant="nav" onClick={() => goTo(holeIndex + 1)} disabled={holeIndex === course.holes.length - 1}>
          Next →
        </Button>
      </div>

      <div style={{ padding: "16px 20px 4px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto auto 1fr 1fr",
            alignItems: "center",
            gap: 10,
            padding: "14px 14px",
            background: capApplied ? "#FBEAEA" : "#FFFFFF",
            border: `1px solid ${capApplied ? "#EFC9C6" : "#E4DFCE"}`,
            borderRadius: 12,
          }}
        >
          <div className="bco-display" style={{ fontSize: 34, fontWeight: 600, color: "#1B4332", lineHeight: 1 }}>
            {hole.number}
          </div>

          <div style={{ fontSize: 11, color: "#8A8371", lineHeight: 1.6 }}>
            <div>
              Par <span className="bco-mono" style={{ fontWeight: 600, color: "#2C2A22" }}>{hole.par}</span>
            </div>
            <div>
              Yds <span className="bco-mono" style={{ fontWeight: 600, color: "#2C2A22" }}>{hole.yardage}</span>
            </div>
            <div>
              Hcp <span className="bco-mono" style={{ fontWeight: 600, color: "#2C2A22" }}>{hole.handicap}</span>
            </div>
          </div>

          {player ? (
            <>
              <StrokeBubble label="Solo" value={strokeReceived} />
              <StrokeBubble label="Match" value={matchStrokeReceived} unavailable={matchPops == null} />
            </>
          ) : (
            <div style={{ gridColumn: "span 2", fontSize: 11, color: "#B4AE9E", textAlign: "center" }}>Select a player to see strokes</div>
          )}
        </div>

        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6455", marginBottom: 6, letterSpacing: "0.02em", textAlign: "center" }}>STROKES</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <Button variant="step" style={{ width: 36, height: 36, fontSize: 17, opacity: canEdit ? 1 : 0.4 }} onClick={() => adjustStrokes(-1)} disabled={!canEdit} aria-label="Decrease strokes">
                −
              </Button>
              <div style={{ minWidth: 46, textAlign: "center" }}>
                <div className="bco-mono" style={{ fontSize: 26, fontWeight: 600, color: "#2C2A22" }}>
                  {entry.strokes ?? "–"}
                </div>
                <div style={{ marginTop: 3, minHeight: 18 }}>
                  <span
                    style={{
                      display: "inline-block",
                      visibility: tone ? "visible" : "hidden",
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "1px 7px",
                      borderRadius: 999,
                      background: tone?.bg,
                      color: tone?.fg,
                      border: `1px solid ${tone?.border || "transparent"}`,
                    }}
                  >
                    {tone ? scoreLabel(diff) : "Par"}
                  </span>
                </div>
              </div>
              <Button variant="step" style={{ width: 36, height: 36, fontSize: 17, opacity: canEdit ? 1 : 0.4 }} onClick={() => adjustStrokes(1)} disabled={!canEdit} aria-label="Increase strokes">
                +
              </Button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6455", marginBottom: 6, letterSpacing: "0.02em", textAlign: "center" }}>PUTTS</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <Button variant="step" style={{ width: 36, height: 36, fontSize: 17, opacity: canEdit ? 1 : 0.4 }} onClick={() => adjustPutts(-1)} disabled={!canEdit} aria-label="Decrease putts">
                −
              </Button>
              <div style={{ minWidth: 46, textAlign: "center" }}>
                <div className="bco-mono" style={{ fontSize: 26, fontWeight: 600, color: "#2C2A22" }}>
                  {entry.putts ?? "–"}
                </div>
                <div style={{ marginTop: 3, minHeight: 18 }} />
              </div>
              <Button variant="step" style={{ width: 36, height: 36, fontSize: 17, opacity: canEdit ? 1 : 0.4 }} onClick={() => adjustPutts(1)} disabled={!canEdit} aria-label="Increase putts">
                +
              </Button>
            </div>
          </div>
        </div>
      </div>


      <div style={{ padding: "20px 20px 8px" }}>
        {[course.holes.slice(0, 9), course.holes.slice(9, 18)].filter((row) => row.length > 0).map((row, rowI) => (
          <div key={rowI} style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 4, marginBottom: rowI === 0 ? 4 : 0 }}>
            {row.map((h) => {
              const idx = h.number - 1;
              const s = entries[h.number]?.strokes;
              const d = s != null ? s - h.par : null;
              const t = d != null ? scoreTone(d) : null;
              const active = idx === holeIndex;
              const isMissing = attemptedSubmit && missingAny.has(h.number);
              return (
                <button
                  key={h.number}
                  className={`bco-hole-chip${isMissing ? " bco-chip-missing" : ""}`}
                  onClick={() => goTo(idx)}
                  style={{
                    background: t ? t.bg : "#FFFFFF",
                    color: t ? t.fg : "#8A8371",
                    borderColor: active ? "#1B4332" : t ? t.border : "#E4DFCE",
                    borderWidth: active ? 2 : 1,
                  }}
                >
                  {h.number}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="bco-score-footer" style={{ display: "flex", justifyContent: "space-around", borderTop: "1px solid #E4DFCE", padding: "14px 20px", background: "#F3EFE2" }}>
        <TotalStat label="OUT" value={totals.scoredOut ? totals.out : "–"} sub={`par ${totals.parOut}`} />
        {course.holes.length > 9 && <TotalStat label="IN" value={totals.scoredIn ? totals.inn : "–"} sub={`par ${totals.parIn}`} />}
        <TotalStat label="TOTAL" value={totals.scoredOut + totals.scoredIn ? totals.tot : "–"} sub={`par ${totals.parOut + totals.parIn}`} emphasize />
      </div>

      <div style={{ padding: "4px 20px 20px" }}>
        {saveStatus === "no-player" && <Banner tone="error">Select a player before saving.</Banner>}
        {saveStatus === "missing" && (
          <Banner tone="error">
            {missingStrokes.length > 0 && (
              <div>
                Missing strokes on hole{missingStrokes.length > 1 ? "s" : ""} {missingStrokes.join(", ")}.
              </div>
            )}
            {missingPutts.length > 0 && (
              <div style={{ marginTop: missingStrokes.length > 0 ? 4 : 0 }}>
                Missing putts on hole{missingPutts.length > 1 ? "s" : ""} {missingPutts.join(", ")}.
              </div>
            )}
          </Banner>
        )}
        {saveStatus === "saved" && (
          <Banner tone="success">
            Progress saved for {player?.name} — {selectedRound}. Still shows as in-progress on Matches until submitted.
          </Banner>
        )}
        {saveStatus === "submitted" && (
          <Banner tone="success">
            {selectedRound} submitted as final for {player?.name} at {course.name}.
          </Banner>
        )}
        {syncStatus === "sync-error" && (
          <div style={{ marginTop: saveStatus ? 6 : 0 }}>
            <Banner tone="error">Autosave to Supabase failed — check console. Your entries are still kept locally.</Banner>
          </div>
        )}
        {status === "submitted" && !isAdmin && (
          <div style={{ marginTop: saveStatus || syncStatus === "sync-error" ? 6 : 0 }}>
            <Banner tone="info">Submitted — this can no longer be edited. Ask an admin if something needs fixing.</Banner>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "center", marginTop: 12, marginBottom: 8 }}>
          {player && <StatusBadge status={status} />}
        </div>

        {isViewer ? (
          <div style={{ fontSize: 12, color: "#8A8371", textAlign: "center", padding: "10px 0" }}>
            Viewer access — scores here are read-only.
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleSubmitClick}
              disabled={!canEdit}
              className={canEdit ? "bco-save-btn" : undefined}
              style={{ flex: 1, ...(canEdit ? {} : { border: "1px solid #DCD6C4", background: "#EFEBDE", color: "#B4AE9E", borderRadius: 10, padding: 13, fontSize: 14, fontWeight: 600, fontFamily: "'Inter', sans-serif", cursor: "default" }) }}
            >
              {status === "submitted" ? "Submitted" : "Submit"}
            </button>
            <button
              onClick={() => setShowClearConfirm(true)}
              disabled={!player || !canEdit}
              aria-label="Clear scores for this round"
              style={{
                flex: 1,
                border: "1px solid #DCC6C2",
                borderRadius: 10,
                padding: "13px 14px",
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "'Inter', sans-serif",
                background: "#FBF3F1",
                color: "#A3492E",
                cursor: player && canEdit ? "pointer" : "default",
                opacity: player && canEdit ? 1 : 0.5,
                whiteSpace: "nowrap",
              }}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {showSubmitConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(44, 42, 34, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 100,
          }}
        >
          <div style={{ background: "#FBF8F1", borderRadius: 14, padding: "20px 20px 18px", maxWidth: 320, width: "100%", boxShadow: "0 10px 40px rgba(0,0,0,0.25)" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1B4332", marginBottom: 6 }}>Submit {selectedRound} as final?</div>
            <div style={{ fontSize: 12.5, color: "#6B6455", lineHeight: 1.5, marginBottom: 16 }}>
              Once submitted, {player?.name}'s scores for this round can't be edited — only an admin will be able to
              change them.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setShowSubmitConfirm(false)}
                style={{ flex: 1, border: "1px solid #DCD6C4", background: "#FFFFFF", color: "#2C2A22", borderRadius: 8, padding: "10px 0", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSubmit}
                style={{ flex: 1, border: "none", background: "#1B4332", color: "#F3EFE2", borderRadius: 8, padding: "10px 0", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {showClearConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(44, 42, 34, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 100,
          }}
        >
          <div style={{ background: "#FBF8F1", borderRadius: 14, padding: "20px 20px 18px", maxWidth: 320, width: "100%", boxShadow: "0 10px 40px rgba(0,0,0,0.25)" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1B4332", marginBottom: 6 }}>Clear scores for {selectedRound}?</div>
            <div style={{ fontSize: 12.5, color: "#6B6455", lineHeight: 1.5, marginBottom: 16 }}>
              This removes every stroke and putt entered for {player?.name} on this round. This can't be undone.
            </div>
            {clearStatus === "error" && (
              <div style={{ marginBottom: 12 }}>
                <Banner tone="error">
                  Couldn't clear — this round no longer matches the current year. Refresh the page and try again.
                </Banner>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  setShowClearConfirm(false);
                  setClearStatus(null);
                }}
                style={{ flex: 1, border: "1px solid #DCD6C4", background: "#FFFFFF", color: "#2C2A22", borderRadius: 8, padding: "10px 0", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
              >
                Cancel
              </button>
              <button
                onClick={handleClearScores}
                disabled={clearStatus === "clearing"}
                style={{
                  flex: 1,
                  border: "none",
                  background: "#A3492E",
                  color: "#FBF3F1",
                  borderRadius: 8,
                  padding: "10px 0",
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'Inter', sans-serif",
                  opacity: clearStatus === "clearing" ? 0.7 : 1,
                }}
              >
                {clearStatus === "clearing" ? "Clearing…" : "Clear scores"}
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// More tab — settings hub. Currently houses Record Book and Admin; other
// management screens will get added here as their own menu rows.
// ---------------------------------------------------------------------------
function More({ currentYear, setCurrentYear, isLive, currentEventId, refreshRoundMap, myPlayer }) {
  const [view, setView] = useState("menu");
  // Not real security yet — that's what RLS (sql/26) is for. This just
  // keeps the menu honest about what a non-admin can actually do once RLS
  // is on. In demo/offline mode (no real accounts at all) everything stays
  // visible, same as before.
  const isAdmin = !isLive || myPlayer?.role === "admin";

  if (view === "recordbook") {
    return <RecordBook onBack={() => setView("menu")} isLive={isLive} myPlayer={myPlayer} />;
  }
  if (view === "players") {
    return <PlayersScreen onBack={() => setView("menu")} isLive={isLive} currentEventId={currentEventId} currentYear={currentYear} />;
  }
  if (view === "courses") {
    return <CoursesScreen onBack={() => setView("menu")} isLive={isLive} />;
  }
  if (view === "admin-setup") {
    return <AdminSetupMenu onBack={() => setView("menu")} onNavigate={setView} />;
  }
  if (view === "admin-results") {
    return <AdminResultsMenu onBack={() => setView("menu")} onNavigate={setView} />;
  }
  if (view === "admin-import") {
    return <ImportResults onBack={() => setView("admin-results")} isLive={isLive} />;
  }
  if (view === "admin-export") {
    return <ExportResults onBack={() => setView("admin-results")} isLive={isLive} currentEventId={currentEventId} />;
  }
  if (view === "admin-general") {
    return <YearSettings onBack={() => setView("admin-setup")} currentYear={currentYear} setCurrentYear={setCurrentYear} isLive={isLive} />;
  }
  if (view === "admin-roles") {
    return <RolesSettings onBack={() => setView("admin-setup")} isLive={isLive} />;
  }
  if (view === "admin-teams") {
    return <TeamSetupSettings onBack={() => setView("admin-setup")} isLive={isLive} currentYear={currentYear} />;
  }
  if (view === "admin-rounds") {
    return <RoundSetupSettings onBack={() => setView("admin-setup")} isLive={isLive} currentYear={currentYear} refreshRoundMap={refreshRoundMap} />;
  }
  if (view === "admin-matchups") {
    return <MatchupSetupSettings onBack={() => setView("admin-setup")} isLive={isLive} currentYear={currentYear} />;
  }
  if (view === "admin-games-setup") {
    return <GamesSetupSettings onBack={() => setView("admin-setup")} isLive={isLive} currentYear={currentYear} />;
  }
  if (view === "admin-games-results") {
    return <GamesResultsSettings onBack={() => setView("admin-results")} isLive={isLive} currentYear={currentYear} />;
  }
  if (view === "admin-competitions-setup") {
    return <CompetitionSetupSettings onBack={() => setView("admin-setup")} isLive={isLive} currentYear={currentYear} />;
  }
  if (view === "admin-competitions-results") {
    return <CompetitionResultsSettings onBack={() => setView("admin-results")} isLive={isLive} currentYear={currentYear} />;
  }

  const MENU_ITEMS = [
    { key: "recordbook", label: "Record Book", note: "All-time solo and team stats", icon: BookOpen, enabled: true },
    { key: "players", label: "Players", note: "Roster, bios, and handicap indexes", icon: Flag, enabled: true },
    { key: "courses", label: "Courses", note: "Course-tees and hole-by-hole data", icon: Trophy, enabled: true },
    { key: "admin-setup", label: "Admin Setup", note: "Roles, years, tournament, and money setup", icon: MoreHorizontal, enabled: isAdmin },
    { key: "admin-results", label: "Admin Results", note: "Computed payouts, plus import/export", icon: MoreHorizontal, enabled: isAdmin },
  ];

  return (
    <div style={{ padding: "18px 20px 24px" }}>
      <div className="bco-display" style={{ fontSize: 20, fontWeight: 600, color: "#1B4332", marginBottom: 14 }}>
        More
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => item.enabled && setView(item.key)}
              disabled={!item.enabled}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                textAlign: "left",
                background: "#FFFFFF",
                border: "1px solid #E4DFCE",
                borderRadius: 12,
                padding: "13px 14px",
                cursor: item.enabled ? "pointer" : "default",
                opacity: item.enabled ? 1 : 0.45,
                fontFamily: "'Inter', sans-serif",
              }}
            >
              <Icon size={18} strokeWidth={1.8} color="#1B4332" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "#2C2A22" }}>{item.label}</div>
                <div style={{ fontSize: 11, color: "#8A8371", marginTop: 1 }}>
                  {item.enabled ? item.note : item.key.startsWith("admin") ? "Organizer only" : `${item.note} — coming soon`}
                </div>
              </div>
              {item.enabled && <ChevronRight size={16} color="#B9B3A2" />}
            </button>
          );
        })}
      </div>

      {isLive && (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid #E4DFCE" }}>
          <div style={{ fontSize: 11.5, color: "#8A8371", marginBottom: 8 }}>
            {myPlayer ? `Signed in as ${myPlayer.name}` : "Signed in"}
          </div>
          <button
            onClick={() => signOut().then(() => window.location.reload())}
            style={{
              border: "1px solid #DCD6C4",
              background: "#FFFFFF",
              color: "#6B6455",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin menu — Import/Export, Event settings, and Game settings are real.
// ---------------------------------------------------------------------------
// lucide-react has no golf-specific icon — this matches its stroke style
// (24x24, round caps/joins) closely enough to sit next to the real ones.
function GolfClubIcon({ size = 18, strokeWidth = 1.8, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 3 L8 18" />
      <path d="M8 18 L12.5 20 L10.5 15.3 Z" />
      <circle cx="5.5" cy="20.5" r="1.4" fill={color} stroke="none" />
    </svg>
  );
}

function AdminIconButton({ label, icon: Icon, onClick, enabled = true }) {
  return (
    <button
      onClick={() => enabled && onClick()}
      disabled={!enabled}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        width: 82,
        padding: "12px 6px",
        background: "#FFFFFF",
        border: "1px solid #E4DFCE",
        borderRadius: 12,
        cursor: enabled ? "pointer" : "default",
        opacity: enabled ? 1 : 0.45,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 10, background: "#DCEFE3", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={19} strokeWidth={1.8} color="#1B4332" />
      </div>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "#2C2A22", textAlign: "center", lineHeight: 1.25 }}>{label}</div>
    </button>
  );
}

function AdminIconRow({ title, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "#8A8371", letterSpacing: "0.04em", marginBottom: 10, textTransform: "uppercase" }}>{title}</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

// Data-driven menu config — each Admin menu is just a list of titled rows
// of {label, icon, target} shown via `AdminIconRow`/`AdminIconButton`.
// Adding a new admin screen means adding one row here, not new markup.
const ADMIN_SETUP_SECTIONS = [
  {
    title: "General setup",
    items: [
      { label: "Roles", icon: User, target: "admin-roles" },
      { label: "Years", icon: Calendar, target: "admin-general" },
    ],
  },
  {
    title: "Tournament setup",
    items: [
      { label: "Round setup", icon: GolfClubIcon, target: "admin-rounds" },
      { label: "Team setup", icon: Users, target: "admin-teams" },
      { label: "Matchup setup", icon: Swords, target: "admin-matchups" },
    ],
  },
  {
    title: "Money setup",
    items: [
      { label: "Competition setup", icon: Trophy, target: "admin-competitions-setup" },
      { label: "Games setup", icon: Coins, target: "admin-games-setup" },
    ],
  },
];

const ADMIN_RESULTS_SECTIONS = [
  {
    title: "Results data",
    items: [
      { label: "Competition results", icon: Trophy, target: "admin-competitions-results" },
      { label: "Games results", icon: Coins, target: "admin-games-results" },
    ],
  },
  {
    title: "Bulk data",
    items: [
      { label: "Import", icon: Import, target: "admin-import" },
      { label: "Export", icon: Upload, target: "admin-export" },
    ],
  },
];

function AdminMenu({ title, sections, onBack, onNavigate }) {
  return (
    <div style={{ padding: "14px 20px 24px" }}>
      <ScreenHeader title={title} onBack={onBack} backLabel="Back to More" marginBottom={18} />

      {sections.map((section) => (
        <AdminIconRow key={section.title} title={section.title}>
          {section.items.map((item) => (
            <AdminIconButton key={item.label} label={item.label} icon={item.icon} onClick={() => onNavigate(item.target)} />
          ))}
        </AdminIconRow>
      ))}
    </div>
  );
}

function AdminSetupMenu({ onBack, onNavigate }) {
  return <AdminMenu title="Admin setup" sections={ADMIN_SETUP_SECTIONS} onBack={onBack} onNavigate={onNavigate} />;
}

function AdminResultsMenu({ onBack, onNavigate }) {
  return <AdminMenu title="Admin results" sections={ADMIN_RESULTS_SECTIONS} onBack={onBack} onNavigate={onNavigate} />;
}



// ---------------------------------------------------------------------------
// Event settings — current year, team pairs, Carroll Cup roster, round
// matchups, and round-to-course assignment. Local to this session for now,
// same as Players/Courses — becomes the real config source once backend-
// connected.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Import Results — CSV upload for historical scoring data. File structure
// still TBD; this wires up the interaction (pick file -> queue import) so
// the real parsing/mapping step can be dropped in later.
// ---------------------------------------------------------------------------
const IMPORT_HOLE_COUNT = 18;

function buildScoreImportTemplate() {
  const headers = ["Player", "Round", "Year"];
  for (let h = 1; h <= IMPORT_HOLE_COUNT; h++) headers.push(`H${h}_Strokes`, `H${h}_Putts`);
  const exampleA = ["Tyler Jessel", "R1", String(CURRENT_YEAR), ...Array(IMPORT_HOLE_COUNT * 2).fill("")];
  const exampleB = ["James Bublitz", "R1", String(CURRENT_YEAR), ...Array(IMPORT_HOLE_COUNT * 2).fill("")];
  return [headers, exampleA, exampleB].map((row) => row.join(",")).join("\n");
}

function buildPlayerImportTemplate() {
  const headers = ["Name", "Hometown", "Bio", "Year", "Handicap Index", "Competing"];
  const example = ["Jordan Smith", "Chicago, IL", "", String(CURRENT_YEAR), "12.5", "yes"];
  return [headers, example].map((row) => row.join(",")).join("\n");
}

function buildCourseImportTemplate() {
  const headers = ["Name", "Tee", "Rating", "Slope", "Holes"];
  for (let h = 1; h <= IMPORT_HOLE_COUNT; h++) headers.push(`H${h}_Par`, `H${h}_Yardage`, `H${h}_Hcp`);
  const example = ["Stonehedge East", "White", "70.2", "128", "18", ...Array(IMPORT_HOLE_COUNT * 3).fill("")];
  return [headers, example].map((row) => row.join(",")).join("\n");
}

function buildMatchupImportTemplate() {
  const headers = ["Year", "Round", "Home Team", "Away Team"];
  const exampleA = [String(CURRENT_YEAR), "R1", "CDL", "Boomers"];
  const exampleB = [String(CURRENT_YEAR), "R1", "Torch'em", "LFG"];
  return [headers, exampleA, exampleB].map((row) => row.join(",")).join("\n");
}

function buildTeamHoleImportTemplate() {
  const headers = ["Year", "Round", "Team"];
  for (let h = 1; h <= IMPORT_HOLE_COUNT; h++) headers.push(`H${h}_NetScore`, `H${h}_Points`);
  const exampleA = [String(CURRENT_YEAR), "R2", "CDL", ...Array(IMPORT_HOLE_COUNT * 2).fill("")];
  const exampleB = [String(CURRENT_YEAR), "R2", "Boomers", ...Array(IMPORT_HOLE_COUNT * 2).fill("")];
  return [headers, exampleA, exampleB].map((row) => row.join(",")).join("\n");
}

const IMPORT_TYPES = [
  { key: "scores", label: "Scores" },
  { key: "players", label: "Players" },
  { key: "courses", label: "Courses" },
  { key: "matchups", label: "Matchups" },
  { key: "teamHoles", label: "Team (Non-Stroke)" },
];

function ImportResults({ onBack, isLive }) {
  const [importType, setImportType] = useState("scores");
  const [fileName, setFileName] = useState(null);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState(null); // null | "parsing" | "done" | "parse-error"
  const [result, setResult] = useState(null); // { totalRows, successCount, errors: [{row, message}] }

  const switchType = (type) => {
    setImportType(type);
    setFile(null);
    setFileName(null);
    setStatus(null);
    setResult(null);
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setFileName(f ? f.name : null);
    setStatus(null);
    setResult(null);
  };

  const handleDownloadTemplate = () => {
    const builders = {
      scores: buildScoreImportTemplate,
      players: buildPlayerImportTemplate,
      courses: buildCourseImportTemplate,
      matchups: buildMatchupImportTemplate,
      teamHoles: buildTeamHoleImportTemplate,
    };
    const csv = builders[importType]();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bco-${importType}-import-template.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportScores = () => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (parsed) => {
        const rows = parsed.data;
        const errors = [];
        let successCount = 0;
        const eventCache = {}; // year -> event | null
        const roundCache = {}; // "eventId-label" -> roundId | null

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowNum = i + 2; // header is row 1
          const playerName = (row.Player || "").trim();
          const roundLabel = (row.Round || "").trim();
          const yearStr = (row.Year || "").trim();

          if (!playerName || !roundLabel || !yearStr) {
            errors.push({ row: rowNum, message: "Missing Player, Round, or Year." });
            continue;
          }

          const player = PLAYERS.find((p) => p.name.toLowerCase() === playerName.toLowerCase());
          if (!player) {
            errors.push({ row: rowNum, message: `Unknown player "${playerName}".` });
            continue;
          }

          const year = Number(yearStr);
          if (!(year in eventCache)) {
            try {
              eventCache[year] = await fetchEventByYear(year);
            } catch (err) {
              eventCache[year] = null;
            }
          }
          const event = eventCache[year];
          if (!event) {
            errors.push({ row: rowNum, message: `No event found for year ${year}.` });
            continue;
          }

          const roundCacheKey = `${event.id}-${roundLabel.toLowerCase()}`;
          if (!(roundCacheKey in roundCache)) {
            try {
              const rounds = await fetchRounds(event.id);
              const match = rounds.find((r) => r.label.toLowerCase() === roundLabel.toLowerCase());
              roundCache[roundCacheKey] = match ? match.id : null;
            } catch (err) {
              roundCache[roundCacheKey] = null;
            }
          }
          const roundId = roundCache[roundCacheKey];
          if (!roundId) {
            errors.push({ row: rowNum, message: `Round "${roundLabel}" not found for ${year}.` });
            continue;
          }

          const entries = {};
          let holeCount = 0;
          let badHole = null;
          for (let h = 1; h <= IMPORT_HOLE_COUNT; h++) {
            const strokesRaw = row[`H${h}_Strokes`];
            const puttsRaw = row[`H${h}_Putts`];
            if (strokesRaw != null && String(strokesRaw).trim() !== "") {
              const strokes = Number(strokesRaw);
              if (!Number.isFinite(strokes) || strokes <= 0) {
                badHole = h;
                break;
              }
              entries[h] = { strokes, putts: puttsRaw != null && String(puttsRaw).trim() !== "" ? Number(puttsRaw) : null };
              holeCount++;
            }
          }

          if (badHole) {
            errors.push({ row: rowNum, message: `Hole ${badHole} strokes must be a positive number.` });
            continue;
          }
          if (holeCount === 0) {
            errors.push({ row: rowNum, message: "No hole scores found in this row." });
            continue;
          }

          try {
            await upsertScores(roundId, player.id, entries);
            await upsertSubmission(roundId, player.id, "submitted");
            successCount++;
          } catch (err) {
            errors.push({ row: rowNum, message: `Save failed: ${err.message || err}` });
          }
        }

        setResult({ totalRows: rows.length, successCount, errors });
        setStatus("done");
      },
      error: (err) => {
        console.error("CSV parse error:", err);
        setStatus("parse-error");
      },
    });
  };

  const handleImportPlayers = () => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (parsed) => {
        const rows = parsed.data;
        const errors = [];
        let successCount = 0;
        const eventCache = {};

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowNum = i + 2;
          const name = (row.Name || "").trim();
          const yearStr = (row.Year || "").trim();
          const hiStr = (row["Handicap Index"] || "").trim();

          if (!name || !yearStr || !hiStr) {
            errors.push({ row: rowNum, message: "Missing Name, Year, or Handicap Index." });
            continue;
          }
          const handicapIndex = Number(hiStr);
          if (!Number.isFinite(handicapIndex)) {
            errors.push({ row: rowNum, message: "Handicap Index must be a number." });
            continue;
          }

          const year = Number(yearStr);
          if (!(year in eventCache)) {
            try {
              eventCache[year] = await fetchEventByYear(year);
            } catch (err) {
              eventCache[year] = null;
            }
          }
          const event = eventCache[year];
          if (!event) {
            errors.push({ row: rowNum, message: `No event found for year ${year}.` });
            continue;
          }

          const hometown = (row.Hometown || "").trim();
          const bio = (row.Bio || "").trim();
          const competingRaw = (row.Competing || "").trim().toLowerCase();
          const competing = competingRaw === "" ? true : competingRaw === "yes" || competingRaw === "true" || competingRaw === "1";

          try {
            const existing = PLAYERS.find((p) => p.name.toLowerCase() === name.toLowerCase());
            if (existing) {
              await updatePlayer(existing.id, { name: existing.name, hometown, bio });
              await updatePlayerHandicap(existing.id, event.id, handicapIndex);
              await setPlayerCompetedYear(existing.id, event.id, competing);
              Object.assign(existing, { hometown, bio, handicapIndex });
            } else {
              const id = await createPlayer({ name, handicapIndex, hometown, bio, eventId: event.id });
              await setPlayerCompetedYear(id, event.id, competing);
              PLAYERS.push({ id, name, handicapIndex, hometown, bio, competing: false, yearsCompeted: [] });
            }
            successCount++;
          } catch (err) {
            errors.push({ row: rowNum, message: `Save failed: ${err.message || err}` });
          }
        }

        setResult({ totalRows: rows.length, successCount, errors });
        setStatus("done");
      },
      error: (err) => {
        console.error("CSV parse error:", err);
        setStatus("parse-error");
      },
    });
  };

  const handleImportCourses = () => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (parsed) => {
        const rows = parsed.data;
        const errors = [];
        let successCount = 0;

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowNum = i + 2;
          const name = (row.Name || "").trim();
          const tee = (row.Tee || "").trim();
          const ratingStr = (row.Rating || "").trim();
          const slopeStr = (row.Slope || "").trim();
          const holesCount = Number((row.Holes || "18").trim()) === 9 ? 9 : 18;

          if (!name || !tee || !ratingStr || !slopeStr) {
            errors.push({ row: rowNum, message: "Missing Name, Tee, Rating, or Slope." });
            continue;
          }
          const rating = Number(ratingStr);
          const slope = Number(slopeStr);
          if (!Number.isFinite(rating) || !Number.isFinite(slope)) {
            errors.push({ row: rowNum, message: "Rating and Slope must be numbers." });
            continue;
          }

          const existing = COURSES.find((c) => c.name.toLowerCase() === name.toLowerCase() && c.tee.toLowerCase() === tee.toLowerCase());
          if (existing) {
            errors.push({ row: rowNum, message: `"${name} — ${tee}" already exists — skipped (import never overwrites existing hole data).` });
            continue;
          }

          const holes = [];
          let badHole = null;
          for (let h = 1; h <= holesCount; h++) {
            const par = Number(row[`H${h}_Par`]);
            const yardage = Number(row[`H${h}_Yardage`]);
            const handicap = Number(row[`H${h}_Hcp`]);
            if (![3, 4, 5].includes(par) || !Number.isFinite(yardage) || yardage <= 0 || !Number.isFinite(handicap) || handicap < 1 || handicap > holesCount) {
              badHole = h;
              break;
            }
            holes.push({ number: h, par, yardage, handicap });
          }
          if (badHole) {
            errors.push({ row: rowNum, message: `Hole ${badHole} data is missing or invalid (par 3/4/5, positive yardage, handicap 1–${holesCount}).` });
            continue;
          }
          if (new Set(holes.map((h) => h.handicap)).size !== holesCount) {
            errors.push({ row: rowNum, message: `Handicap ranks must be ${holesCount} unique values from 1–${holesCount}.` });
            continue;
          }

          try {
            const courseId = await createCourse({ name, tee, rating, slope, holesCount });
            await createCourseHoles(courseId, holes);
            COURSES.push({ id: courseId, name, tee, rating, slope, holesCount, playedEventId: null, holes });
            successCount++;
          } catch (err) {
            errors.push({ row: rowNum, message: `Save failed: ${err.message || err}` });
          }
        }

        setResult({ totalRows: rows.length, successCount, errors });
        setStatus("done");
      },
      error: (err) => {
        console.error("CSV parse error:", err);
        setStatus("parse-error");
      },
    });
  };

  const handleImportMatchups = () => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (parsed) => {
        const rows = parsed.data;
        const errors = [];
        let successCount = 0;
        const eventCache = {}; // year -> event | null
        const roundCache = {}; // "eventId-label" -> roundId | null
        const teamsCache = {}; // eventId -> [{id, name}]
        const matchupsCache = {}; // eventId -> live matchups, kept in sync as rows are imported

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowNum = i + 2;
          const yearStr = (row.Year || "").trim();
          const roundLabel = (row.Round || "").trim();
          const homeName = (row["Home Team"] || "").trim();
          const awayName = (row["Away Team"] || "").trim();

          if (!yearStr || !roundLabel || !homeName || !awayName) {
            errors.push({ row: rowNum, message: "Missing Year, Round, Home Team, or Away Team." });
            continue;
          }
          if (homeName.toLowerCase() === awayName.toLowerCase()) {
            errors.push({ row: rowNum, message: "Home Team and Away Team can't be the same." });
            continue;
          }

          const year = Number(yearStr);
          if (!(year in eventCache)) {
            try {
              eventCache[year] = await fetchEventByYear(year);
            } catch (err) {
              eventCache[year] = null;
            }
          }
          const event = eventCache[year];
          if (!event) {
            errors.push({ row: rowNum, message: `No event found for year ${year}.` });
            continue;
          }

          const roundKey = `${event.id}-${roundLabel.toLowerCase()}`;
          if (!(roundKey in roundCache)) {
            try {
              const rounds = await fetchRounds(event.id);
              const match = rounds.find((r) => r.label.toLowerCase() === roundLabel.toLowerCase());
              roundCache[roundKey] = match ? match.id : null;
            } catch (err) {
              roundCache[roundKey] = null;
            }
          }
          const roundId = roundCache[roundKey];
          if (!roundId) {
            errors.push({ row: rowNum, message: `Round "${roundLabel}" not found for ${year}.` });
            continue;
          }

          if (!(event.id in teamsCache)) {
            try {
              teamsCache[event.id] = await fetchTeams(event.id);
            } catch (err) {
              teamsCache[event.id] = [];
            }
          }
          const teams = teamsCache[event.id];
          const homeTeam = teams.find((t) => t.name.toLowerCase() === homeName.toLowerCase());
          const awayTeam = teams.find((t) => t.name.toLowerCase() === awayName.toLowerCase());
          if (!homeTeam) {
            errors.push({ row: rowNum, message: `Unknown team "${homeName}" for ${year}.` });
            continue;
          }
          if (!awayTeam) {
            errors.push({ row: rowNum, message: `Unknown team "${awayName}" for ${year}.` });
            continue;
          }

          if (!(event.id in matchupsCache)) {
            try {
              matchupsCache[event.id] = await fetchRoundMatchups(event.id);
            } catch (err) {
              matchupsCache[event.id] = [];
            }
          }
          const alreadyExists = matchupsCache[event.id].some(
            (m) =>
              m.roundId === roundId &&
              ((m.teamAId === homeTeam.id && m.teamBId === awayTeam.id) || (m.teamAId === awayTeam.id && m.teamBId === homeTeam.id))
          );
          if (alreadyExists) {
            errors.push({ row: rowNum, message: `Matchup already exists for ${roundLabel} (${homeName} vs ${awayName}) — skipped.` });
            continue;
          }

          try {
            const id = await createRoundMatchup({ roundId, teamAId: homeTeam.id, teamBId: awayTeam.id });
            matchupsCache[event.id].push({ id, roundId, roundLabel, teamAId: homeTeam.id, teamBId: awayTeam.id });
            successCount++;
          } catch (err) {
            errors.push({ row: rowNum, message: `Save failed: ${err.message || err}` });
          }
        }

        setResult({ totalRows: rows.length, successCount, errors });
        setStatus("done");
      },
      error: (err) => {
        console.error("CSV parse error:", err);
        setStatus("parse-error");
      },
    });
  };

  const handleImportTeamHoles = () => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (parsed) => {
        const rows = parsed.data;
        const errors = [];
        let successCount = 0;
        const eventCache = {};
        const roundCache = {};
        const teamsCache = {};

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowNum = i + 2;
          const yearStr = (row.Year || "").trim();
          const roundLabel = (row.Round || "").trim();
          const teamName = (row.Team || "").trim();

          if (!yearStr || !roundLabel || !teamName) {
            errors.push({ row: rowNum, message: "Missing Year, Round, or Team." });
            continue;
          }

          const year = Number(yearStr);
          if (!(year in eventCache)) {
            try {
              eventCache[year] = await fetchEventByYear(year);
            } catch (err) {
              eventCache[year] = null;
            }
          }
          const event = eventCache[year];
          if (!event) {
            errors.push({ row: rowNum, message: `No event found for year ${year}.` });
            continue;
          }

          const roundKey = `${event.id}-${roundLabel.toLowerCase()}`;
          if (!(roundKey in roundCache)) {
            try {
              const rounds = await fetchRounds(event.id);
              const match = rounds.find((r) => r.label.toLowerCase() === roundLabel.toLowerCase());
              roundCache[roundKey] = match ? match.id : null;
            } catch (err) {
              roundCache[roundKey] = null;
            }
          }
          const roundId = roundCache[roundKey];
          if (!roundId) {
            errors.push({ row: rowNum, message: `Round "${roundLabel}" not found for ${year}.` });
            continue;
          }

          if (!(event.id in teamsCache)) {
            try {
              teamsCache[event.id] = await fetchTeams(event.id);
            } catch (err) {
              teamsCache[event.id] = [];
            }
          }
          const team = teamsCache[event.id].find((t) => t.name.toLowerCase() === teamName.toLowerCase());
          if (!team) {
            errors.push({ row: rowNum, message: `Unknown team "${teamName}" for ${year}.` });
            continue;
          }

          let holeCount = 0;
          let badHole = null;
          const holeUpdates = [];
          for (let h = 1; h <= IMPORT_HOLE_COUNT; h++) {
            const netRaw = row[`H${h}_NetScore`];
            const ptsRaw = row[`H${h}_Points`];
            if (netRaw == null || String(netRaw).trim() === "") continue;
            const netScore = Number(netRaw);
            const points = ptsRaw != null && String(ptsRaw).trim() !== "" ? Number(ptsRaw) : null;
            if (!Number.isFinite(netScore) || (points != null && ![0, 0.5, 1].includes(points))) {
              badHole = h;
              break;
            }
            holeUpdates.push({ hole: h, netScore, points });
            holeCount++;
          }

          if (badHole) {
            errors.push({ row: rowNum, message: `Hole ${badHole}: Net Score must be a number, Points must be 0, 0.5, or 1.` });
            continue;
          }
          if (holeCount === 0) {
            errors.push({ row: rowNum, message: "No hole data found in this row." });
            continue;
          }

          try {
            for (const hu of holeUpdates) {
              await upsertTeamHoleResult(roundId, team.id, hu.hole, { netScore: hu.netScore, points: hu.points });
            }
            successCount++;
          } catch (err) {
            errors.push({ row: rowNum, message: `Save failed: ${err.message || err}` });
          }
        }

        setResult({ totalRows: rows.length, successCount, errors });
        setStatus("done");
      },
      error: (err) => {
        console.error("CSV parse error:", err);
        setStatus("parse-error");
      },
    });
  };

  const handleImport = () => {
    if (!file || !isLive) return;
    setStatus("parsing");
    setResult(null);
    if (importType === "scores") handleImportScores();
    else if (importType === "players") handleImportPlayers();
    else if (importType === "courses") handleImportCourses();
    else if (importType === "matchups") handleImportMatchups();
    else handleImportTeamHoles();
  };

  const DESCRIPTIONS = {
    scores: (
      <>
        One row per player, per round: name, round label, year, then strokes and putts for holes 1–18 (leave extra
        holes blank for a 9-hole round). Each row is upserted into <code>scores</code> and marked{" "}
        <code>submitted</code> — this is for backfilling finished rounds, not partial in-progress ones.
      </>
    ),
    players: (
      <>
        One row per player: name, hometown, bio, the year this handicap applies to, handicap index, and whether
        they're competing (yes/no, defaults to yes). Matches existing players by name — if found, updates their info
        and that year's handicap; if not, creates a new player.
      </>
    ),
    courses: (
      <>
        One row per course-tee: name, tee, rating, slope, hole count (9 or 18), then par/yardage/handicap for holes
        1–18 (leave extra holes blank for a 9-hole course). Only creates <em>new</em> course-tees — if a course with
        the same name and tee already exists, that row is skipped rather than overwriting its hole data.
      </>
    ),
    matchups: (
      <>
        One row per matchup: year, round label, Home Team, Away Team — both team names must already exist for that
        year (set them up on Team setup first). Skips a row if that exact matchup (either team as home or away)
        already exists for the round, so re-running the same file is safe.
      </>
    ),
    teamHoles: (
      <>
        For scramble/alternate-shot rounds: one row per team, per round — year, round label, team name, then Net
        Score and Points (0, 0.5, or 1) for holes 1–18 (leave holes blank as needed). The round must already be set
        to a non-stroke Play format on Round setup. Re-running overwrites that team's saved values for the round.
      </>
    ),
  };

  return (
    <div style={{ padding: "14px 20px 24px" }}>
      <ScreenHeader title="Import results" onBack={onBack} backLabel="Back to Admin" />

      <div className="bco-seg" style={{ marginBottom: 14 }}>
        {IMPORT_TYPES.map((t) => (
          <button key={t.key} className={`bco-seg-btn${importType === t.key ? " active" : ""}`} onClick={() => switchType(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <AutoComputedNote>{DESCRIPTIONS[importType]}</AutoComputedNote>

      <button
        onClick={handleDownloadTemplate}
        style={{
          width: "100%",
          border: "1px solid #1B4332",
          color: "#1B4332",
          background: "#FFFFFF",
          borderRadius: 10,
          padding: "11px",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "'Inter', sans-serif",
          marginBottom: 14,
        }}
      >
        Download {importType} import template (.csv)
      </button>

      {!isLive && (
        <div style={{ marginBottom: 14 }}>
          <Banner tone="error">Not connected to Supabase — importing needs a live connection. See the README for setup.</Banner>
        </div>
      )}

      <div style={{ background: "#FFFFFF", border: "1px dashed #C9C2AC", borderRadius: 12, padding: 20, textAlign: "center" }}>
        <input type="file" id="csv-upload" accept=".csv" style={{ display: "none" }} onChange={handleFileChange} />
        <label
          htmlFor="csv-upload"
          style={{
            display: "inline-block",
            border: "1px solid #1B4332",
            color: "#1B4332",
            borderRadius: 8,
            padding: "9px 16px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          Choose CSV file
        </label>
        <div style={{ fontSize: 12, color: fileName ? "#2C2A22" : "#B4AE9E", marginTop: 10 }}>
          {fileName || "No file selected"}
        </div>
      </div>

      {status === "parse-error" && (
        <div style={{ marginTop: 12 }}>
          <Banner tone="error">Couldn't parse that file — make sure it's a valid CSV.</Banner>
        </div>
      )}

      {status === "done" && result && (
        <div style={{ marginTop: 12 }}>
          <Banner tone={result.errors.length === 0 ? "success" : "error"}>
            Imported {result.successCount} of {result.totalRows} row{result.totalRows !== 1 ? "s" : ""}.
            {result.errors.length > 0 && ` ${result.errors.length} row${result.errors.length !== 1 ? "s" : ""} skipped.`}
          </Banner>
          {result.errors.length > 0 && (
            <div style={{ marginTop: 8, maxHeight: 200, overflowY: "auto", border: "1px solid #E4DFCE", borderRadius: 10, background: "#FFFFFF" }}>
              {result.errors.map((e, i) => (
                <div
                  key={i}
                  style={{ fontSize: 11.5, color: "#6B6455", padding: "7px 10px", borderBottom: i < result.errors.length - 1 ? "1px solid #EFEBDE" : "none" }}
                >
                  <span className="bco-mono" style={{ fontWeight: 600, color: "#8C2F2A" }}>
                    Row {e.row}:
                  </span>{" "}
                  {e.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Button style={{ marginTop: 14 }} onClick={handleImport} disabled={!fileName || !isLive || status === "parsing"}>
        {status === "parsing" ? "Importing…" : "Import CSV"}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export results — CSV download of current mock data. Real app: same picker,
// but pulling from live tables instead of the in-memory demo data.
// ---------------------------------------------------------------------------
const EXPORT_TYPES = [
  { key: "soloLeaderboard", label: "Solo leaderboard (current standings)" },
  { key: "teamLeaderboard", label: "Team leaderboard (current standings)" },
  { key: "skins", label: "Skins results (all rounds)" },
  { key: "poker", label: "Poker results (all rounds)" },
  { key: "soloRecords", label: "Solo record book (all-time — still mock, Record Book isn't live yet)" },
  { key: "teamRecords", label: "Team record book (all-time — still mock, Record Book isn't live yet)" },
];

function csvRow(values) {
  return values
    .map((v) => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(",");
}

async function buildExportCsv(selected, isLive, currentEventId) {
  const lines = [];
  const live = isLive && currentEventId;

  if (selected.soloLeaderboard) {
    lines.push("Solo Leaderboard", csvRow(["Rank", "Player", "Total"]));
    if (live) {
      const standings = await fetchSoloStandings(currentEventId);
      const rows = standings
        .map((s) => ({ name: PLAYERS.find((p) => p.id === s.player_id)?.name || `Player ${s.player_id}`, total: s.total_net_to_par, totalAllRounds: s.total_net_to_par_all_rounds }))
        .sort((a, b) => a.total - b.total || a.totalAllRounds - b.totalAllRounds);
      rows.forEach((r, i) => lines.push(csvRow([i + 1, r.name, fmtDiff(r.total)])));
    } else {
      soloResults.forEach((p, i) => lines.push(csvRow([i + 1, p.name, fmtDiff(p.total)])));
    }
    lines.push("");
  }

  if (selected.teamLeaderboard) {
    lines.push("Team Leaderboard", csvRow(["Rank", "Team", "Points"]));
    if (live) {
      const dbTeams = await fetchTeams(currentEventId);
      const standings = await fetchTeamStandings(currentEventId);
      const rows = standings
        .map((s) => ({ name: dbTeams.find((t) => t.id === s.team_id)?.name || s.name, points: s.total_points }))
        .sort((a, b) => b.points - a.points);
      rows.forEach((t, i) => lines.push(csvRow([i + 1, t.name, t.points])));
    } else {
      teamResults.forEach((t, i) => lines.push(csvRow([i + 1, t.name, t.points])));
    }
    lines.push("");
  }

  if (selected.skins) {
    lines.push("Skins", csvRow(["Round", "Hole", "Winner", "Net"]));
    if (live) {
      for (const label of SCORE_ROUNDS) {
        const roundId = ROUND_ID_BY_LABEL[label];
        if (!roundId) continue;
        const skins = await fetchSkins(roundId);
        skins.forEach((s) =>
          lines.push(csvRow([label, s.hole_number, PLAYERS.find((p) => p.id === s.winner_player_id)?.name || s.winner_player_id, s.net_strokes]))
        );
      }
    } else {
      SKINS_PREVIEW.forEach((s) => lines.push(csvRow([SCORE_ROUNDS[0], s.hole, s.winner, s.net])));
    }
    lines.push("");
  }

  if (selected.poker) {
    lines.push("Poker", csvRow(["Round", "Player", "0-putts", "1-putts", "Cards", "3-putts"]));
    if (live) {
      for (const label of SCORE_ROUNDS) {
        const roundId = ROUND_ID_BY_LABEL[label];
        if (!roundId) continue;
        const cards = await fetchPokerCards(roundId);
        cards.forEach((c) =>
          lines.push(
            csvRow([label, PLAYERS.find((p) => p.id === c.player_id)?.name || c.player_id, c.zero_putts, c.one_putts, c.cards_earned, c.three_putts])
          )
        );
      }
    } else {
      POKER_PREVIEW.forEach((p) => lines.push(csvRow([SCORE_ROUNDS[0], p.name, p.zeroPutts, p.onePutts, p.zeroPutts * 2 + p.onePutts, p.threePuttBuyins])));
    }
    lines.push("");
  }

  if (selected.soloRecords) {
    lines.push("Solo Record Book (All-time)", csvRow(["Player", "App", "Avg", "Best", "Worst", "Podiums", "Gross Avg", "Net Avg"]));
    soloRecordsSorted.forEach((p) =>
      lines.push(csvRow([p.name, p.app, p.posAvg, p.posBest, p.posWorst, p.podium1 + p.podium2 + p.podium3, p.grossAvg, p.netAvg]))
    );
    lines.push("");
  }
  if (selected.teamRecords) {
    lines.push("Team Record Book (All-time)", csvRow(["Player", "App", "Avg", "Best", "Worst", "Podiums", "Win", "Loss", "Tie", "Win %"]));
    teamRecordsSorted.forEach((p) =>
      lines.push(csvRow([p.name, p.app, p.posAvg, p.posBest, p.posWorst, p.podium1 + p.podium2 + p.podium3, p.win, p.loss, p.tie, p.winPct]))
    );
    lines.push("");
  }
  return lines.join("\n");
}

function ExportResults({ onBack, isLive, currentEventId }) {
  const [selected, setSelected] = useState({ soloLeaderboard: true, teamLeaderboard: true, skins: false, poker: false, soloRecords: false, teamRecords: false });
  const [status, setStatus] = useState(null); // null | "exporting" | "exported" | "error"

  const toggle = (key) => {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
    setStatus(null);
  };

  const anySelected = Object.values(selected).some(Boolean);

  const handleExport = async () => {
    if (!anySelected) return;
    setStatus("exporting");
    try {
      const csv = await buildExportCsv(selected, isLive, currentEventId);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bco-export-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus("exported");
    } catch (err) {
      console.error("Export failed:", err);
      setStatus("error");
    }
  };

  return (
    <div style={{ padding: "14px 20px 24px" }}>
      <ScreenHeader title="Export results" onBack={onBack} backLabel="Back to Admin" />

      <AutoComputedNote>
        {isLive
          ? "Leaderboards, Skins, and Poker pull real data for the current year. Record Book entries are still mock — that screen isn't live yet."
          : "Not connected to Supabase — exports will use local demo data."}
      </AutoComputedNote>

      <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6455", marginBottom: 8 }}>WHAT TO EXPORT</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
        {EXPORT_TYPES.map((t) => (
          <label
            key={t.key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "#FFFFFF",
              border: "1px solid #E4DFCE",
              borderRadius: 10,
              padding: "10px 12px",
              cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            <input type="checkbox" checked={!!selected[t.key]} onChange={() => toggle(t.key)} style={{ accentColor: "#1B4332", width: 15, height: 15 }} />
            <span style={{ fontSize: 13, color: "#2C2A22" }}>{t.label}</span>
          </label>
        ))}
      </div>

      {status === "exported" && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="success">CSV downloaded.</Banner>
        </div>
      )}
      {status === "error" && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="error">Export failed — check the console and try again.</Banner>
        </div>
      )}

      <Button onClick={handleExport} disabled={!anySelected || status === "exporting"}>
        {status === "exporting" ? "Exporting…" : "Export CSV"}
      </Button>
    </div>
  );
}
function StatBlock({ label, value, sub }) {
  return <StatTile variant="block" label={label} value={value} sub={sub} />;
}

// ---------------------------------------------------------------------------
// Match Results tab — per-round team matchups. Course handicaps are computed
// live from each player's handicapIndex against the course assigned to that
// round (mocked here since round -> course assignment isn't persisted yet).
// ---------------------------------------------------------------------------
function computeMatchProgress(match, round, scoresStore, year, teamsSource, totalHoles = 18) {
  // Prefer server-recorded progress when available (live mode) — scoresStore
  // is only a client-side cache of whatever's been touched via Score entry
  // in THIS browser session. An imported match, or one finished from a
  // different session, would never show as finished if this only looked at
  // scoresStore, since it would simply have no entry there at all.
  if (match.holesPlayed != null) {
    return { marker: Math.min(match.holesPlayed, totalHoles), final: match.holesPlayed >= totalHoles };
  }

  let allNames;
  if (match.matchType === "singles") {
    // For singles, teamA/teamB already hold the two players' own names.
    allNames = [match.teamA, match.teamB].filter(Boolean);
  } else {
    const teamAObj = teamsSource.find((t) => t.name === match.teamA);
    const teamBObj = teamsSource.find((t) => t.name === match.teamB);
    allNames = [...(teamAObj?.players || []), ...(teamBObj?.players || [])];
  }
  const playerIds = allNames.map((name) => PLAYERS.find((p) => p.name === name)?.id).filter((id) => id != null);

  if (playerIds.length < 2) return { marker: 0, final: false };

  const records = playerIds.map((id) => scoresStore[`${year}-${round}-${id}`]);
  const allSubmitted = records.every((r) => r?.status === "submitted");
  if (allSubmitted) return { marker: 18, final: true };

  let marker = 0;
  for (let holeNum = 1; holeNum <= 18; holeNum++) {
    const allIn = records.every((r) => r?.entries?.[holeNum]?.strokes != null && r?.entries?.[holeNum]?.putts != null);
    if (allIn) marker = holeNum;
  }
  return { marker, final: false };
}

function MatchResultsTab({ scoresStore, currentYear, isLive, currentEventId }) {
  const yr = useYearRoundData(isLive, currentYear);
  const [round, setRound] = useState(SCORE_ROUNDS[0]);
  const [liveTeams, setLiveTeams] = useState(null); // null = use mock TEAMS
  const [liveMatchups, setLiveMatchups] = useState(null); // null = use mock MATCHES_BY_ROUND
  const [liveMatchTotals, setLiveMatchTotals] = useState(null); // null = points not available live
  const [carrollRoster, setCarrollRoster] = useState({}); // playerId -> "red" | "blue"
  const [drilldown, setDrilldown] = useState(null); // { roundId, roundLabel, teamAId, teamBId, teamAName, teamBName } | null

  // Whenever the selected year's rounds load (or the year changes), make
  // sure the selected round label is actually one that exists for that
  // year — otherwise default to the first one.
  useEffect(() => {
    if (!isLive) return;
    if (yr.rounds.length === 0) return;
    if (!yr.rounds.some((r) => r.label === round)) setRound(yr.rounds[0].label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, yr.rounds]);

  // Pulls whatever's actually configured on Admin > Matchup setup, instead
  // of the frozen mock schedule — this is what makes a newly-added round's
  // matchups actually show up here. Match totals are the real points, once
  // both teams have submitted scores for that round (v_team_match_totals
  // only has rows for holes that are actually scored). Scoped to whichever
  // year is selected here, independent of the global Current Year.
  useEffect(() => {
    if (!isLive || !yr.selectedEventId) {
      setLiveTeams(null);
      setLiveMatchups(null);
      setLiveMatchTotals(null);
      setCarrollRoster({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [teamsData, matchupsData, matchTotalsData, rosterData] = await Promise.all([
          fetchTeams(yr.selectedEventId),
          fetchRoundMatchups(yr.selectedEventId),
          fetchTeamMatchTotals(yr.selectedEventId),
          fetchCarrollCupRoster(yr.selectedEventId),
        ]);
        if (cancelled) return;
        setLiveTeams(
          teamsData.map((t) => ({
            id: t.id,
            name: t.name,
            playerAId: t.player_a_id,
            players: [PLAYERS.find((p) => p.id === t.player_a_id)?.name, PLAYERS.find((p) => p.id === t.player_b_id)?.name].filter(Boolean),
          }))
        );
        setLiveMatchups(matchupsData);
        setLiveMatchTotals(matchTotalsData);
        setCarrollRoster(Object.fromEntries(rosterData.map((r) => [r.player_id, r.side])));
      } catch (err) {
        console.error("Failed to load live matches:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, yr.selectedEventId]);

  const teamsSource = liveTeams || TEAMS;
  const liveRound = isLive ? yr.rounds.find((r) => r.label === round) : null;
  const course = isLive ? (liveRound ? COURSES.find((c) => c.id === liveRound.courseId) : null) || COURSES[0] : ROUND_COURSE[round] || COURSES[0];
  const totalPar = useMemo(() => course.holes.reduce((s, h) => s + h.par, 0), [course]);

  const getHandicap = (playerName) => {
    const player = PLAYERS.find((p) => p.name === playerName);
    if (!player) return null;
    return calcCourseHandicap(player.handicapIndex, course.slope, course.rating, totalPar);
  };

  // Live matchups reference teams by id, not name — resolve against whichever
  // team list is currently loaded (live or mock) before scoring/rendering.
  // Points come from v_team_match_totals when available; a matchup with no
  // scored holes yet just won't have a matching row, so it stays "–".
  const matches = useMemo(() => {
    const list = liveMatchups
      ? liveMatchups
          .filter((m) => m.roundLabel === round)
          .map((m) => {
            const totals = (liveMatchTotals || []).find((t) => t.matchup_id === m.id);
            const isSingles = m.matchType === "singles";
            const teamAObj = isSingles ? null : (liveTeams || []).find((t) => t.id === m.teamAId);
            const teamBObj = isSingles ? null : (liveTeams || []).find((t) => t.id === m.teamBId);
            // Which player represents each side for Carroll Cup color — the
            // player themself for singles, or the team's first player (same
            // convention the Carroll Cup scoring itself uses).
            const carrollAId = isSingles ? m.playerAId : teamAObj?.playerAId;
            const carrollBId = isSingles ? m.playerBId : teamBObj?.playerAId;
            return {
              matchType: m.matchType,
              teamA: isSingles ? PLAYERS.find((p) => p.id === m.playerAId)?.name : teamAObj?.name,
              teamB: isSingles ? PLAYERS.find((p) => p.id === m.playerBId)?.name : teamBObj?.name,
              colorA: carrollRoster[carrollAId] || null,
              colorB: carrollRoster[carrollBId] || null,
              pointsA: totals ? totals.team_a_points : null,
              pointsB: totals ? totals.team_b_points : null,
              holesPlayed: totals ? totals.holes_played : null,
              roundId: m.roundId,
              matchupId: m.id,
              teamAId: m.teamAId,
              teamBId: m.teamBId,
            };
          })
      : MATCHES_BY_ROUND[round] || [];
    const withProgress = list.map((m) => ({ ...m, progress: computeMatchProgress(m, round, scoresStore, yr.selectedYear, teamsSource, course.holes.length) }));
    return withProgress.sort((a, b) => {
      const av = a.progress.final ? 19 : a.progress.marker;
      const bv = b.progress.final ? 19 : b.progress.marker;
      return bv - av;
    });
  }, [liveMatchups, liveTeams, liveMatchTotals, carrollRoster, round, scoresStore, yr.selectedYear, teamsSource, course]);

  if (drilldown) {
    return (
      <div style={{ padding: "18px 20px 24px" }}>
        <MatchScorecard
          isLive={isLive}
          roundId={drilldown.roundId}
          roundLabel={drilldown.roundLabel}
          matchupId={drilldown.matchupId}
          teamAName={drilldown.teamAName}
          teamBName={drilldown.teamBName}
          onBack={() => setDrilldown(null)}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: "18px 20px 24px" }}>
      <div className="bco-sticky-header" style={{ paddingBottom: 10, marginBottom: 4 }}>
        <div className="bco-display" style={{ fontSize: 20, fontWeight: 600, color: "#1B4332", marginBottom: 12 }}>
          Match Results
        </div>

        <YearRoundPicker years={yr.years} selectedYear={yr.selectedYear} setSelectedYear={yr.setSelectedYear} />

        <RoundPicker
          rounds={isLive && yr.rounds.length > 0 ? yr.rounds.map((r) => r.label) : SCORE_ROUNDS}
          selectedRound={round}
          setSelectedRound={setRound}
        />

        <div style={{ fontSize: 10.5, color: "#A39C89" }}>
          {yr.selectedYear} · {course.name} · course handicaps shown are for {round} · sorted by progress
        </div>
      </div>

      {matches.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "#B4AE9E", textAlign: "center", padding: "32px 12px" }}>
          No matches recorded for {round} yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {matches.map((m, i) => {
            const teamAWon = m.pointsA != null && m.pointsA > m.pointsB;
            const teamBWon = m.pointsB != null && m.pointsB > m.pointsA;
            const teamAObj = teamsSource.find((t) => t.name === m.teamA);
            const teamBObj = teamsSource.find((t) => t.name === m.teamB);
            return (
              <div key={i} style={{ background: "#FFFFFF", border: "1px solid #E4DFCE", borderRadius: 12, overflow: "hidden" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 12px",
                    background: "#F7F4EA",
                    borderBottom: "1px solid #EFEBDE",
                  }}
                >
                  <span style={{ fontSize: 10, color: "#8A8371", fontWeight: 600 }}>
                    {m.teamA} vs {m.teamB}
                  </span>
                  <ProgressBadge progress={m.progress} />
                </div>

                <button
                  onClick={() =>
                    setDrilldown({
                      roundId: m.roundId,
                      roundLabel: round,
                      matchupId: m.matchupId,
                      teamAName: m.teamA,
                      teamBName: m.teamB,
                    })
                  }
                  style={{ display: "flex", width: "100%", borderBottom: "1px solid #EFEBDE", border: "none", borderBottomWidth: 1, padding: 0, background: "none", cursor: "pointer" }}
                >
                  <MatchTeamSide name={m.teamA} points={m.pointsA ?? "–"} won={teamAWon} color={m.colorA} />
                  <div style={{ width: 1, background: "#EFEBDE" }} />
                  <MatchTeamSide name={m.teamB} points={m.pointsB ?? "–"} won={teamBWon} color={m.colorB} />
                </button>
                <div style={{ display: "flex" }}>
                  <div style={{ flex: 1, padding: "10px 14px" }}>
                    {(teamAObj?.players || []).map((pl) => (
                      <PlayerRow key={pl} name={pl} handicap={getHandicap(pl)} />
                    ))}
                  </div>
                  <div style={{ width: 1, background: "#EFEBDE" }} />
                  <div style={{ flex: 1, padding: "10px 14px" }}>
                    {(teamBObj?.players || []).map((pl) => (
                      <PlayerRow key={pl} name={pl} handicap={getHandicap(pl)} />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProgressBadge({ progress }) {
  if (progress.final) {
    return (
      <Pill fontWeight={700} padding="2px 8px" bg="#1B4332" fg="#F3EFE2">
        F
      </Pill>
    );
  }
  if (progress.marker === 0) {
    return <span style={{ fontSize: 10, color: "#B4AE9E" }}>Not started</span>;
  }
  return (
    <Pill
      padding="2px 8px"
      bg="#EDEAE0"
      fg="#3F3B32"
    >
      Thru {progress.marker}
    </Pill>
  );
}

const CARROLL_TAG_COLORS = {
  red: { bg: "#F7DCDA", fg: "#8C2F2A" },
  blue: { bg: "#DCE7F2", fg: "#26456B" },
};

function MatchTeamSide({ name, points, won, color }) {
  const tag = color ? CARROLL_TAG_COLORS[color] : null;
  return (
    <div style={{ flex: 1, padding: "12px 14px", textAlign: "center", background: won ? "#DCEFE3" : "transparent" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: won ? "#1B4332" : "#2C2A22" }}>{name}</span>
        {tag && (
          <span
            className="bco-mono"
            style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.02em", background: tag.bg, color: tag.fg, borderRadius: 999, padding: "2px 6px" }}
          >
            {color.toUpperCase()}
          </span>
        )}
      </div>
      <div className="bco-mono" style={{ fontSize: 20, fontWeight: 600, color: won ? "#1B4332" : "#6B6455", marginTop: 2 }}>
        {points}
      </div>
    </div>
  );
}

function PlayerRow({ name, handicap }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
      <span style={{ fontSize: 12.5, color: "#2C2A22" }}>{name}</span>
      <span className="bco-mono" style={{ fontSize: 12, fontWeight: 600, color: "#8A8371" }}>
        {handicap != null ? `CH ${handicap}` : "—"}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Leaderboard tab
// ---------------------------------------------------------------------------
// Shared by Leaderboard, Matches, and Games — lets those (read-only)
// screens browse any year, completely independent of the global "Current
// Year" that Score entry writes against. Deliberately does NOT touch
// SCORE_ROUNDS/ROUND_ID_BY_LABEL/ROUND_COURSE/ROUND_FLAGS (those drive
// Score entry) — mutating those from a browsing screen would silently
// redirect where a score gets saved if someone switched tabs mid-browse.
// Walks a list already sorted by yearRank and, for each pair of
// consecutive rows that share the same primary tiebreak value (net-to-par
// for Solo, points for Team), explains what separated them — either which
// tiebreak level resolved it, or that they're genuinely tied and split the
// payout. Only compares immediate neighbors, so a 3+-way tie shows as a
// short chain (A beat B, B beat C) rather than one combined statement —
// simple to generate and reads naturally either way.
function buildTiebreakMessages(rows) {
  const messages = [];
  const trueTieGroupStarted = new Set();
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const cur = rows[i];
    if (prev.total !== cur.total) continue; // different primary value — not tied, nothing to explain
    if (!cur.decidedBy || cur.decidedBy === "Outright") continue;
    if (cur.decidedBy === "True tie") {
      if (!trueTieGroupStarted.has(prev.name)) {
        messages.push(`${prev.name} and ${cur.name} tied for ${ordinal(prev.yearRank)} — payout split evenly.`);
        trueTieGroupStarted.add(prev.name);
      }
      continue;
    }
    const level = cur.decidedBy.replace(/^Tiebreak:\s*/, "");
    messages.push(`${prev.name} finished ${ordinal(prev.yearRank)} after winning the ${level} tiebreak over ${cur.name}.`);
  }
  return messages;
}

function Leaderboard({ isLive, currentEventId, currentYear }) {
  const [mode, setMode] = useState("solo");
  const [scoreView, setScoreView] = useState("net"); // "net" | "gross" — Solo only
  const [displayUnit, setDisplayUnit] = useState("toPar"); // "toPar" | "strokes" — Solo only
  const yr = useYearRoundData(isLive, currentYear);

  return (
    <div style={{ padding: "18px 20px 24px" }}>
      <div className="bco-sticky-header" style={{ paddingBottom: 4 }}>
        <div style={{ marginBottom: 14 }}>
          <span className="bco-display" style={{ fontSize: 20, fontWeight: 600, color: "#1B4332" }}>
            Leaderboard
          </span>
        </div>

        <YearRoundPicker years={yr.years} selectedYear={yr.selectedYear} setSelectedYear={yr.setSelectedYear} />

        <div className="bco-seg" style={{ marginBottom: 12 }}>
          <button className={`bco-seg-btn${mode === "solo" ? " active" : ""}`} onClick={() => setMode("solo")}>
            Solo
          </button>
          <button className={`bco-seg-btn${mode === "team" ? " active" : ""}`} onClick={() => setMode("team")}>
            Team
          </button>
          <button className={`bco-seg-btn${mode === "carroll" ? " active" : ""}`} onClick={() => setMode("carroll")}>
            Carroll Cup
          </button>
        </div>
      </div>

      {mode === "solo" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <div className="bco-seg" style={{ flex: 1 }}>
            <button className={`bco-seg-btn${scoreView === "net" ? " active" : ""}`} onClick={() => setScoreView("net")}>
              Net
            </button>
            <button className={`bco-seg-btn${scoreView === "gross" ? " active" : ""}`} onClick={() => setScoreView("gross")}>
              Gross
            </button>
          </div>
          <div className="bco-seg" style={{ flex: 1 }}>
            <button className={`bco-seg-btn${displayUnit === "strokes" ? " active" : ""}`} onClick={() => setDisplayUnit("strokes")}>
              Strokes
            </button>
            <button className={`bco-seg-btn${displayUnit === "toPar" ? " active" : ""}`} onClick={() => setDisplayUnit("toPar")}>
              To Par
            </button>
          </div>
        </div>
      )}

      {isLive && yr.error && (
        <div style={{ marginBottom: 12 }}>
          <Banner tone="error">Couldn't load {yr.selectedYear} ({yr.error}) — showing local demo data instead.</Banner>
        </div>
      )}
      {isLive && yr.loading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 12 }}>Loading {yr.selectedYear}…</div>}

      {!yr.loading && mode === "solo" && (
        <SoloTable scoreView={scoreView} displayUnit={displayUnit} isLive={isLive} currentEventId={yr.selectedEventId} currentYear={yr.selectedYear} roundsData={yr.rounds} />
      )}
      {!yr.loading && mode === "team" && (
        <TeamTable isLive={isLive} currentEventId={yr.selectedEventId} currentYear={yr.selectedYear} roundsData={yr.rounds} />
      )}
      {!yr.loading && mode === "carroll" && <CarrollCupTable isLive={isLive} currentEventId={yr.selectedEventId} roundsData={yr.rounds} />}

      <div style={{ marginTop: 14, fontSize: 10.5, color: "#A39C89", lineHeight: 1.5 }}>
        {mode === "solo" &&
          (scoreView === "net"
            ? "Place is always by Net-to-par across counted rounds, regardless of which toggle is shown. Struck-through round is the dropped high score."
            : "Gross is raw score, no handicap applied. Shown for reference — place is always by Net-to-par.")}
        {mode === "team" && "Points are 1 per hole win, 1/2 per tie, summed across matches."}
        {mode === "carroll" && "Points are 1 per match win, 1/2 per tie, 0 per loss — decided by total net score, not per hole."}
      </div>
    </div>
  );
}

function SoloTable({ scoreView, displayUnit, isLive, currentEventId, currentYear, roundsData }) {
  // Omit a round's column entirely if its "Solo" checkbox is unchecked on
  // Round setup. Uses roundsData (this year's real rounds, resolved by
  // Leaderboard's own year picker) rather than the global SCORE_ROUNDS —
  // that global reflects whatever year Score entry is currently writing
  // to, which may not be the year being browsed here. Offline/mock mode
  // falls back to the mock shape.
  const rounds = isLive
    ? roundsData.filter((r) => r.countsForSolo).map((r) => r.label)
    : SCORE_ROUNDS.filter((label) => ROUND_FLAGS[label]?.countsForSolo !== false);
  const [drilldown, setDrilldown] = useState(null); // { playerName, roundLabel } | null
  const [liveRows, setLiveRows] = useState(null); // null = use mock soloResults
  const [liveLoading, setLiveLoading] = useState(isLive);
  const [liveError, setLiveError] = useState(null);

  useEffect(() => {
    if (!isLive || !currentEventId) {
      setLiveLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [standings, netTotals, grossTotals, tiebreaks] = await Promise.all([
          fetchSoloStandings(currentEventId),
          fetchSoloRoundTotals(currentEventId),
          fetchSoloRoundGrossTotals(currentEventId),
          fetchSoloTiebreakDetail(currentEventId),
        ]);
        if (cancelled) return;

        const tiebreakByPlayer = Object.fromEntries(tiebreaks.map((t) => [t.player_id, t]));
        const localRoundIdByLabel = Object.fromEntries((roundsData || []).map((r) => [r.label, r.id]));
        const roundIdToLabel = {};
        rounds.forEach((label) => {
          const id = localRoundIdByLabel[label];
          if (id) roundIdToLabel[id] = label;
        });

        const rows = standings
          .map((s) => {
            const player = PLAYERS.find((p) => p.id === s.player_id);
            const myNet = netTotals.filter((r) => r.player_id === s.player_id);
            const myGross = grossTotals.filter((r) => r.player_id === s.player_id);
            const tb = tiebreakByPlayer[s.player_id];

            const roundsNet = rounds.map((label) => {
              const roundId = localRoundIdByLabel[label];
              const match = myNet.find((r) => r.round_id === roundId);
              return match ? match.net_to_par_total : null;
            });
            const roundsGross = rounds.map((label) => {
              const roundId = localRoundIdByLabel[label];
              const match = myGross.find((r) => r.round_id === roundId);
              return match ? match.gross_to_par_total : null;
            });

            // Which round got dropped — the highest counted value. Matches
            // the sum-max trick in v_solo_standings; if there's a tie for
            // highest, this picks the first occurrence, same as the mock
            // did.
            let droppedIndex = -1;
            if (s.rounds_played > 1) {
              let maxVal = -Infinity;
              roundsNet.forEach((v, i) => {
                if (v != null && v > maxVal) {
                  maxVal = v;
                  droppedIndex = i;
                }
              });
            }

            return {
              name: player?.name || `Player ${s.player_id}`,
              rounds: roundsNet,
              roundsGross,
              total: s.total_net_to_par,
              totalAllRounds: s.total_net_to_par_all_rounds,
              droppedIndex,
              yearRank: tb?.year_rank ?? null,
              decidedBy: tb?.decided_by ?? null,
            };
          })
          .sort((a, b) => (a.yearRank ?? Infinity) - (b.yearRank ?? Infinity) || a.total - b.total);

        setLiveRows(rows);
      } catch (err) {
        console.error("Failed to load live solo standings:", err);
        setLiveError(err.message || String(err));
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, currentEventId]);

  if (drilldown) {
    return (
      <SoloRoundScorecard
        playerName={drilldown.playerName}
        roundLabel={drilldown.roundLabel}
        onBack={() => setDrilldown(null)}
        isLive={isLive}
        roundsData={roundsData}
      />
    );
  }

  const rows = liveRows || soloResults.map((p) => ({ name: p.name, rounds: p.rounds, roundsGross: p.roundsGross, total: p.total, totalAllRounds: p.total, droppedIndex: p.droppedIndex }));
  const tiebreakMessages = buildTiebreakMessages(rows);

  const showEmptyState = isLive && !liveLoading && !liveError && liveRows && liveRows.length === 0;
  const showTable = !liveLoading && !showEmptyState;

  return (
    <div>
      {isLive && liveError && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="error">Couldn't load live standings ({liveError}) — showing local demo data instead.</Banner>
        </div>
      )}
      {isLive && liveLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 10 }}>Loading standings…</div>}
      {showEmptyState && (
        <div style={{ fontSize: 12.5, color: "#B4AE9E", textAlign: "center", padding: "24px 12px" }}>
          No submitted solo rounds yet for {currentYear}.
        </div>
      )}
      {showTable && (
        <table className="bco-table">
          <thead>
            <tr>
              <th style={{ width: 22 }}>#</th>
              <th>Player</th>
              {rounds.map((r) => (
                <th key={r} style={{ textAlign: "center" }}>
                  {r}
                </th>
              ))}
              <th style={{ textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              // Rank comes straight from yearRank (the full 5-level
              // tiebreak cascade, already resolved server-side) when it's
              // available. Falls back to the old shallow (total,
              // totalAllRounds) comparison only for mock/offline data,
              // which never has yearRank at all.
              let currentRank = 0;
              let prevKey = null;
              const fallbackRanks = rows.map((p, i) => {
                const key = `${p.total}-${p.totalAllRounds ?? 0}`;
                if (prevKey === null || key !== prevKey) {
                  currentRank = i + 1;
                  prevKey = key;
                }
                return currentRank;
              });
              const parForRound = (label) => {
                if (isLive) {
                  const r = (roundsData || []).find((rd) => rd.label === label);
                  const course = r ? COURSES.find((c) => c.id === r.courseId) : null;
                  return course ? course.holes.reduce((s, h) => s + h.par, 0) : 0;
                }
                const course = ROUND_COURSE[label];
                return course ? course.holes.reduce((s, h) => s + h.par, 0) : 0;
              };

              return rows.map((p, i) => {
                const rank = p.yearRank ?? fallbackRanks[i];
                // Only a genuine tie that survived every tiebreak level
                // gets the T prefix — anyone a tiebreak actually resolved
                // gets their own distinct place, not a shared one.
                const isTie = p.yearRank != null ? p.decidedBy === "True tie" : rows.filter((r) => r.total === p.total && (r.totalAllRounds ?? 0) === (p.totalAllRounds ?? 0)).length > 1;
                const medal = rank === 1 ? MEDAL_TONES.gold : rank === 2 ? MEDAL_TONES.silver : rank === 3 ? MEDAL_TONES.bronze : null;
                const displayRounds = scoreView === "gross" ? p.roundsGross : p.rounds;
                const effectiveDropIdx = scoreView === "net" ? p.droppedIndex : -1;
                const displayTotalToPar = scoreView === "gross" ? displayRounds.reduce((s, v) => s + (v ?? 0), 0) : p.total;
                const countedPar = rounds.reduce((sum, label, idx) => {
                  if (idx === effectiveDropIdx || displayRounds[idx] == null) return sum;
                  return sum + parForRound(label);
                }, 0);
                const displayTotal = displayUnit === "strokes" ? displayTotalToPar + countedPar : displayTotalToPar;
                const totalTone = diffTone(displayTotalToPar);
                return (
                  <tr key={p.name}>
                    <td style={{ textAlign: "center" }}>
                      <span
                        className="bco-mono"
                        style={{
                          fontSize: 12.5,
                          fontWeight: medal ? 700 : 400,
                          color: medal ? medal.fg : "#8A8371",
                          background: medal ? medal.bg : "transparent",
                          borderRadius: 999,
                          padding: medal ? "2px 7px" : 0,
                        }}
                      >
                        {isTie ? `T${rank}` : rank}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, fontWeight: 500, color: "#2C2A22" }}>{p.name}</td>
                    {rounds.map((r, ri) => {
                      const v = displayRounds[ri];
                      const dropped = ri === effectiveDropIdx;
                      if (v == null) {
                        return (
                          <td key={ri} style={{ textAlign: "center", fontSize: 12, color: "#D8D2C2" }}>
                            –
                          </td>
                        );
                      }
                      const tone = diffTone(v);
                      const shown = displayUnit === "strokes" ? v + parForRound(r) : fmtDiff(v);
                      return (
                        <td key={ri} style={{ textAlign: "center" }}>
                          <button
                            onClick={() => setDrilldown({ playerName: p.name, roundLabel: r })}
                            className="bco-mono"
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              padding: "2px 7px",
                              borderRadius: 999,
                              background: dropped ? "transparent" : tone.bg,
                              color: dropped ? "#B4AE9E" : tone.fg,
                              textDecoration: dropped ? "line-through" : "none",
                              border: "none",
                              cursor: "pointer",
                              fontFamily: "'IBM Plex Mono', monospace",
                            }}
                          >
                            {shown}
                          </button>
                        </td>
                      );
                    })}
                    <td style={{ textAlign: "right" }}>
                      <span
                        className="bco-mono"
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          padding: "3px 9px",
                          borderRadius: 999,
                          background: totalTone.bg,
                          color: totalTone.fg,
                        }}
                      >
                        {displayUnit === "strokes" ? displayTotal : fmtDiff(displayTotal)}
                      </span>
                    </td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
      )}
      {showTable && tiebreakMessages.length > 0 && (
        <div style={{ marginTop: 12, background: "#F3EFE2", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: "#8A8371", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Tiebreakers applied
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {tiebreakMessages.map((msg, i) => (
              <div key={i} style={{ fontSize: 12, color: "#3F3B32", lineHeight: 1.5 }}>
                {msg}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Solo round scorecard drill-down — broadcast-style markers (circle =
// birdie, double circle = eagle or better, plain = par, box = bogey,
// double box = double bogey or worse). Reads real hole-by-hole data from
// Supabase when live; falls back to a deterministic mock generator
// otherwise (seeded by player+round+hole, same as before).
// ---------------------------------------------------------------------------
function generateSoloRoundHoles(course, player, roundLabel) {
  const totalPar = course.holes.reduce((s, h) => s + h.par, 0);
  const courseHandicap = player ? calcCourseHandicap(player.handicapIndex, course.slope, course.rating, totalPar) : 0;

  return course.holes.map((h) => {
    const rand = seededRand(`${player?.name || "player"}-${roundLabel}-${h.number}-solo`);
    const roll = rand();
    let diff;
    if (roll < 0.05) diff = -2;
    else if (roll < 0.25) diff = -1;
    else if (roll < 0.72) diff = 0;
    else if (roll < 0.93) diff = 1;
    else diff = 2;

    const strokes = Math.max(1, h.par + diff);
    const puttsRoll = rand();
    const putts = puttsRoll < 0.15 ? 1 : puttsRoll < 0.8 ? 2 : puttsRoll < 0.95 ? 3 : 2;

    const strokeReceived = strokesForHole(courseHandicap, h.handicap, course.holes.length);
    const netStrokes = Math.min(strokes - strokeReceived, h.par + NET_DOUBLE_BOGEY);

    return { ...h, strokes, netStrokes, putts };
  });
}

function ScoreMark({ value, par }) {
  const diff = value - par;
  const num = (
    <span className="bco-mono" style={{ fontSize: 13.5, fontWeight: 600, color: "#2C2A22" }}>
      {value}
    </span>
  );
  if (!diff) return num;
  const isCircle = diff < 0;
  const isDouble = Math.abs(diff) >= 2;
  const ring = (size, inset) => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: size,
    height: size,
    border: "1.5px solid #1B4332",
    borderRadius: isCircle ? "50%" : "4px",
    boxSizing: "border-box",
  });
  if (!isDouble) return <span style={ring(23)}>{num}</span>;
  return (
    <span style={ring(29)}>
      <span style={ring(21)}>{num}</span>
    </span>
  );
}

function ScorecardNine({ title, holes, totalLabel }) {
  const parOut = holes.reduce((s, h) => s + h.par, 0);
  const grossOut = holes.reduce((s, h) => s + h.strokes, 0);
  const netOut = holes.reduce((s, h) => s + h.netStrokes, 0);
  const puttsOut = holes.reduce((s, h) => s + h.putts, 0);

  const cellStyle = { padding: "8px 4px", textAlign: "center", borderBottom: "1px solid #E4DFCE" };
  const labelStyle = { padding: "8px 8px", fontSize: 11, fontWeight: 600, color: "#3F3B32", borderBottom: "1px solid #E4DFCE", background: "#F3EFE2" };

  return (
    <div style={{ border: "1px solid #E4DFCE", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...labelStyle, background: "#1B4332", color: "#F3EFE2", textAlign: "left" }}>Hole</th>
            {holes.map((h) => (
              <th key={h.number} className="bco-mono" style={{ ...cellStyle, background: "#1B4332", color: "#F3EFE2", fontWeight: 600, borderBottom: "none" }}>
                {h.number}
              </th>
            ))}
            <th className="bco-mono" style={{ ...cellStyle, background: "#1B4332", color: "#F3EFE2", fontWeight: 600, borderBottom: "none" }}>
              {title}
            </th>
            <th className="bco-mono" style={{ ...cellStyle, background: "#1B4332", color: "#F3EFE2", fontWeight: 600, borderBottom: "none" }}>
              {totalLabel}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={labelStyle}>Par</td>
            {holes.map((h) => (
              <td key={h.number} className="bco-mono" style={cellStyle}>
                {h.par}
              </td>
            ))}
            <td className="bco-mono" style={{ ...cellStyle, fontWeight: 600 }}>
              {parOut}
            </td>
            <td className="bco-mono" style={{ ...cellStyle, fontWeight: 600 }}>
              {parOut}
            </td>
          </tr>
          <tr style={{ background: "#F9F7F0" }}>
            <td style={{ ...labelStyle, background: "#F9F7F0" }}>Stroke Index</td>
            {holes.map((h) => (
              <td key={h.number} className="bco-mono" style={{ ...cellStyle, color: "#8A8371" }}>
                {h.handicap}
              </td>
            ))}
            <td style={cellStyle}></td>
            <td style={cellStyle}></td>
          </tr>
          <tr>
            <td style={labelStyle}>Gross</td>
            {holes.map((h) => (
              <td key={h.number} style={cellStyle}>
                <ScoreMark value={h.strokes} par={h.par} />
              </td>
            ))}
            <td className="bco-mono" style={{ ...cellStyle, fontWeight: 600 }}>
              {grossOut}
            </td>
            <td className="bco-mono" style={{ ...cellStyle, fontWeight: 600 }}>
              {grossOut}
            </td>
          </tr>
          <tr style={{ background: "#F9F7F0" }}>
            <td style={{ ...labelStyle, background: "#F9F7F0" }}>Net</td>
            {holes.map((h) => (
              <td key={h.number} style={cellStyle}>
                <ScoreMark value={h.netStrokes} par={h.par} />
              </td>
            ))}
            <td className="bco-mono" style={{ ...cellStyle, fontWeight: 600 }}>
              {netOut}
            </td>
            <td className="bco-mono" style={{ ...cellStyle, fontWeight: 600 }}>
              {netOut}
            </td>
          </tr>
          <tr>
            <td style={labelStyle}>Putts</td>
            {holes.map((h) => (
              <td key={h.number} className="bco-mono" style={cellStyle}>
                {h.putts}
              </td>
            ))}
            <td className="bco-mono" style={{ ...cellStyle, fontWeight: 600 }}>
              {puttsOut}
            </td>
            <td className="bco-mono" style={{ ...cellStyle, fontWeight: 600 }}>
              {puttsOut}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SoloRoundScorecard({ playerName, roundLabel, onBack, isLive, roundsData }) {
  const player = PLAYERS.find((p) => p.name === playerName);
  const liveRound = isLive ? (roundsData || []).find((r) => r.label === roundLabel) : null;
  const course = isLive ? (liveRound ? COURSES.find((c) => c.id === liveRound.courseId) : null) || COURSES[0] : ROUND_COURSE[roundLabel] || COURSES[0];
  const roundId = isLive ? liveRound?.id || null : ROUND_ID_BY_LABEL[roundLabel] || null;

  const [liveHoles, setLiveHoles] = useState(null); // null = use mock generator
  const [liveLoading, setLiveLoading] = useState(isLive);
  const [liveError, setLiveError] = useState(null);

  useEffect(() => {
    if (!isLive || !roundId || !player) {
      setLiveLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [netScores, rawScores] = await Promise.all([fetchHoleNetScores(roundId, player.id), fetchScoresForRound(roundId, player.id)]);
        if (cancelled) return;
        if (netScores.length === 0) {
          // Round not submitted / not scored yet — nothing real to show.
          setLiveHoles([]);
        } else {
          const merged = netScores
            .map((h) => ({
              number: h.hole_number,
              par: h.par,
              handicap: h.handicap_rank,
              strokes: h.strokes,
              netStrokes: h.net_strokes,
              putts: rawScores.entries?.[h.hole_number]?.putts ?? null,
            }))
            .sort((a, b) => a.number - b.number);
          setLiveHoles(merged);
        }
      } catch (err) {
        console.error("Failed to load real scorecard:", err);
        setLiveError(err.message || String(err));
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, roundId, player?.id]);

  const holes = useMemo(() => {
    if (liveHoles && liveHoles.length > 0) return liveHoles;
    if (isLive && liveHoles && liveHoles.length === 0) return []; // real: genuinely nothing scored yet
    return generateSoloRoundHoles(course, player, roundLabel);
  }, [liveHoles, isLive, course, player, roundLabel]);

  const isRealData = isLive && liveHoles != null;
  const front = holes.slice(0, 9);
  const back = holes.slice(9, 18);
  const totalScore = holes.reduce((s, h) => s + h.strokes, 0);
  const totalPar = holes.reduce((s, h) => s + h.par, 0);

  return (
    <div>
      <ScreenHeader
        variant="compact"
        onBack={onBack}
        backLabel="Back to standings"
        title={<>{playerName} · {roundLabel}</>}
        subtitle={<>{course.name} {holes.length > 0 && `· ${totalScore} (${fmtDiff(totalScore - totalPar)})`}</>}
      />

      {liveLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 10 }}>Loading scorecard…</div>}
      {liveError && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="error">Couldn't load the real scorecard ({liveError}) — showing illustrative data instead.</Banner>
        </div>
      )}

      {!liveLoading && holes.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "#B4AE9E", textAlign: "center", padding: "24px 12px" }}>
          No scores saved for {playerName} in {roundLabel} yet.
        </div>
      ) : (
        !liveLoading && (
          <>
            <div style={{ fontSize: 10, color: "#A39C89", marginBottom: 10, lineHeight: 1.5 }}>
              ○ birdie · ◎ eagle+ · plain par · ▢ bogey · ▣ double bogey+.{" "}
              {isRealData ? "Real scores from Score entry." : "Hole-by-hole data is illustrative until real scores feed the leaderboard."}
            </div>
            <ScorecardNine title="Out" holes={front} totalLabel="Total" />
            {back.length > 0 && <ScorecardNine title="In" holes={back} totalLabel="Total" />}
          </>
        )
      )}
    </div>
  );
}

function TeamTable({ isLive, currentEventId, currentYear, roundsData }) {
  // Omit a round's column entirely if its "Team" checkbox is unchecked on
  // Round setup. Uses roundsData (resolved by Leaderboard's own year
  // picker), not the global SCORE_ROUNDS/ROUND_FLAGS.
  const rounds = isLive
    ? roundsData.filter((r) => r.countsForTeam).map((r) => r.label)
    : SCORE_ROUNDS.filter((label) => ROUND_FLAGS[label]?.countsForTeam !== false);
  const [drilldown, setDrilldown] = useState(null); // { roundId, roundLabel, teamAId, teamBId, teamAName, teamBName } | null
  const [liveRows, setLiveRows] = useState(null); // null = use mock teamResults
  const [liveLoading, setLiveLoading] = useState(isLive);
  const [liveError, setLiveError] = useState(null);

  useEffect(() => {
    if (!isLive || !currentEventId) {
      setLiveLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [dbTeams, standings, matchTotals, tiebreaks] = await Promise.all([
          fetchTeams(currentEventId),
          fetchTeamStandings(currentEventId),
          fetchTeamMatchTotals(currentEventId),
          fetchTeamTiebreakDetail(currentEventId),
        ]);
        if (cancelled) return;

        const tiebreakByTeam = Object.fromEntries(tiebreaks.map((t) => [t.team_id, t]));
        const teamIdToName = (id) => dbTeams.find((t) => t.id === id)?.name || standings.find((s) => s.team_id === id)?.name || `Team ${id}`;

        const rows = standings
          .map((s) => {
            const teamMeta = dbTeams.find((t) => t.id === s.team_id);
            const playerAName = PLAYERS.find((p) => p.id === teamMeta?.player_a_id)?.name || "?";
            const playerBName = PLAYERS.find((p) => p.id === teamMeta?.player_b_id)?.name || "?";
            const teamMatches = matchTotals.filter((m) => m.team_a_id === s.team_id || m.team_b_id === s.team_id);
            const tb = tiebreakByTeam[s.team_id];

            const roundsDetail = rounds.map((label) => {
              const match = teamMatches.find((m) => m.roundLabel === label);
              if (!match) return null;
              const myPoints = match.team_a_id === s.team_id ? match.team_a_points : match.team_b_points;
              const opponentId = match.team_a_id === s.team_id ? match.team_b_id : match.team_a_id;
              return {
                points: myPoints,
                roundId: match.round_id,
                matchupId: match.matchup_id,
                teamAId: match.team_a_id,
                teamBId: match.team_b_id,
                teamAName: teamIdToName(match.team_a_id),
                teamBName: teamIdToName(match.team_b_id),
                opponentName: teamIdToName(opponentId),
              };
            });

            // Summed from what's actually visible per round, rather than
            // trusted from a separately-computed server total — keeps the
            // Total column honest and auditable even if something upstream
            // ever double-counts a hidden match the round columns don't show.
            const pointsFromRounds = roundsDetail.reduce((sum, r) => sum + (r ? r.points : 0), 0);

            return {
              id: s.team_id,
              name: s.name,
              playerA: playerAName,
              playerB: playerBName,
              roundsDetail,
              points: pointsFromRounds,
              total: pointsFromRounds,
              yearRank: tb?.year_rank ?? null,
              decidedBy: tb?.decided_by ?? null,
            };
          })
          .sort((a, b) => (a.yearRank ?? Infinity) - (b.yearRank ?? Infinity) || b.points - a.points);

        setLiveRows(rows);
      } catch (err) {
        console.error("Failed to load live team standings:", err);
        setLiveError(err.message || String(err));
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, currentEventId]);

  if (drilldown) {
    return (
      <MatchScorecard
        isLive={isLive}
        roundId={drilldown.roundId}
        roundLabel={drilldown.roundLabel}
        matchupId={drilldown.matchupId}
        teamAName={drilldown.teamAName}
        teamBName={drilldown.teamBName}
        onBack={() => setDrilldown(null)}
      />
    );
  }

  const rows =
    liveRows ||
    teamResults.map((t) => {
      const [playerA, playerB] = t.players.split(" / ");
      return {
        id: t.name,
        name: t.name,
        playerA,
        playerB,
        roundsDetail: t.pointsByRound.map((v) => (v == null ? null : { points: v, roundId: null, teamAId: null, teamBId: null })),
        points: t.points,
        total: t.points,
      };
    });
  const tiebreakMessages = buildTiebreakMessages(rows);

  const showEmptyState = isLive && !liveLoading && !liveError && liveRows && liveRows.length === 0;
  const showTable = !liveLoading && !showEmptyState;

  return (
    <div>
      {isLive && liveError && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="error">Couldn't load live standings ({liveError}) — showing local demo data instead.</Banner>
        </div>
      )}
      {isLive && liveLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 10 }}>Loading standings…</div>}
      {showEmptyState && (
        <div style={{ fontSize: 12.5, color: "#B4AE9E", textAlign: "center", padding: "24px 12px" }}>
          No team matches recorded yet for {currentYear}.
        </div>
      )}
      {showTable && (
        <table className="bco-table">
          <thead>
            <tr>
              <th style={{ width: 22 }}>#</th>
              <th>Team</th>
              {rounds.map((r) => (
                <th key={r} style={{ textAlign: "center" }}>
                  {r}
                </th>
              ))}
              <th style={{ textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              let currentRank = 0;
              let prevPoints = null;
              const fallbackRanks = rows.map((t, i) => {
                if (prevPoints === null || t.points !== prevPoints) {
                  currentRank = i + 1;
                  prevPoints = t.points;
                }
                return currentRank;
              });
              return rows.map((t, i) => {
                const rank = t.yearRank ?? fallbackRanks[i];
                const isTie = t.yearRank != null ? t.decidedBy === "True tie" : rows.filter((r) => r.points === t.points).length > 1;
                const medal = rank === 1 ? MEDAL_TONES.gold : rank === 2 ? MEDAL_TONES.silver : rank === 3 ? MEDAL_TONES.bronze : null;
                return (
                  <tr key={t.id}>
                    <td style={{ textAlign: "center" }}>
                      <span
                        className="bco-mono"
                        style={{
                          fontSize: 12.5,
                          fontWeight: medal ? 700 : 400,
                          color: medal ? medal.fg : "#8A8371",
                          background: medal ? medal.bg : "transparent",
                          borderRadius: 999,
                          padding: medal ? "2px 7px" : 0,
                        }}
                      >
                        {isTie ? `T${rank}` : rank}
                      </span>
                    </td>
                <td>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#2C2A22" }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: "#8A8371", marginTop: 1 }}>{t.playerA}</div>
                  <div style={{ fontSize: 11, color: "#8A8371" }}>{t.playerB}</div>
                </td>
                {rounds.map((r, ri) => {
                  const detail = t.roundsDetail[ri];
                  if (detail == null) {
                    return (
                      <td key={ri} style={{ textAlign: "center", fontSize: 12.5, color: "#D8D2C2" }}>
                        –
                      </td>
                    );
                  }
                  return (
                    <td key={ri} style={{ textAlign: "center" }}>
                      <button
                        onClick={() => setDrilldown({ roundId: detail.roundId, roundLabel: r, matchupId: detail.matchupId, teamAName: detail.teamAName, teamBName: detail.teamBName })}
                        className="bco-mono"
                        style={{ fontSize: 12.5, color: "#2C2A22", border: "none", background: "none", cursor: "pointer", padding: "2px 4px" }}
                      >
                        {detail.points}
                      </button>
                    </td>
                  );
                })}
                <td style={{ textAlign: "right" }}>
                  <span className="bco-mono" style={{ fontSize: 16, fontWeight: 600, color: "#1B4332" }}>
                    {t.points}
                  </span>
                </td>
              </tr>
                );
              });
            })()}
          </tbody>
        </table>
      )}
      {showTable && tiebreakMessages.length > 0 && (
        <div style={{ marginTop: 12, background: "#F3EFE2", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: "#8A8371", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.03em" }}>
            Tiebreakers applied
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {tiebreakMessages.map((msg, i) => (
              <div key={i} style={{ fontSize: 12, color: "#3F3B32", lineHeight: 1.5 }}>
                {msg}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Match scorecard — the one shared hole-by-hole view for a team matchup,
// used from both Matches and the Team leaderboard drill-down. Deliberately
// simple: Team A net best ball, Team B net best ball, and points for each,
// per hole. Reads real data from v_team_hole_points — no mock fallback,
// since the whole point is that this is the real computation, and both
// call sites already know whether they have real team/round ids to pass in.
// ---------------------------------------------------------------------------
function PointsBadge({ points }) {
  const tone = points === 1 ? { bg: "#DCEFE3", fg: "#1B4332" } : points === 0 ? { bg: "#F7DCDA", fg: "#8C2F2A" } : { bg: "#EDEAE0", fg: "#3F3B32" };
  return (
    <Pill mono bg={tone.bg} fg={tone.fg} fontSize={12} padding="2px 0" style={{ display: "inline-block", minWidth: 26 }}>
      {points}
    </Pill>
  );
}

function MatchScorecard({ isLive, roundId, roundLabel, matchupId, teamAName, teamBName, onBack }) {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const hasRealRefs = isLive && matchupId != null;

  useEffect(() => {
    if (!hasRealRefs) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await fetchTeamHolePoints(matchupId);
        if (cancelled) return;
        setRows(data);
      } catch (err) {
        console.error("Failed to load match scorecard:", err);
        setError(err.message || String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRealRefs, matchupId]);

  const totalA = (rows || []).reduce((s, r) => s + r.team_a_points, 0);
  const totalB = (rows || []).reduce((s, r) => s + r.team_b_points, 0);

  return (
    <div>
      <ScreenHeader
        variant="compact"
        onBack={onBack}
        title={<>{teamAName} vs {teamBName} · {roundLabel}</>}
        subtitle={rows && rows.length > 0 ? <>{totalA} – {totalB}</> : undefined}
      />

      {loading && <div style={{ fontSize: 12, color: "#8A8371" }}>Loading scorecard…</div>}
      {!loading && error && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="error">Couldn't load the scorecard ({error}).</Banner>
        </div>
      )}
      {!loading && !error && !hasRealRefs && (
        <div style={{ fontSize: 12.5, color: "#B4AE9E", textAlign: "center", padding: "24px 12px" }}>
          Connect to Supabase to see the hole-by-hole scorecard for this match.
        </div>
      )}
      {!loading && !error && hasRealRefs && rows && rows.length === 0 && (
        <div style={{ fontSize: 12.5, color: "#B4AE9E", textAlign: "center", padding: "24px 12px" }}>
          No scores recorded yet for this match.
        </div>
      )}
      {!loading && rows && rows.length > 0 && (
        <table className="bco-table">
          <thead>
            <tr>
              <th style={{ width: 30 }}>Hole</th>
              <th style={{ textAlign: "center" }}>{teamAName}</th>
              <th style={{ textAlign: "center" }}>{teamBName}</th>
              <th style={{ textAlign: "center" }}>Pts A</th>
              <th style={{ textAlign: "center" }}>Pts B</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.hole_number}>
                <td className="bco-mono" style={{ fontSize: 12.5, color: "#8A8371" }}>
                  {r.hole_number}
                </td>
                <td
                  className="bco-mono"
                  style={{ textAlign: "center", fontSize: 13, fontWeight: r.team_a_points > r.team_b_points ? 600 : 400, color: r.team_a_points > r.team_b_points ? "#1B4332" : "#2C2A22" }}
                >
                  {r.team_a_net}
                </td>
                <td
                  className="bco-mono"
                  style={{ textAlign: "center", fontSize: 13, fontWeight: r.team_b_points > r.team_a_points ? 600 : 400, color: r.team_b_points > r.team_a_points ? "#1B4332" : "#2C2A22" }}
                >
                  {r.team_b_net}
                </td>
                <td style={{ textAlign: "center" }}>
                  <PointsBadge points={r.team_a_points} />
                </td>
                <td style={{ textAlign: "center" }}>
                  <PointsBadge points={r.team_b_points} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="bco-mono" style={{ fontSize: 12, fontWeight: 600, color: "#3F3B32" }}>
                Total
              </td>
              <td></td>
              <td></td>
              <td className="bco-mono" style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "#1B4332" }}>
                {totalA}
              </td>
              <td className="bco-mono" style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "#1B4332" }}>
                {totalB}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}

function CarrollCupTable({ isLive, currentEventId, roundsData }) {
  const [drilldown, setDrilldown] = useState(null); // round label | null
  const [drilldownMatches, setDrilldownMatches] = useState(null); // null = loading/mock
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [liveStandings, setLiveStandings] = useState(null); // { red_points, blue_points } | null
  const [liveRoundStandings, setLiveRoundStandings] = useState(null); // [{round_id, red_points, blue_points}] | null
  const [liveLoading, setLiveLoading] = useState(isLive);
  const [liveError, setLiveError] = useState(null);

  const TEAM_COLORS = {
    red: { bg: "#F7DCDA", fg: "#8C2F2A", bar: "#C1554E", label: "Team Red" },
    blue: { bg: "#DCE7F2", fg: "#26456B", bar: "#4D7BAA", label: "Team Blue" },
  };

  useEffect(() => {
    if (!isLive || !currentEventId) {
      setLiveLoading(false);
      return;
    }
    let cancelled = false;
    setLiveLoading(true);
    (async () => {
      try {
        const [standings, roundStandings] = await Promise.all([fetchCarrollCupStandings(currentEventId), fetchCarrollCupRoundStandings(currentEventId)]);
        if (cancelled) return;
        setLiveStandings(standings);
        setLiveRoundStandings(roundStandings);
      } catch (err) {
        console.error("Failed to load Carroll Cup standings:", err);
        setLiveError(err.message || String(err));
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, currentEventId]);

  const isRealData = isLive && liveStandings != null;

  const standingsRows = isRealData
    ? [
        { team: "red", points: Number(liveStandings.red_points) },
        { team: "blue", points: Number(liveStandings.blue_points) },
      ]
    : CARROLL_CUP_STANDINGS;
  const totalPoints = standingsRows.reduce((s, t) => s + t.points, 0);
  const leader = standingsRows.reduce((a, b) => (b.points > a.points ? b : a));

  // Carroll Cup defaults to EXCLUDED unless a round is explicitly flagged
  // (unlike Solo/Team, which default to included).
  const roundRows = isLive
    ? roundsData
        .filter((r) => r.countsForCarrollCup)
        .map((r) => {
          const row = (liveRoundStandings || []).find((rs) => rs.round_id === r.id);
          return { label: r.label, id: r.id, red: row ? Number(row.red_points) : 0, blue: row ? Number(row.blue_points) : 0, hasMatches: !!row };
        })
    : SCORE_ROUNDS.filter((label) => ROUND_FLAGS[label]?.countsForCarrollCup === true || Object.keys(ROUND_FLAGS).length === 0).map((label) => {
        const matches = CARROLL_CUP_MATCHES_BY_ROUND[label] || [];
        return {
          label,
          id: null,
          red: matches.reduce((s, m) => s + m.redPoints, 0),
          blue: matches.reduce((s, m) => s + m.bluePoints, 0),
          hasMatches: matches.length > 0,
        };
      });

  const openDrilldown = async (roundRow) => {
    setDrilldown(roundRow.label);
    if (!isRealData) return;
    const roundId = roundRow.id;
    if (!roundId) {
      setDrilldownMatches([]);
      return;
    }
    setDrilldownLoading(true);
    try {
      const results = await fetchCarrollCupMatchResults(roundId);
      setDrilldownMatches(
        results.map((r) => ({
          red: r.a_color === "red" ? r.a_name : r.b_name,
          blue: r.a_color === "red" ? r.b_name : r.a_name,
          redPoints: r.a_color === "red" ? r.a_points : r.b_points,
          bluePoints: r.a_color === "red" ? r.b_points : r.a_points,
        }))
      );
    } catch (err) {
      console.error("Failed to load Carroll Cup matchup detail:", err);
      setDrilldownMatches([]);
    } finally {
      setDrilldownLoading(false);
    }
  };

  if (drilldown) {
    const matches = isRealData ? drilldownMatches : CARROLL_CUP_MATCHES_BY_ROUND[drilldown] || [];
    return (
      <div>
        <ScreenHeader
          variant="compact"
          onBack={() => {
            setDrilldown(null);
            setDrilldownMatches(null);
          }}
          title={<>Carroll Cup · {drilldown}</>}
        />

        {!isRealData && (
          <div style={{ fontSize: 10, color: "#A39C89", marginBottom: 10, lineHeight: 1.5 }}>Not connected to Supabase — showing local demo data.</div>
        )}

        {drilldownLoading ? (
          <div style={{ fontSize: 12, color: "#8A8371", textAlign: "center", padding: "20px 12px" }}>Loading…</div>
        ) : !matches || matches.length === 0 ? (
          <div style={{ fontSize: 12, color: "#B4AE9E", textAlign: "center", padding: "20px 12px" }}>
            No Carroll Cup matches recorded for {drilldown} yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {matches.map((m, i) => {
              const redWon = m.redPoints != null && m.bluePoints != null && m.redPoints > m.bluePoints;
              const blueWon = m.redPoints != null && m.bluePoints != null && m.bluePoints > m.redPoints;
              return (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto 1fr",
                    alignItems: "center",
                    gap: 8,
                    background: "#FFFFFF",
                    border: "1px solid #E4DFCE",
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      textAlign: "right",
                      fontSize: 12.5,
                      fontWeight: redWon ? 600 : 400,
                      color: redWon ? TEAM_COLORS.red.fg : "#2C2A22",
                      background: redWon ? TEAM_COLORS.red.bg : "transparent",
                      padding: "9px 12px",
                    }}
                  >
                    {m.red}
                  </div>
                  <div className="bco-mono" style={{ fontSize: 13, fontWeight: 600, color: "#6B6455", whiteSpace: "nowrap" }}>
                    {m.redPoints} – {m.bluePoints}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: blueWon ? 600 : 400,
                      color: blueWon ? TEAM_COLORS.blue.fg : "#2C2A22",
                      background: blueWon ? TEAM_COLORS.blue.bg : "transparent",
                      padding: "9px 12px",
                    }}
                  >
                    {m.blue}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {isLive && liveError && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="error">Couldn't load live Carroll Cup data ({liveError}) — showing local demo data instead.</Banner>
        </div>
      )}
      {isLive && liveLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 10 }}>Loading…</div>}

      <div style={{ display: "flex", gap: 10 }}>
        {standingsRows.map((t) => {
          const c = TEAM_COLORS[t.team];
          const isLeader = t.team === leader.team;
          return (
            <div
              key={t.team}
              style={{
                flex: 1,
                background: c.bg,
                borderRadius: 12,
                padding: "16px 14px",
                textAlign: "center",
                border: isLeader ? `1.5px solid ${c.bar}` : "1px solid transparent",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: c.fg, letterSpacing: "0.02em" }}>
                {c.label.toUpperCase()}
                {isLeader && " ▲"}
              </div>
              <div className="bco-mono" style={{ fontSize: 30, fontWeight: 600, color: c.fg, marginTop: 4 }}>
                {t.points}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", height: 8, borderRadius: 999, overflow: "hidden", marginTop: 12 }}>
        {standingsRows.map((t) => {
          const c = TEAM_COLORS[t.team];
          const pct = totalPoints ? (t.points / totalPoints) * 100 : 50;
          return <div key={t.team} style={{ width: `${pct}%`, background: c.bar }} />;
        })}
      </div>

      <div style={{ fontSize: 10, color: "#A39C89", margin: "14px 0 8px", lineHeight: 1.5 }}>
        Tap a round for that round's individual matchups.
      </div>

      <table className="bco-table">
        <thead>
          <tr>
            <th>Round</th>
            <th style={{ textAlign: "center", color: "#8C2F2A" }}>Red</th>
            <th style={{ textAlign: "center", color: "#26456B" }}>Blue</th>
          </tr>
        </thead>
        <tbody>
          {roundRows.map((r) => (
            <tr key={r.label}>
              <td>
                <button
                  onClick={() => openDrilldown(r)}
                  className="bco-mono"
                  style={{ fontSize: 13, fontWeight: 600, color: "#2C2A22", border: "none", background: "none", cursor: "pointer", padding: "4px 0" }}
                >
                  {r.label}
                </button>
              </td>
              <td className="bco-mono" style={{ textAlign: "center", fontSize: 13, color: r.hasMatches ? "#8C2F2A" : "#D8D2C2" }}>
                {r.hasMatches ? r.red : "–"}
              </td>
              <td className="bco-mono" style={{ textAlign: "center", fontSize: 13, color: r.hasMatches ? "#26456B" : "#D8D2C2" }}>
                {r.hasMatches ? r.blue : "–"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------
function StatusBadge({ status }) {
  const map = {
    submitted: { label: "Submitted", bg: "#DCEFE3", fg: "#1B4332" },
    "in-progress": { label: "In progress", bg: "#FBEAD9", fg: "#8A4B1E" },
  };
  const s = map[status] || { label: "Not started", bg: "#EDEAE0", fg: "#6B6455" };
  return <Pill bg={s.bg} fg={s.fg}>{s.label}</Pill>;
}

function StrokeBubble({ label, value, unavailable }) {
  return <StatTile variant="stroke" label={label} value={value} unavailable={unavailable} />;
}

function HcpBubble({ label, value }) {
  return <StatTile variant="hcp" label={label} value={value} />;
}

function TotalStat({ label, value, sub, emphasize }) {
  return <StatTile variant="total" label={label} value={value} sub={sub} emphasize={emphasize} />;
}

function StubScreen({ icon: Icon, title, note }) {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "40px 32px", color: "#8A8371" }}>
      <Icon size={26} strokeWidth={1.6} style={{ marginBottom: 10, color: "#B9B3A2" }} />
      <div className="bco-display" style={{ fontSize: 16, fontWeight: 600, color: "#3F3B32", marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 12.5, lineHeight: 1.5, maxWidth: 260 }}>{note}</div>
    </div>
  );
}
