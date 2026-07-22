import { useState, useEffect, useMemo } from "react";
import {
  fetchSkins,
  fetchSkinsPayout,
  fetchPokerCards,
  fetchPokerPayout,
  savePokerWinner,
  fetchLowNetSolo,
  fetchLowNetTeam,
  fetchLowNetSoloPayout,
  fetchLowNetTeamPayout,
  fetchCtpResults,
  saveCtpResult,
  deleteCtpResult,
  fetchSoloRoundGrossTotals,
} from "../lib/stats.js";
import { fetchGameSettings, fetchTeams, fetchCtpPayout } from "../lib/api.js";
import {
  COURSES,
  ROUND_COURSE,
  PLAYERS,
  SKINS_SETTINGS,
  SKINS_TOTAL_POT,
  SKINS_PREVIEW,
  POKER_PREVIEW,
  LOW_NET_SOLO_PREVIEW,
  SCORE_ROUNDS,
  ROUND_ID_BY_LABEL,
  ROUND_FLAGS,
} from "../data/dummyData.js";
import { Banner } from "../components/Banner.jsx";
import { useYearRoundData } from "../hooks/useYearRoundData.js";
import { YearRoundPicker, RoundPicker } from "../components/YearRoundPicker.jsx";

// ---------------------------------------------------------------------------
// Games tab — daily cash games. Poker and Skins are computed automatically
// from score entry (strokes/putts) once that pipeline exists; CTP and Low
// Net settle-up are manual/derived views.
// ---------------------------------------------------------------------------
const GAME_MODES = [
  { key: "poker", label: "Poker" },
  { key: "skins", label: "Skins" },
  { key: "ctp", label: "CTP" },
  { key: "lownet", label: "Low Net" },
];

function GameNotApplicable({ round, game }) {
  return (
    <div style={{ padding: "24px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#6B6455" }}>No {game} for {round}</div>
      <div style={{ fontSize: 11.5, color: "#B4AE9E", marginTop: 4 }}>Set on Admin → Round setup, per round.</div>
    </div>
  );
}

