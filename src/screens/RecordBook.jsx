import { useState, useEffect, useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { fetchEvents, fetchAllPayoutSnapshots } from "../lib/api.js";
import {
  fetchSoloRecordBook,
  fetchSoloYearRanks,
  fetchAllSoloRoundTotals,
  fetchTeamRecordBook,
  fetchPlayerTeamYearRanks,
  fetchPlayerTeamMatchPoints,
  fetchPlayerTeamMatchRecord,
} from "../lib/stats.js";
import { PLAYERS, RECORD_YEARS } from "../data/dummyData.js";
import { fmtStat } from "../lib/format.js";
import { teamRecordsSorted, soloRecordsSorted, attendedYears, yearlySoloStat, yearlyTeamStat } from "../lib/yearlyStats.js";
import { ScreenHeader } from "../components/ScreenHeader.jsx";
import { StatTile } from "../components/StatTile.jsx";
import { Banner } from "../components/Banner.jsx";
import { YearPill } from "../components/YearRoundPicker.jsx";

export function RecordBook({ onBack, isLive, myPlayer }) {
  const [mode, setMode] = useState("solo");
  const [year, setYear] = useState("all");
  const [expanded, setExpanded] = useState(null);

  // Live Solo data — fetched once, aggregated client-side both all-time and
  // per-year, so the year filter is just re-filtering the same fetch.
  const [liveYears, setLiveYears] = useState([]); // [{id, year}]
  const [liveAllTime, setLiveAllTime] = useState(null); // v_solo_record_book rows
  const [liveRanks, setLiveRanks] = useState(null); // v_solo_year_rank rows
  const [liveRoundTotals, setLiveRoundTotals] = useState(null); // fetchAllSoloRoundTotals rows
  const [liveLoading, setLiveLoading] = useState(isLive);
  const [liveError, setLiveError] = useState(null);

  // Live Team data — same "fetch once, filter client-side" approach.
  const [liveTeamYears, setLiveTeamYears] = useState([]); // [{id, year}]
  const [liveTeamAllTime, setLiveTeamAllTime] = useState(null); // v_team_record_book rows
  const [liveTeamRanks, setLiveTeamRanks] = useState(null); // v_player_team_year_rank rows
  const [liveTeamMatchPoints, setLiveTeamMatchPoints] = useState(null); // v_player_team_match_points rows
  const [liveTeamMatchRecord, setLiveTeamMatchRecord] = useState(null); // v_player_team_match_record rows
  const [liveTeamLoading, setLiveTeamLoading] = useState(isLive);
  const [liveTeamError, setLiveTeamError] = useState(null);

  // Earnings — reads the cached payout snapshot (see Admin > Games/Competition
  // Results for how it gets populated), not a live computation.
  const [liveEarningsYears, setLiveEarningsYears] = useState([]); // [{id, year}]
  const [liveEarnings, setLiveEarnings] = useState(null); // raw payout_snapshots rows
  const [liveEarningsLoading, setLiveEarningsLoading] = useState(isLive);
  const [liveEarningsError, setLiveEarningsError] = useState(null);

  useEffect(() => {
    if (!isLive || mode !== "solo") {
      setLiveLoading(false);
      return;
    }
    let cancelled = false;
    setLiveLoading(true);
    (async () => {
      try {
        const [events, allTime, ranks, roundTotals] = await Promise.all([
          fetchEvents(),
          fetchSoloRecordBook(),
          fetchSoloYearRanks(),
          fetchAllSoloRoundTotals(),
        ]);
        if (cancelled) return;
        setLiveYears(events.map((e) => ({ id: e.id, year: e.year })).sort((a, b) => b.year - a.year));
        setLiveAllTime(allTime);
        setLiveRanks(ranks);
        setLiveRoundTotals(roundTotals);
      } catch (err) {
        console.error("Failed to load Solo record book:", err);
        setLiveError(err.message || String(err));
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, mode]);

  useEffect(() => {
    if (!isLive || mode !== "team") {
      setLiveTeamLoading(false);
      return;
    }
    let cancelled = false;
    setLiveTeamLoading(true);
    (async () => {
      try {
        const [events, allTime, ranks, matchPoints, matchRecord] = await Promise.all([
          fetchEvents(),
          fetchTeamRecordBook(),
          fetchPlayerTeamYearRanks(),
          fetchPlayerTeamMatchPoints(),
          fetchPlayerTeamMatchRecord(),
        ]);
        if (cancelled) return;
        setLiveTeamYears(events.map((e) => ({ id: e.id, year: e.year })).sort((a, b) => b.year - a.year));
        setLiveTeamAllTime(allTime);
        setLiveTeamRanks(ranks);
        setLiveTeamMatchPoints(matchPoints);
        setLiveTeamMatchRecord(matchRecord);
      } catch (err) {
        console.error("Failed to load Team record book:", err);
        setLiveTeamError(err.message || String(err));
      } finally {
        if (!cancelled) setLiveTeamLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, mode]);

  useEffect(() => {
    if (!isLive || mode !== "earnings") {
      setLiveEarningsLoading(false);
      return;
    }
    let cancelled = false;
    setLiveEarningsLoading(true);
    setLiveEarningsError(null);
    (async () => {
      try {
        const [events, snapshotRows] = await Promise.all([fetchEvents(), fetchAllPayoutSnapshots()]);
        if (cancelled) return;
        setLiveEarningsYears(events.map((e) => ({ id: e.id, year: e.year })).sort((a, b) => b.year - a.year));
        setLiveEarnings(snapshotRows);
      } catch (err) {
        console.error("Failed to load earnings:", err);
        setLiveEarningsError(err.message || String(err));
      } finally {
        if (!cancelled) setLiveEarningsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, mode]);

  const isLiveSolo = mode === "solo" && isLive && liveAllTime != null;

  // Shaped to match the mock SOLO_RECORDS fields, so the existing render
  // logic below doesn't need to branch on live vs mock.
  const liveSoloRecords = useMemo(() => {
    if (!isLiveSolo) return null;
    return liveAllTime
      .map((r) => {
        const myRanks = (liveRanks || []).filter((rk) => rk.player_id === r.player_id);
        const posAvg = myRanks.length ? myRanks.reduce((s, rk) => s + rk.year_rank, 0) / myRanks.length : r.best_finish;
        const podium1 = myRanks.filter((rk) => rk.year_rank === 1).length;
        const podium2 = myRanks.filter((rk) => rk.year_rank === 2).length;
        const podium3 = myRanks.filter((rk) => rk.year_rank === 3).length;
        const attendedEventIds = myRanks.map((rk) => rk.event_id);
        return {
          playerId: r.player_id,
          name: r.name,
          app: r.appearances,
          posAvg,
          posBest: r.best_finish,
          posWorst: r.worst_finish,
          podium1,
          podium2,
          podium3,
          grossAvg: Number(r.gross_avg_strokes),
          grossToPar: Number(r.gross_avg_to_par),
          netAvg: Number(r.net_avg_strokes),
          netToPar: Number(r.net_avg_to_par),
          attendedEventIds,
        };
      })
      .sort((a, b) => a.posAvg - b.posAvg);
  }, [isLiveSolo, liveAllTime, liveRanks]);

  const liveYearStat = (playerId, eventId) => {
    const rankRow = (liveRanks || []).find((rk) => rk.player_id === playerId && rk.event_id === eventId);
    const rounds = (liveRoundTotals || []).filter((rt) => rt.playerId === playerId && rt.eventId === eventId);
    if (!rankRow || rounds.length === 0) return null;
    const avg = (key) => rounds.reduce((s, r) => s + r[key], 0) / rounds.length;
    return {
      pos: rankRow.year_rank,
      podium: rankRow.year_rank <= 3,
      gross: avg("grossTotal"),
      grossToPar: avg("grossToPar"),
      net: avg("netTotal"),
      netToPar: avg("netToPar"),
    };
  };

  const isLiveTeam = mode === "team" && isLive && liveTeamAllTime != null;

  const liveTeamRecords = useMemo(() => {
    if (!isLiveTeam) return null;
    return liveTeamAllTime
      .map((r) => {
        const myRanks = (liveTeamRanks || []).filter((rk) => rk.player_id === r.player_id);
        const posAvg = myRanks.length ? myRanks.reduce((s, rk) => s + rk.year_rank, 0) / myRanks.length : r.best_finish;
        const podium1 = myRanks.filter((rk) => rk.year_rank === 1).length;
        const podium2 = myRanks.filter((rk) => rk.year_rank === 2).length;
        const podium3 = myRanks.filter((rk) => rk.year_rank === 3).length;
        const attendedEventIds = myRanks.map((rk) => rk.event_id);
        return {
          playerId: r.player_id,
          name: r.name,
          app: r.appearances,
          posAvg,
          posBest: r.best_finish,
          posWorst: r.worst_finish,
          podium1,
          podium2,
          podium3,
          ptsLow: Number(r.pts_low),
          ptsAvg: Number(r.pts_avg),
          ptsHigh: Number(r.pts_high),
          win: r.win,
          loss: r.loss,
          tie: r.tie,
          winPct: Number(r.win_pct),
          attendedEventIds,
        };
      })
      .sort((a, b) => a.posAvg - b.posAvg);
  }, [isLiveTeam, liveTeamAllTime, liveTeamRanks]);

  const liveTeamYearStat = (playerId, eventId) => {
    const rankRow = (liveTeamRanks || []).find((rk) => rk.player_id === playerId && rk.event_id === eventId);
    if (!rankRow) return null;
    // team_id is unique per year (a fresh teams row each event), so it's
    // the correct key to scope this player's matches to just this year.
    const matches = (liveTeamMatchPoints || []).filter((mp) => mp.player_id === playerId && mp.team_id === rankRow.team_id);
    const results = (liveTeamMatchRecord || []).filter((mr) => mr.player_id === playerId && mr.team_id === rankRow.team_id);
    const win = results.filter((r) => r.result === "win").length;
    const loss = results.filter((r) => r.result === "loss").length;
    const tie = results.filter((r) => r.result === "tie").length;
    const ptsAvg = matches.length ? matches.reduce((s, m) => s + m.historical_points, 0) / matches.length : 0;
    return { pos: rankRow.year_rank, podium: rankRow.year_rank <= 3, win, loss, tie, ptsAvg };
  };

  const toggleExpanded = (name) => setExpanded((prev) => (prev === name ? null : name));

  const baseRecords = mode === "solo" ? (liveSoloRecords || soloRecordsSorted) : (liveTeamRecords || teamRecordsSorted);
  const yearOptions =
    mode === "solo" && isLiveSolo
      ? liveYears.map((y) => y.year)
      : mode === "team" && isLiveTeam
      ? liveTeamYears.map((y) => y.year)
      : mode === "earnings"
      ? liveEarningsYears.map((y) => y.year)
      : RECORD_YEARS;

  const displayRows = useMemo(() => {
    if (year === "all") return baseRecords.map((p) => ({ p, yearStat: null }));
    if (isLiveSolo) {
      const yearRow = liveYears.find((y) => y.year === year);
      if (!yearRow) return [];
      return baseRecords
        .filter((p) => (p.attendedEventIds || []).includes(yearRow.id))
        .map((p) => ({ p, yearStat: liveYearStat(p.playerId, yearRow.id) }))
        .filter((row) => row.yearStat)
        .sort((a, b) => a.yearStat.pos - b.yearStat.pos);
    }
    if (isLiveTeam) {
      const yearRow = liveTeamYears.find((y) => y.year === year);
      if (!yearRow) return [];
      return baseRecords
        .filter((p) => (p.attendedEventIds || []).includes(yearRow.id))
        .map((p) => ({ p, yearStat: liveTeamYearStat(p.playerId, yearRow.id) }))
        .filter((row) => row.yearStat)
        .sort((a, b) => a.yearStat.pos - b.yearStat.pos);
    }
    return baseRecords
      .filter((p) => attendedYears(p.app).includes(year))
      .map((p) => ({ p, yearStat: mode === "solo" ? yearlySoloStat(p, year) : yearlyTeamStat(p, year) }))
      .sort((a, b) => a.yearStat.pos - b.yearStat.pos);
  }, [baseRecords, year, mode, isLiveSolo, liveYears, liveRanks, liveRoundTotals, isLiveTeam, liveTeamYears, liveTeamRanks, liveTeamMatchPoints, liveTeamMatchRecord]);

  return (
    <div style={{ padding: "14px 20px 24px" }}>
      <div className="bco-sticky-header" style={{ paddingBottom: 4 }}>
      <ScreenHeader title="Record Book" onBack={onBack} backLabel="Back to More" marginBottom={10} />

      <div className="bco-seg" style={{ marginBottom: 10 }}>
        <button
          className={`bco-seg-btn${mode === "solo" ? " active" : ""}`}
          onClick={() => {
            setMode("solo");
            setYear("all");
          }}
        >
          Solo
        </button>
        <button
          className={`bco-seg-btn${mode === "team" ? " active" : ""}`}
          onClick={() => {
            setMode("team");
            setYear("all");
          }}
        >
          Team
        </button>
        <button
          className={`bco-seg-btn${mode === "earnings" ? " active" : ""}`}
          onClick={() => {
            setMode("earnings");
            setYear("all");
          }}
        >
          Earnings
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 10 }}>
        <YearPill label="All-time" active={year === "all"} onClick={() => setYear("all")} />
        {yearOptions.map((y) => (
          <YearPill key={y} label={String(y)} active={year === y} onClick={() => setYear(y)} />
        ))}
      </div>
      </div>

      {mode === "solo" && isLive && liveError && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="error">Couldn't load live record book ({liveError}) — showing local demo data instead.</Banner>
        </div>
      )}
      {mode === "solo" && isLive && liveLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 10 }}>Loading…</div>}
      {mode === "team" && isLive && liveTeamError && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="error">Couldn't load live record book ({liveTeamError}) — showing local demo data instead.</Banner>
        </div>
      )}
      {mode === "team" && isLive && liveTeamLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 10 }}>Loading…</div>}
      {mode === "earnings" && isLive && liveEarningsError && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="error">Couldn't load earnings ({liveEarningsError}).</Banner>
        </div>
      )}
      {mode === "earnings" && isLive && liveEarningsLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 10 }}>Loading…</div>}

      {mode === "earnings" ? (
        <EarningsTable snapshots={liveEarnings || []} years={liveEarningsYears} year={year} loading={isLive && liveEarningsLoading} isLive={isLive} />
      ) : (
        <>
      <div style={{ fontSize: 10.5, color: "#A39C89", marginBottom: 10, lineHeight: 1.5 }}>
        {year === "all"
          ? "Sorted by average finish. Tap a player for full stats."
          : `${displayRows.length} player${displayRows.length !== 1 ? "s" : ""} competed in ${year}. Sorted by finish.`}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {displayRows.map(({ p, yearStat }) => {
          const isOpen = expanded === p.name;
          const podiumTotal = p.podium1 + p.podium2 + p.podium3;
          return (
            <div key={p.name} style={{ background: "#FFFFFF", border: "1px solid #E4DFCE", borderRadius: 12, overflow: "hidden" }}>
              <button
                onClick={() => toggleExpanded(p.name)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "11px 14px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#2C2A22" }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "#8A8371", marginTop: 1 }}>
                    {year === "all"
                      ? `${p.app} appearance${p.app !== 1 ? "s" : ""} · ${podiumTotal} podium${podiumTotal !== 1 ? "s" : ""}`
                      : yearStat.podium
                      ? "Podium finish"
                      : "No podium"}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 9.5, fontWeight: 600, color: "#8A8371", letterSpacing: "0.03em" }}>
                      {year === "all" ? "AVG" : "FINISH"}
                    </div>
                    <div className="bco-mono" style={{ fontSize: 16, fontWeight: 600, color: "#1B4332" }}>
                      {year === "all" ? fmtStat(p.posAvg) : `#${yearStat.pos}`}
                    </div>
                  </div>
                  <ChevronRight
                    size={15}
                    color="#B9B3A2"
                    style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s ease" }}
                  />
                </div>
              </button>

              {isOpen && (
                <div style={{ padding: "2px 14px 14px", borderTop: "1px solid #EFEBDE" }}>
                  {year === "all" ? (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 10 }}>
                        <StatTile variant="block" label="Best" value={`#${p.posBest}`} />
                        <StatTile variant="block" label="Worst" value={`#${p.posWorst}`} />
                        <StatTile variant="block" label="Podiums" value={`${podiumTotal}`} sub={`${p.podium1}-${p.podium2}-${p.podium3}`} />
                      </div>
                      {mode === "solo" ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginTop: 8 }}>
                          <StatTile variant="block" label="Gross avg" value={fmtStat(p.grossAvg)} sub={`+${fmtStat(p.grossToPar)} to par`} />
                          <StatTile variant="block" label="Net avg" value={fmtStat(p.netAvg)} sub={`${Number(p.netToPar) >= 0 ? "+" : ""}${fmtStat(p.netToPar)} to par`} />
                        </div>
                      ) : (
                        <>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 8 }}>
                            <StatTile variant="block" label="Pts / match low" value={fmtStat(p.ptsLow)} />
                            <StatTile variant="block" label="Pts / match avg" value={fmtStat(p.ptsAvg)} />
                            <StatTile variant="block" label="Pts / match high" value={fmtStat(p.ptsHigh)} />
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginTop: 8 }}>
                            <StatTile variant="block" label="Record" value={`${p.win}-${p.loss}-${p.tie}`} sub="W-L-T" />
                            <StatTile variant="block" label="Win %" value={`${p.winPct}%`} />
                          </div>
                        </>
                      )}
                    </>
                  ) : mode === "solo" ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginTop: 10 }}>
                      <StatTile variant="block" label="Gross" value={fmtStat(yearStat.gross)} sub={`+${fmtStat(yearStat.grossToPar)} to par`} />
                      <StatTile variant="block" label="Net" value={fmtStat(yearStat.net)} sub={`${Number(yearStat.netToPar) >= 0 ? "+" : ""}${fmtStat(yearStat.netToPar)} to par`} />
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginTop: 10 }}>
                      <StatTile variant="block" label="Record" value={`${yearStat.win}-${yearStat.loss}-${yearStat.tie}`} sub="W-L-T" />
                      <StatTile variant="block" label="Pts / match" value={fmtStat(yearStat.ptsAvg)} />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      </>
      )}
    </div>
  );
}

