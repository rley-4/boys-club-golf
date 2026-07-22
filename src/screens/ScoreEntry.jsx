import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  fetchScoresForRound,
  upsertScores,
  upsertSubmission,
  clearScores,
  verifyRoundBelongsToEvent,
  fetchAllPlayerCompetedYears,
  fetchTeams,
  fetchTeamHoleResults,
  upsertTeamHoleResult,
  fetchRoundMatchups,
  fetchCarrollCupRoster,
} from "../lib/api.js";
import { Banner } from "../components/Banner.jsx";
import { Button } from "../components/Button.jsx";
import { Pill } from "../components/Pill.jsx";
import { StatTile } from "../components/StatTile.jsx";
import { scoreLabel, scoreTone, NET_DOUBLE_BOGEY } from "../lib/format.js";
import { useYearRoundData } from "../hooks/useYearRoundData.js";
import { calcCourseHandicap, strokesForHole, computeMatchPops, computeMatchPopsLive } from "../lib/handicap.js";
import {
  COURSES,
  ROUND_COURSE,
  PLAYERS,
  TEAMS,
  CARROLL_CUP_ROSTER_DEFAULT,
  SCORE_ROUNDS,
  ROUND_ID_BY_LABEL,
  ROUND_FORMATS,
} from "../data/dummyData.js";

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

// ---------------------------------------------------------------------------
// Score entry tab
// ---------------------------------------------------------------------------
export function ScoreEntry({ scoresStore, setScoresStore, currentYear, isLive, loadError, currentEventId, myPlayer }) {
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
