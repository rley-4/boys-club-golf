import React, { useState, useEffect } from "react";
import { fetchEventByYear, fetchPlayers, fetchRounds } from "./lib/api.js";
import { Flag, Trophy, Coins, MoreHorizontal, Swords, MessagesSquare } from "lucide-react";
import { ThemeProvider, Paper, BottomNavigation, BottomNavigationAction } from "@mui/material";
import theme from "./theme.js";
import { MessagesScreen } from "./screens/Messages.jsx";
import { GamesTab } from "./screens/Games.jsx";
import { More } from "./screens/More.jsx";
import { ScoreEntry } from "./screens/ScoreEntry.jsx";
import { MatchResultsTab } from "./screens/MatchResults.jsx";
import { Leaderboard } from "./screens/Leaderboard/index.jsx";
import {
  COURSES,
  ROUND_COURSE,
  WIREFRAME_YEARS,
  PLAYERS,
  RECORD_YEARS,
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