function EarningsTable({ snapshots, years, year, loading, isLive }) {
  if (!isLive) {
    return <div style={{ fontSize: 12, color: "#B4AE9E", textAlign: "center", padding: "24px 12px" }}>Connect to Supabase to see earnings.</div>;
  }
  if (loading) {
    return <div style={{ fontSize: 12, color: "#8A8371", textAlign: "center", padding: "24px 12px" }}>Loading…</div>;
  }

  const eventIdForYear = year === "all" ? null : years.find((y) => y.year === year)?.id;
  const filtered = year === "all" ? snapshots : snapshots.filter((s) => s.event_id === eventIdForYear);

  // All-time: sum across every cached year. Per-year: that year's row as-is.
  const byPlayer = {};
  filtered.forEach((s) => {
    if (!byPlayer[s.player_id]) byPlayer[s.player_id] = { winnings: 0, buyIns: 0 };
    byPlayer[s.player_id].winnings += Number(s.total_winnings);
    byPlayer[s.player_id].buyIns += Number(s.total_buy_ins);
  });
  const rows = Object.entries(byPlayer)
    .map(([playerId, r]) => ({
      playerId: Number(playerId),
      name: PLAYERS.find((p) => p.id === Number(playerId))?.name || `Player ${playerId}`,
      winnings: r.winnings,
      buyIns: r.buyIns,
      net: r.winnings - r.buyIns,
    }))
    .sort((a, b) => b.net - a.net);

  if (rows.length === 0) {
    return (
      <div style={{ fontSize: 12, color: "#B4AE9E", textAlign: "center", padding: "24px 12px", lineHeight: 1.5 }}>
        No cached earnings {year === "all" ? "yet" : `for ${year}`} — an admin needs to click Recalculate on Games
        Results or Competition Results first.
      </div>
    );
  }

  return (
    <>
      <div style={{ fontSize: 10.5, color: "#A39C89", marginBottom: 10, lineHeight: 1.5 }}>
        {year === "all" ? "All-time, across every year with cached results." : `${year} only.`} Combines Games and
        Competition payouts. Reflects whenever an admin last recalculated — not necessarily this instant.
      </div>
      <table className="bco-table">
        <thead>
          <tr>
            <th>Player</th>
            <th style={{ textAlign: "right" }}>Buy-ins</th>
            <th style={{ textAlign: "right" }}>Winnings</th>
            <th style={{ textAlign: "right" }}>Net</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.playerId}>
              <td style={{ fontSize: 13, fontWeight: 500, color: "#2C2A22" }}>{r.name}</td>
              <td className="bco-mono" style={{ textAlign: "right", fontSize: 13, color: "#8A8371" }}>
                ${r.buyIns.toFixed(2)}
              </td>
              <td className="bco-mono" style={{ textAlign: "right", fontSize: 13, color: "#8A8371" }}>
                ${r.winnings.toFixed(2)}
              </td>
              <td className="bco-mono" style={{ textAlign: "right", fontSize: 13, fontWeight: 600, color: r.net >= 0 ? "#1B4332" : "#A3492E" }}>
                {r.net >= 0 ? "+" : ""}${r.net.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default RecordBook;
