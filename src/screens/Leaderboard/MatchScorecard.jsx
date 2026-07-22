import React, { useState, useEffect } from "react";
import { fetchTeamHolePoints } from "../../lib/stats.js";
import { ScreenHeader } from "../../components/ScreenHeader.jsx";
import { Banner } from "../../components/Banner.jsx";
import { Pill } from "../../components/Pill.jsx";

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

export function MatchScorecard({ isLive, roundId, roundLabel, matchupId, teamAName, teamBName, onBack }) {
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
