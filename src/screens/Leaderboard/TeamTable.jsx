import React, { useState, useEffect } from "react";
import { fetchTeamStandings, fetchTeamMatchTotals } from "../../lib/stats.js";
import { fetchTeams, fetchTeamTiebreakDetail } from "../../lib/api.js";
import { Banner } from "../../components/Banner.jsx";
import { MEDAL_TONES } from "../../lib/format.js";
import { teamResults } from "../../lib/yearlyStats.js";
import { PLAYERS, SCORE_ROUNDS, ROUND_FLAGS } from "../../data/dummyData.js";
import { MatchScorecard } from "./MatchScorecard.jsx";
import { buildTiebreakMessages } from "./tiebreak.js";

export function TeamTable({ isLive, currentEventId, currentYear, roundsData }) {
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
