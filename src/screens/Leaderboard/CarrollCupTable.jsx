import React, { useState, useEffect } from "react";
import { fetchCarrollCupStandings, fetchCarrollCupRoundStandings, fetchCarrollCupMatchResults } from "../../lib/stats.js";
import { ScreenHeader } from "../../components/ScreenHeader.jsx";
import { Banner } from "../../components/Banner.jsx";
import { CARROLL_CUP_STANDINGS, CARROLL_CUP_MATCHES_BY_ROUND, SCORE_ROUNDS, ROUND_FLAGS } from "../../data/dummyData.js";

export function CarrollCupTable({ isLive, currentEventId, roundsData }) {
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
