import React, { useState, useMemo, useEffect } from "react";
import { fetchTeamMatchTotals } from "../lib/stats.js";
import { fetchTeams, fetchRoundMatchups, fetchCarrollCupRoster } from "../lib/api.js";
import { Pill } from "../components/Pill.jsx";
import { YearRoundPicker, RoundPicker } from "../components/YearRoundPicker.jsx";
import { useYearRoundData } from "../hooks/useYearRoundData.js";
import { calcCourseHandicap } from "../lib/handicap.js";
import { PLAYERS, COURSES, ROUND_COURSE, TEAMS, MATCHES_BY_ROUND, SCORE_ROUNDS } from "../data/dummyData.js";
import { MatchScorecard } from "./Leaderboard/MatchScorecard.jsx";

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

export function MatchResultsTab({ scoresStore, currentYear, isLive, currentEventId }) {
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
