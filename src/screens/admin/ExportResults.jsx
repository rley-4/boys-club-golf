import React, { useState } from "react";
import { fetchSoloStandings, fetchTeamStandings, fetchSkins, fetchPokerCards } from "../../lib/stats.js";
import { fetchTeams } from "../../lib/api.js";
import { ScreenHeader } from "../../components/ScreenHeader.jsx";
import { Banner } from "../../components/Banner.jsx";
import { AutoComputedNote } from "../../components/AutoComputedNote.jsx";
import { Button } from "../../components/Button.jsx";
import { fmtDiff } from "../../lib/format.js";
import { soloRecordsSorted, teamRecordsSorted, soloResults, teamResults } from "../../lib/yearlyStats.js";
import { PLAYERS, SKINS_PREVIEW, POKER_PREVIEW, SCORE_ROUNDS, ROUND_ID_BY_LABEL } from "../../data/dummyData.js";

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

export function ExportResults({ onBack, isLive, currentEventId }) {
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
