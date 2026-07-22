import React, { useState, useMemo, useRef, useEffect } from "react";
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
  fetchLowNetSolo,
  fetchLowNetTeam,
} from "./lib/stats.js";
import {
  fetchScoresForRound,
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
  fetchTeams,
  fetchRoundMatchups,
  fetchCarrollCupRoster,
} from "./lib/api.js";
import { Flag, Trophy, Coins, MoreHorizontal, Swords, MessagesSquare } from "lucide-react";
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
import { scoreLabel, scoreTone, fmtDiff, fmtStat, diffTone, ordinal, formatCalculatedAt, MEDAL_TONES, NET_DOUBLE_BOGEY } from "./lib/format.js";
import { useYearRoundData } from "./hooks/useYearRoundData.js";
import { calcCourseHandicap, strokesForHole } from "./lib/handicap.js";
import { seededRand, attendedYears, yearlySoloStat, yearlyTeamStat, soloResults, teamResults } from "./lib/yearlyStats.js";
import { MessagesScreen } from "./screens/Messages.jsx";
import { GamesTab } from "./screens/Games.jsx";
import { More } from "./screens/More.jsx";
import { ScoreEntry } from "./screens/ScoreEntry.jsx";
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
  TEAM_RECORDS,
  SOLO_RECORDS,
  RECORD_YEARS,
  TEAMS,
  MATCHES_BY_ROUND,
  SCORE_ROUNDS,
  ROUND_ID_BY_LABEL,
  ROUND_FLAGS,
  ROUND_FORMATS,
} from "./data/dummyData.js";

export { COURSES, ROUND_COURSE, WIREFRAME_YEARS, PLAYERS, SCORE_ROUNDS, ROUND_ID_BY_LABEL, ROUND_FLAGS, ROUND_FORMATS };
// Score entry always writes to the current event year.
const CURRENT_YEAR = RECORD_YEARS[0];

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