export function GamesTab({ currentYear, isLive, currentEventId, myPlayer }) {
  const yr = useYearRoundData(isLive, currentYear);
  const [round, setRound] = useState(SCORE_ROUNDS[0]);
  const [mode, setMode] = useState("poker");

  // Keep the selected round valid whenever the selected year's rounds load
  // or the year changes.
  useEffect(() => {
    if (!isLive) return;
    if (yr.rounds.length === 0) return;
    if (!yr.rounds.some((r) => r.label === round)) setRound(yr.rounds[0].label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, yr.rounds]);

  const liveRound = isLive ? yr.rounds.find((r) => r.label === round) : null;
  const roundId = isLive ? liveRound?.id || null : ROUND_ID_BY_LABEL[round] || null;
  const flags = isLive
    ? liveRound || { appliesPoker: true, appliesSkins: true, appliesCtp: true, appliesLowNet: true }
    : ROUND_FLAGS[round] || {};
  // The round's actual course, for CTP's par-3 holes — not a fixed course
  // regardless of what's actually being played.
  const course = isLive ? (liveRound ? COURSES.find((c) => c.id === liveRound.courseId) : null) || COURSES[0] : ROUND_COURSE[round] || COURSES[0];

  return (
    <div>
      <div className="bco-sticky-header" style={{ padding: "18px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          <div className="bco-display" style={{ fontSize: 20, fontWeight: 600, color: "#1B4332" }}>
            Games
          </div>
          <span style={{ fontSize: 11, color: "#8A8371" }}>{yr.selectedYear}</span>
        </div>

        <YearRoundPicker years={yr.years} selectedYear={yr.selectedYear} setSelectedYear={yr.setSelectedYear} />

        <RoundPicker
          rounds={isLive && yr.rounds.length > 0 ? yr.rounds.map((r) => r.label) : SCORE_ROUNDS}
          selectedRound={round}
          setSelectedRound={setRound}
        />

        <div className="bco-seg" style={{ marginBottom: 16 }}>
          {GAME_MODES.map((g) => (
            <button key={g.key} className={`bco-seg-btn${mode === g.key ? " active" : ""}`} onClick={() => setMode(g.key)}>
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 20px 24px" }}>
        {mode === "poker" &&
          (flags.appliesPoker === false ? (
            <GameNotApplicable round={round} game="Poker" />
          ) : (
            <PokerPanel round={round} year={yr.selectedYear} isLive={isLive} roundId={roundId} myPlayer={myPlayer} />
          ))}
        {mode === "skins" &&
          (flags.appliesSkins === false ? (
            <GameNotApplicable round={round} game="Skins" />
          ) : (
            <SkinsPanel round={round} year={yr.selectedYear} isLive={isLive} roundId={roundId} />
          ))}
        {mode === "ctp" &&
          (flags.appliesCtp === false ? (
            <GameNotApplicable round={round} game="CTP" />
          ) : (
            <CtpPanel round={round} year={yr.selectedYear} isLive={isLive} roundId={roundId} currentEventId={yr.selectedEventId} course={course} myPlayer={myPlayer} />
          ))}
        {mode === "lownet" &&
          (flags.appliesLowNet === false ? (
            <GameNotApplicable round={round} game="Low Net" />
          ) : (
            <LowNetPanel round={round} year={yr.selectedYear} isLive={isLive} roundId={roundId} currentEventId={yr.selectedEventId} />
          ))}
      </div>
    </div>
  );
}

function AutoComputedNote({ children }) {
  return (
    <div
      style={{
        fontSize: 11.5,
        color: "#6B6455",
        background: "#F3EFE2",
        border: "1px solid #E4DFCE",
        borderRadius: 10,
        padding: "10px 12px",
        lineHeight: 1.5,
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
}

function PokerPanel({ round, year, isLive, roundId, myPlayer }) {
  // UX-level only, same as the Admin menu gating and Score entry's viewer
  // gating — the real enforcement is RLS (poker_results is admin-only
  // write); this just stops non-admins from hitting a confusing generic
  // "Couldn't save" error for a control they were never going to be
  // allowed to use.
  const isAdmin = myPlayer?.role === "admin";
  const [liveCards, setLiveCards] = useState(null); // null = use mock POKER_PREVIEW
  const [livePayout, setLivePayout] = useState(null); // null = no winner recorded yet
  const [liveLoading, setLiveLoading] = useState(isLive);
  const [liveError, setLiveError] = useState(null);
  const [winnerChoice, setWinnerChoice] = useState("");
  const [saveStatus, setSaveStatus] = useState(null); // null | "saving" | "error"
  const [editingWinner, setEditingWinner] = useState(false);

  const loadLive = async () => {
    if (!isLive || !roundId) {
      setLiveLoading(false);
      return;
    }
    try {
      const [cardsData, payoutData] = await Promise.all([fetchPokerCards(roundId), fetchPokerPayout(roundId)]);
      setLiveCards(cardsData);
      setLivePayout(payoutData);
    } catch (err) {
      console.error("Failed to load live poker data:", err);
      setLiveError(err.message || String(err));
    } finally {
      setLiveLoading(false);
    }
  };

  useEffect(() => {
    setLiveLoading(isLive);
    setLiveCards(null);
    setLivePayout(null);
    setWinnerChoice("");
    setSaveStatus(null);
    setEditingWinner(false);
    loadLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, roundId]);

  const isRealData = isLive && liveCards != null;
  const rows = isRealData
    ? liveCards.map((c) => ({
        name: PLAYERS.find((p) => p.id === c.player_id)?.name || `Player ${c.player_id}`,
        playerId: c.player_id,
        zeroPutts: c.zero_putts,
        onePutts: c.one_putts,
        cards: c.cards_earned,
        threePutts: c.three_putts,
      }))
    : POKER_PREVIEW.map((p) => ({ name: p.name, playerId: null, zeroPutts: p.zeroPutts, onePutts: p.onePutts, cards: p.zeroPutts * 2 + p.onePutts, threePutts: p.threePuttBuyins }));

  const winnerName = livePayout ? PLAYERS.find((p) => p.id === livePayout.winner_player_id)?.name : null;

  const handleSaveWinner = async () => {
    if (!winnerChoice || !roundId) return;
    setSaveStatus("saving");
    try {
      await savePokerWinner(roundId, Number(winnerChoice));
      await loadLive();
      setWinnerChoice("");
      setSaveStatus(null);
      setEditingWinner(false);
    } catch (err) {
      console.error("Failed to save poker winner:", err);
      setSaveStatus("error");
    }
  };

  return (
    <div>
      {isLive && liveError && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="error">Couldn't load live poker data ({liveError}) — showing local demo data instead.</Banner>
        </div>
      )}
      {isLive && liveLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 10 }}>Loading poker…</div>}

      {!liveLoading && (
        <>
          <AutoComputedNote>
            Putting Poker hands are built automatically from 0- and 1-putt holes logged in Score, with $1 buy-ins from
            3-putts.{" "}
            {isRealData ? `Real results for ${round} · ${year}. The hand itself is resolved with a real deck — record the winner below.` : `Preview below for ${round} · ${year} — not live yet.`}
          </AutoComputedNote>

          {rows.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "#B4AE9E", textAlign: "center", padding: "20px 12px" }}>
              No putts logged yet for {round}.
            </div>
          ) : (
            <table className="bco-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th style={{ textAlign: "center" }}>0-putts</th>
                  <th style={{ textAlign: "center" }}>1-putts</th>
                  <th style={{ textAlign: "center" }}>Cards</th>
                  <th style={{ textAlign: "right" }}>3-putt buy-ins</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.name}>
                    <td style={{ fontSize: 13, fontWeight: 500, color: "#2C2A22" }}>{p.name}</td>
                    <td className="bco-mono" style={{ textAlign: "center", fontSize: 13 }}>
                      {p.zeroPutts}
                    </td>
                    <td className="bco-mono" style={{ textAlign: "center", fontSize: 13 }}>
                      {p.onePutts}
                    </td>
                    <td className="bco-mono" style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "#1B4332" }}>
                      {p.cards}
                    </td>
                    <td className="bco-mono" style={{ textAlign: "right", fontSize: 13 }}>
                      {p.threePutts > 0 ? `$${p.threePutts}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ fontSize: 10.5, color: "#A39C89", marginTop: 10, lineHeight: 1.5 }}>
            Cards = (0-putts × 2) + (1-putts × 1). Best poker hand from those cards wins the pot.
          </div>

          {isRealData && (
            <div style={{ marginTop: 14, background: "#FFFFFF", border: "1px solid #E4DFCE", borderRadius: 10, padding: 14 }}>
              {winnerName && !editingWinner ? (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 10.5, color: "#8A8371" }}>Winner</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#1B4332" }}>{winnerName}</div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setWinnerChoice(String(livePayout.winner_player_id));
                          setEditingWinner(true);
                        }}
                        style={{ border: "1px solid #DCD6C4", background: "#FFFFFF", color: "#6B6455", borderRadius: 8, padding: "6px 12px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
                      >
                        Change winner
                      </button>
                    )}
                  </div>
                  <div className="bco-mono" style={{ fontSize: 13, color: "#6B6455", marginTop: 2 }}>
                    ${Number(livePayout.pot).toFixed(2)} pot
                  </div>
                  <div style={{ fontSize: 10.5, color: "#8A8371", marginTop: 3 }}>
                    ${Number(livePayout.buy_in_pot).toFixed(2)} buy-ins ({livePayout.participants} players) + $
                    {Number(livePayout.three_putt_pot).toFixed(2)} three-putt penalties ({livePayout.total_three_putts})
                  </div>
                </div>
              ) : !isAdmin ? (
                <div style={{ fontSize: 12, color: "#8A8371", textAlign: "center", padding: "8px 0" }}>Winner not recorded yet — an admin will enter it after the round.</div>
              ) : (
                <>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#6B6455", marginBottom: 8 }}>
                    {winnerName ? "Change the winner" : "Record the winner"}
                  </div>
                  {saveStatus === "error" && (
                    <div style={{ marginBottom: 8 }}>
                      <Banner tone="error">Couldn't save — try again.</Banner>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <select
                      value={winnerChoice}
                      onChange={(e) => setWinnerChoice(e.target.value)}
                      style={{ flex: 1, border: "1px solid #DCD6C4", borderRadius: 8, padding: "9px 10px", fontSize: 13, fontFamily: "'Inter', sans-serif" }}
                    >
                      <option value="">Select player…</option>
                      {rows.map((p) => (
                        <option key={p.playerId} value={p.playerId}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleSaveWinner}
                      disabled={!winnerChoice || saveStatus === "saving"}
                      style={{
                        border: "none",
                        borderRadius: 8,
                        padding: "9px 16px",
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: "'Inter', sans-serif",
                        background: winnerChoice ? "#1B4332" : "#DCD6C4",
                        color: "#F3EFE2",
                        cursor: winnerChoice ? "pointer" : "default",
                      }}
                    >
                      {saveStatus === "saving" ? "Saving…" : "Save"}
                    </button>
                    {winnerName && (
                      <button
                        onClick={() => {
                          setEditingWinner(false);
                          setWinnerChoice("");
                          setSaveStatus(null);
                        }}
                        style={{ border: "1px solid #DCD6C4", background: "#FFFFFF", color: "#8A8371", borderRadius: 8, padding: "9px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SkinsPanel({ round, year, isLive, roundId }) {
  const [liveSkins, setLiveSkins] = useState(null); // null = use mock SKINS_PREVIEW
  const [livePayout, setLivePayout] = useState(null);
  const [liveLoading, setLiveLoading] = useState(isLive);
  const [liveError, setLiveError] = useState(null);

  useEffect(() => {
    if (!isLive || !roundId) {
      setLiveLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [skinsData, payoutData] = await Promise.all([fetchSkins(roundId), fetchSkinsPayout(roundId)]);
        if (cancelled) return;
        setLiveSkins(skinsData);
        setLivePayout(payoutData);
      } catch (err) {
        console.error("Failed to load live skins:", err);
        setLiveError(err.message || String(err));
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, roundId]);

  const isRealData = isLive && liveSkins != null;
  const skinsList = isRealData
    ? liveSkins.map((s) => ({ hole: s.hole_number, winner: PLAYERS.find((p) => p.id === s.winner_player_id)?.name || `Player ${s.winner_player_id}` }))
    : SKINS_PREVIEW;
  const skinsWon = skinsList.length;
  const totalPot = isRealData ? livePayout?.total_pot ?? 0 : SKINS_TOTAL_POT;
  const skinValue = isRealData ? livePayout?.value_per_skin ?? 0 : skinsWon ? SKINS_TOTAL_POT / skinsWon : 0;
  const buyIn = isRealData ? livePayout?.skins_buy_in ?? SKINS_SETTINGS.buyInPerPlayer : SKINS_SETTINGS.buyInPerPlayer;
  const participants = isRealData ? livePayout?.participants ?? 0 : SKINS_SETTINGS.players;

  const byPlayer = useMemo(() => {
    const map = {};
    skinsList.forEach((s) => {
      if (!map[s.winner]) map[s.winner] = [];
      map[s.winner].push(s.hole);
    });
    return Object.entries(map)
      .map(([name, holes]) => {
        const sortedHoles = [...holes].sort((a, b) => a - b);
        return { name, holes: sortedHoles, count: sortedHoles.length, total: sortedHoles.length * skinValue };
      })
      .sort((a, b) => b.count - a.count);
  }, [skinsList, skinValue]);

  return (
    <div>
      {isLive && liveError && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="error">Couldn't load live skins ({liveError}) — showing local demo data instead.</Banner>
        </div>
      )}
      {isLive && liveLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 10 }}>Loading skins…</div>}

      {!liveLoading && (
        <>
          <AutoComputedNote>
            Skins are awarded from the lowest net score on each hole (ties carry, one-tie-all-tie).{" "}
            {isRealData ? `Real results for ${round} · ${year}.` : `Preview below for ${round} · ${year} — not live yet.`}
          </AutoComputedNote>

          {byPlayer.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "#B4AE9E", textAlign: "center", padding: "20px 12px" }}>
              No skins won yet for {round}.
            </div>
          ) : (
            <table className="bco-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Holes</th>
                  <th style={{ textAlign: "center" }}>Skins</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {byPlayer.map((p) => (
                  <tr key={p.name}>
                    <td style={{ fontSize: 13, fontWeight: 500, color: "#2C2A22" }}>{p.name}</td>
                    <td className="bco-mono" style={{ fontSize: 12, color: "#8A8371" }}>
                      {p.holes.join(", ")}
                    </td>
                    <td className="bco-mono" style={{ textAlign: "center", fontSize: 13 }}>
                      {p.count}
                    </td>
                    <td className="bco-mono" style={{ textAlign: "right", fontSize: 13, fontWeight: 600, color: "#1B4332" }}>
                      ${p.total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div
            style={{
              marginTop: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#FFFFFF",
              border: "1px solid #E4DFCE",
              borderRadius: 10,
              padding: "12px 14px",
            }}
          >
            <div>
              <div style={{ fontSize: 10.5, color: "#8A8371" }}>
                {skinsWon} skin{skinsWon !== 1 ? "s" : ""} won · ${totalPot} pot
              </div>
              <div style={{ fontSize: 9.5, color: "#B4AE9E", marginTop: 2 }}>
                ${buyIn}/player × {participants} — set on Admin
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10.5, color: "#8A8371" }}>Per skin</div>
              <div className="bco-mono" style={{ fontSize: 18, fontWeight: 600, color: "#1B4332" }}>
                ${skinValue.toFixed(2)}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CtpPanel({ round, year, isLive, roundId, currentEventId, course, myPlayer }) {
  // UX-level only, same as elsewhere — ctp_results is admin-only write at
  // the RLS level; this just avoids a non-admin hitting a confusing
  // generic error for a control they were never going to be allowed to use.
  const isAdmin = myPlayer?.role === "admin";
  const [winners, setWinners] = useState({}); // live: { holeNumber: playerId } scoped to roundId. offline: { "year-round-hole": playerId }
  const [draft, setDraft] = useState({}); // { hole: playerId } — pending edits before Save all
  const [saved, setSaved] = useState(false);
  const [liveLoading, setLiveLoading] = useState(isLive);
  const [liveError, setLiveError] = useState(null);
  const [saveError, setSaveError] = useState(false);
  const [payout, setPayout] = useState(null); // { ctp_buy_in, participants, par3_holes, total_pot, value_per_hole }

  // This round's actual par-3 holes — not assumed to be a fixed course or
  // a fixed count of 4.
  const ctpHoles = (course || COURSES[0]).holes.filter((h) => h.par === 3);

  useEffect(() => {
    setDraft({});
    setSaved(false);
    setSaveError(false);
    if (!isLive || !roundId) {
      setLiveLoading(false);
      return;
    }
    let cancelled = false;
    setLiveLoading(true);
    (async () => {
      try {
        const [results, payoutData] = await Promise.all([fetchCtpResults(roundId), fetchCtpPayout(roundId)]);
        if (cancelled) return;
        const map = {};
        results.forEach((r) => {
          map[r.hole_number] = r.player_id;
        });
        setWinners(map);
        setPayout(payoutData);
      } catch (err) {
        console.error("Failed to load CTP results:", err);
        setLiveError(err.message || String(err));
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, roundId, currentEventId]);

  const winnerFor = (holeNumber) => {
    if (holeNumber in draft) return draft[holeNumber];
    if (isLive && roundId) return winners[holeNumber] ?? "";
    const key = `${year}-${round}-${holeNumber}`;
    return winners[key] ?? "";
  };

  const setDraftFor = (holeNumber, playerId) => {
    setDraft((prev) => ({ ...prev, [holeNumber]: playerId ? Number(playerId) : "" }));
    setSaved(false);
  };

  const handleSaveAll = async () => {
    if (isLive && roundId) {
      setSaveError(false);
      try {
        await Promise.all(
          Object.entries(draft).map(([holeNumber, playerId]) =>
            playerId ? saveCtpResult(roundId, Number(holeNumber), playerId) : deleteCtpResult(roundId, Number(holeNumber))
          )
        );
        setWinners((prev) => {
          const next = { ...prev };
          Object.entries(draft).forEach(([holeNumber, playerId]) => {
            if (playerId) next[holeNumber] = playerId;
            else delete next[holeNumber];
          });
          return next;
        });
        setDraft({});
        setSaved(true);
      } catch (err) {
        console.error("Failed to save CTP winners:", err);
        setSaveError(true);
      }
      return;
    }

    setWinners((prev) => {
      const next = { ...prev };
      Object.entries(draft).forEach(([holeNumber, playerId]) => {
        const key = `${year}-${round}-${holeNumber}`;
        if (playerId) next[key] = playerId;
        else delete next[key];
      });
      return next;
    });
    setDraft({});
    setSaved(true);
  };

  const hasPendingChanges = Object.keys(draft).length > 0;

  return (
    <div>
      {isLive && liveError && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="error">Couldn't load live CTP results ({liveError}) — showing local demo data instead.</Banner>
        </div>
      )}
      {isLive && liveLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 10 }}>Loading CTP…</div>}

      {!liveLoading && (
        <>
          <div style={{ fontSize: 11.5, color: "#8A8371", marginBottom: 10 }}>
            Par 3s on {(course || COURSES[0]).name}. Set every winner, then save once.
            {payout != null && payout.value_per_hole != null && ` $${Number(payout.value_per_hole).toFixed(2)}/hole.`}
          </div>

          {payout != null && (
            <div style={{ fontSize: 10.5, color: "#8A8371", marginBottom: 10, lineHeight: 1.5 }}>
              ${Number(payout.ctp_buy_in).toFixed(2)}/player × {payout.participants} players = $
              {Number(payout.total_pot).toFixed(2)} pot, split across {payout.par3_holes} par-3 hole
              {payout.par3_holes === 1 ? "" : "s"}.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ctpHoles.map((h) => (
              <div
                key={h.number}
                style={{
                  display: "grid",
                  gridTemplateColumns: "56px 1fr",
                  gap: 10,
                  alignItems: "center",
                  background: "#FFFFFF",
                  border: "1px solid #E4DFCE",
                  borderRadius: 10,
                  padding: "10px 12px",
                }}
              >
                <div>
                  <div className="bco-mono" style={{ fontSize: 15, fontWeight: 600, color: "#1B4332" }}>
                    {h.number}
                  </div>
                  <div style={{ fontSize: 9.5, color: "#8A8371" }}>{h.yardage}y</div>
                </div>
                <select
                  value={winnerFor(h.number)}
                  onChange={(e) => setDraftFor(h.number, e.target.value)}
                  disabled={!isAdmin}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    border: "1px solid #DCD6C4",
                    borderRadius: 8,
                    padding: "8px 10px",
                    fontSize: 13,
                    fontFamily: "'Inter', sans-serif",
                    background: isAdmin ? "#FFFFFF" : "#F3EFE2",
                    color: isAdmin ? "#2C2A22" : "#8A8371",
                  }}
                >
                  <option value="">No winner</option>
                  {PLAYERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {saveError && (
            <div style={{ marginTop: 12 }}>
              <Banner tone="error">Couldn't save — try again.</Banner>
            </div>
          )}
          {saved && (
            <div style={{ marginTop: 12 }}>
              <Banner tone="success">CTP winners saved for {round} · {year}.</Banner>
            </div>
          )}

          {isAdmin ? (
            <button
              onClick={handleSaveAll}
              disabled={!hasPendingChanges}
              style={{
                width: "100%",
                marginTop: 12,
                border: "none",
                borderRadius: 10,
                padding: "12px",
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "'Inter', sans-serif",
                background: hasPendingChanges ? "#1B4332" : "#DCD6C4",
                color: "#F3EFE2",
                cursor: hasPendingChanges ? "pointer" : "default",
              }}
            >
              Save all
            </button>
          ) : (
            <div style={{ fontSize: 11.5, color: "#B4AE9E", textAlign: "center", marginTop: 12, padding: "8px 0" }}>
              Only an admin can record or change CTP winners.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LowNetPanel({ round, year, isLive, roundId, currentEventId }) {
  const [mode, setMode] = useState("solo");
  const [liveSolo, setLiveSolo] = useState(null); // null = use mock LOW_NET_SOLO_PREVIEW
  const [liveTeam, setLiveTeam] = useState(null); // null = use mock/placeholder
  const [gameSettings, setGameSettings] = useState(null);
  const [liveLoading, setLiveLoading] = useState(isLive);
  const [liveError, setLiveError] = useState(null);

  useEffect(() => {
    if (!isLive || !roundId || !currentEventId) {
      setLiveLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [lowNetSolo, grossTotals, lowNetTeam, dbTeams, gs, soloPayout, teamPayout] = await Promise.all([
          fetchLowNetSolo(roundId),
          fetchSoloRoundGrossTotals(currentEventId),
          fetchLowNetTeam(roundId),
          fetchTeams(currentEventId),
          fetchGameSettings(currentEventId),
          fetchLowNetSoloPayout(roundId),
          fetchLowNetTeamPayout(roundId),
        ]);
        if (cancelled) return;

        const soloPayoutMap = Object.fromEntries(soloPayout.map((p) => [p.player_id, Number(p.amount)]));
        const soloRows = lowNetSolo
          .map((s) => ({
            id: s.player_id,
            name: PLAYERS.find((p) => p.id === s.player_id)?.name || `Player ${s.player_id}`,
            net: s.net_total,
            gross: grossTotals.find((g) => g.round_id === roundId && g.player_id === s.player_id)?.gross_total ?? null,
            payout: soloPayoutMap[s.player_id] ?? 0,
          }))
          .sort((a, b) => a.net - b.net);
        setLiveSolo(soloRows);

        const teamPayoutMap = Object.fromEntries(teamPayout.map((p) => [p.player_id, Number(p.amount)]));
        const teamRows = lowNetTeam
          .map((t) => {
            const teamMeta = dbTeams.find((dt) => dt.id === t.team_id);
            const memberIds = [teamMeta?.player_a_id, teamMeta?.player_b_id].filter((id) => id != null);
            const shares = memberIds.map((id) => teamPayoutMap[id] ?? 0);
            const teamPayoutTotal = shares.reduce((sum, s) => sum + s, 0);
            // Split is always even by construction (v_low_net_team_payout
            // divides by winning_teams x 2), so any member's share works —
            // shown explicitly rather than re-deriving it via total/2 in
            // the render, so the display can never drift from the real
            // per-player amount if that ever changed.
            const payoutPerPlayer = shares.length > 0 ? shares[0] : 0;
            return { id: t.team_id, name: teamMeta?.name || `Team ${t.team_id}`, net: t.net_total, payout: teamPayoutTotal, payoutPerPlayer };
          })
          .sort((a, b) => a.net - b.net);
        setLiveTeam(teamRows);
        setGameSettings(gs);
      } catch (err) {
        console.error("Failed to load live low net:", err);
        setLiveError(err.message || String(err));
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, roundId, currentEventId]);

  const isRealData = isLive && (liveSolo != null || liveTeam != null);
  const soloRows = liveSolo || [...LOW_NET_SOLO_PREVIEW].sort((a, b) => a.net - b.net);
  const teamRows = liveTeam;

  const soloBuyIn = gameSettings ? Number(gameSettings.low_net_solo_buy_in) : null;
  const teamBuyIn = gameSettings ? Number(gameSettings.low_net_team_buy_in) : null;
  const soloPot = soloBuyIn != null ? soloBuyIn * soloRows.length : null;
  const teamPot = teamBuyIn != null && teamRows ? teamBuyIn * 2 * teamRows.length : null;

  return (
    <div>
      {isLive && liveError && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="error">Couldn't load live Low Net data ({liveError}) — showing local demo data instead.</Banner>
        </div>
      )}
      {isLive && liveLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 10 }}>Loading Low Net…</div>}

      {!liveLoading && (
        <>
          <AutoComputedNote>
            Low Net is best ball with full handicap applied — solo individual, team 2-man net best ball.{" "}
            {isRealData ? `Real results for ${round} · ${year}.` : `Preview below for ${round} · ${year} — not live yet.`}
          </AutoComputedNote>

          <div className="bco-seg" style={{ marginBottom: 14 }}>
            <button className={`bco-seg-btn${mode === "solo" ? " active" : ""}`} onClick={() => setMode("solo")}>
              Solo
            </button>
            <button className={`bco-seg-btn${mode === "team" ? " active" : ""}`} onClick={() => setMode("team")}>
              Team
            </button>
          </div>

          {mode === "solo" ? (
            soloRows.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "#B4AE9E", textAlign: "center", padding: "24px 12px" }}>
                No completed solo rounds yet for {round}.
              </div>
            ) : (
              <table className="bco-table" key="solo-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th style={{ textAlign: "center" }}>Gross</th>
                    <th style={{ textAlign: "center" }}>Net</th>
                    <th style={{ textAlign: "right" }}>Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {soloRows.map((p, i) => (
                    <tr key={p.id ?? p.name}>
                      <td style={{ fontSize: 13, fontWeight: 500, color: i === 0 ? "#1B4332" : "#2C2A22" }}>
                        {p.name}
                        {i === 0 && <span style={{ fontSize: 10, color: "#6FAE8C", marginLeft: 6 }}>● low</span>}
                      </td>
                      <td className="bco-mono" style={{ textAlign: "center", fontSize: 13, color: "#8A8371" }}>
                        {p.gross ?? "–"}
                      </td>
                      <td className="bco-mono" style={{ textAlign: "center", fontSize: 14, fontWeight: 600, color: "#1B4332" }}>
                        {p.net}
                      </td>
                      <td className="bco-mono" style={{ textAlign: "right", fontSize: 13, fontWeight: p.payout > 0 ? 600 : 400, color: p.payout > 0 ? "#1B4332" : "#B4AE9E" }}>
                        {p.payout > 0 ? `$${p.payout.toFixed(2)}` : "–"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : teamRows == null ? (
            <div style={{ fontSize: 12.5, color: "#B4AE9E", textAlign: "center", padding: "24px 12px" }}>
              No completed team rounds yet for {round}.
            </div>
          ) : teamRows.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "#B4AE9E", textAlign: "center", padding: "24px 12px" }}>
              No completed team rounds yet for {round}.
            </div>
          ) : (
            <table className="bco-table" key="team-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th style={{ textAlign: "center" }}>Net</th>
                  <th style={{ textAlign: "right" }}>Payout</th>
                </tr>
              </thead>
              <tbody>
                {teamRows.map((t, i) => (
                  <tr key={t.id ?? t.name}>
                    <td style={{ fontSize: 13, fontWeight: 500, color: i === 0 ? "#1B4332" : "#2C2A22" }}>
                      {t.name}
                      {i === 0 && <span style={{ fontSize: 10, color: "#6FAE8C", marginLeft: 6 }}>● low</span>}
                    </td>
                    <td className="bco-mono" style={{ textAlign: "center", fontSize: 14, fontWeight: 600, color: "#1B4332" }}>
                      {t.net}
                    </td>
                    <td className="bco-mono" style={{ textAlign: "right", fontSize: 13, fontWeight: t.payout > 0 ? 600 : 400, color: t.payout > 0 ? "#1B4332" : "#B4AE9E" }}>
                      {t.payout > 0 ? `$${t.payoutPerPlayer.toFixed(2)} each ($${t.payout.toFixed(2)} total)` : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {gameSettings && (
            <div
              style={{
                marginTop: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#FFFFFF",
                border: "1px solid #E4DFCE",
                borderRadius: 10,
                padding: "12px 14px",
              }}
            >
              <div style={{ fontSize: 10.5, color: "#8A8371" }}>
                {mode === "solo" ? `$${soloBuyIn}/player × ${soloRows.length}` : `$${teamBuyIn}/player × 2 × ${teamRows?.length ?? 0} teams`}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10.5, color: "#8A8371" }}>Pot</div>
                <div className="bco-mono" style={{ fontSize: 18, fontWeight: 600, color: "#1B4332" }}>
                  ${(mode === "solo" ? soloPot : teamPot)?.toFixed(2) ?? "0.00"}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default GamesTab;
