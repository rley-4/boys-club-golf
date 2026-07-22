import { useState, useEffect, useRef } from "react";
import {
  fetchEvents,
  fetchEventByYear,
  fetchRounds,
  updateRound,
  fetchTeams,
  fetchRoundMatchups,
  createRoundMatchup,
  updateRoundMatchup,
  deleteRoundMatchup,
  fetchAllPlayerCompetedYears,
} from "../../../lib/api.js";
import { PLAYERS, TEAMS, SCORE_ROUNDS } from "../../../data/dummyData.js";
import { ScreenHeader } from "../../../components/ScreenHeader.jsx";
import { SettingsSection } from "../../../components/SettingsSection.jsx";
import { FormField } from "../../../components/FormField.jsx";
import { FormSelect } from "../../../components/FormSelect.jsx";
import { Banner } from "../../../components/Banner.jsx";
import { RemoveButton, AddRowButton } from "../../../components/RowButtons.jsx";

function MatchupSetupSettings({ onBack, isLive, currentYear }) {
  const idRef = useRef(1000);
  const nextId = () => ++idRef.current;

  const [years, setYears] = useState([currentYear]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedEventId, setSelectedEventId] = useState(null);

  const [rounds, setRounds] = useState(() => SCORE_ROUNDS.map((r) => ({ id: nextId(), label: r, matchType: "team" })));
  const [teams, setTeams] = useState(TEAMS.map((t, i) => ({ id: i + 1, name: t.name })));
  const [matchups, setMatchups] = useState([]);
  const [liveLoading, setLiveLoading] = useState(isLive);
  const [liveError, setLiveError] = useState(null);

  // Which players are active for the selected year — same idea as Team
  // setup's Player A/B pickers, so singles matchups only offer players
  // actually competing that year.
  const [competedByPlayer, setCompetedByPlayer] = useState({});

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

  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    (async () => {
      try {
        const events = await fetchEvents();
        if (cancelled || events.length === 0) return;
        setYears(events.map((e) => e.year).sort((a, b) => b - a));
      } catch (err) {
        console.error("Failed to load events:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive]);

  useEffect(() => {
    if (!isLive) {
      setLiveLoading(false);
      return;
    }
    let cancelled = false;
    setLiveLoading(true);
    setLiveError(null);
    (async () => {
      try {
        const event = await fetchEventByYear(selectedYear);
        if (cancelled) return;
        if (!event) {
          setSelectedEventId(null);
          setRounds([]);
          setTeams([]);
          setMatchups([]);
          return;
        }
        setSelectedEventId(event.id);
        const [dbRounds, dbTeams, dbMatchups] = await Promise.all([fetchRounds(event.id), fetchTeams(event.id), fetchRoundMatchups(event.id)]);
        if (cancelled) return;
        setRounds(dbRounds.map((r) => ({ id: r.id, label: r.label, matchType: r.match_type || "team" })));
        setTeams(dbTeams.map((t) => ({ id: t.id, name: t.name })));
        setMatchups(
          dbMatchups.map((m) => ({
            id: m.id,
            roundId: m.roundId,
            matchType: m.matchType || "team",
            teamAId: m.teamAId,
            teamBId: m.teamBId,
            playerAId: m.playerAId,
            playerBId: m.playerBId,
          }))
        );
      } catch (err) {
        console.error("Failed to load matchups:", err);
        setLiveError(err.message || String(err));
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, selectedYear]);

  const addMatchup = async (round) => {
    const matchType = round.matchType || "team";
    const base =
      matchType === "singles"
        ? { matchType, playerAId: playersActive[0]?.id ?? null, playerBId: playersActive[1]?.id ?? null, teamAId: null, teamBId: null }
        : { matchType, teamAId: teams[0]?.id ?? null, teamBId: teams[1]?.id ?? null, playerAId: null, playerBId: null };
    if (matchType === "team" && teams.length < 2) return;
    if (matchType === "singles" && playersActive.length < 2) return;
    if (isLive) {
      try {
        const id = await createRoundMatchup({ roundId: round.id, ...base });
        setMatchups((prev) => [...prev, { id, roundId: round.id, ...base }]);
      } catch (err) {
        console.error("Failed to add matchup:", err);
      }
    } else {
      setMatchups((prev) => [...prev, { id: nextId(), roundId: round.id, ...base }]);
    }
  };
  const removeMatchup = (id) => {
    setMatchups((prev) => prev.filter((m) => m.id !== id));
    if (isLive) deleteRoundMatchup(id).catch((err) => console.error("Failed to remove matchup:", err));
  };
  const updateMatchupField = (id, field, value) => {
    setMatchups((prev) => {
      const next = prev.map((m) => (m.id === id ? { ...m, [field]: value } : m));
      if (isLive) {
        const m = next.find((x) => x.id === id);
        updateRoundMatchup(id, { matchType: m.matchType, teamAId: m.teamAId, teamBId: m.teamBId, playerAId: m.playerAId, playerBId: m.playerBId }).catch(
          (err) => console.error("Failed to update matchup:", err)
        );
      }
      return next;
    });
  };

  // Team/Single is set once per round and cascades to every matchup in it —
  // switching resets each matchup's picks to sensible defaults for the new
  // type, both locally and persisted.
  const updateRoundMatchType = (roundId, matchType) => {
    setRounds((prev) => prev.map((r) => (r.id === roundId ? { ...r, matchType } : r)));
    if (isLive) updateRound(roundId, { matchType }).catch((err) => console.error("Failed to update round match type:", err));

    setMatchups((prev) => {
      const next = prev.map((m) => {
        if (m.roundId !== roundId) return m;
        return matchType === "singles"
          ? { ...m, matchType, teamAId: null, teamBId: null, playerAId: playersActive[0]?.id ?? null, playerBId: playersActive[1]?.id ?? null }
          : { ...m, matchType, playerAId: null, playerBId: null, teamAId: teams[0]?.id ?? null, teamBId: teams[1]?.id ?? null };
      });
      if (isLive) {
        next
          .filter((m) => m.roundId === roundId)
          .forEach((m) => {
            updateRoundMatchup(m.id, { matchType: m.matchType, teamAId: m.teamAId, teamBId: m.teamBId, playerAId: m.playerAId, playerBId: m.playerBId }).catch(
              (err) => console.error("Failed to cascade match type to matchup:", err)
            );
          });
      }
      return next;
    });
  };

  const teamOptions = teams.map((t) => ({ value: t.id, label: t.name }));
  const playersActive =
    isLive && selectedEventId ? PLAYERS.filter((p) => (competedByPlayer[p.id] || []).includes(selectedEventId)) : PLAYERS;
  const playerOptionsFor = (currentValue) => {
    const ids = new Set(playersActive.map((p) => p.id));
    if (currentValue) ids.add(currentValue);
    return PLAYERS.filter((p) => ids.has(p.id)).map((p) => ({ value: p.id, label: p.name }));
  };
  const yearOptions = years.map((y) => ({ value: y, label: String(y) }));

  return (
    <div style={{ padding: "14px 20px 24px" }}>
      <ScreenHeader title="Matchup setup" onBack={onBack} backLabel="Back to Admin" />

      <SettingsSection title="Year" description="Which year's matchups you're configuring. Add new years on Admin → Year settings.">
        <FormField label="Year">
          <FormSelect value={selectedYear} onChange={(v) => setSelectedYear(Number(v))} options={yearOptions} />
        </FormField>
      </SettingsSection>

      {isLive && liveError && (
        <div style={{ marginBottom: 14 }}>
          <Banner tone="error">Couldn't load live matchups ({liveError}) — showing local data instead.</Banner>
        </div>
      )}
      {isLive && liveLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 14 }}>Loading matchups…</div>}
      {isLive && !liveLoading && !liveError && !selectedEventId && (
        <div style={{ fontSize: 12.5, color: "#B4AE9E", padding: "12px 0", marginBottom: 10 }}>
          No event found for {selectedYear} yet — add it on Admin → Year settings first.
        </div>
      )}

      {!liveLoading && (!isLive || selectedEventId) && rounds.length === 0 && (
        <div style={{ fontSize: 12.5, color: "#B4AE9E", textAlign: "center", padding: "24px 12px" }}>
          No rounds set up yet for {selectedYear} — add rounds on Admin → Round setup first.
        </div>
      )}

      {!liveLoading && rounds.length > 0 && (
        <SettingsSection title="Matchups by round" description="Team or Single is set once per round and applies to every matchup in it — Single is for when the same two-player pairs aren't playing together. Which competitions a round counts toward is set on Round setup.">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {rounds.map((r) => {
              const roundMatchups = matchups.filter((m) => m.roundId === r.id);
              const isSingles = r.matchType === "singles";
              return (
                <div key={r.id} style={{ background: "#FFFFFF", border: "1px solid #E4DFCE", borderRadius: 10, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1B4332" }}>{r.label}</div>
                    <div className="bco-seg" style={{ maxWidth: 160 }}>
                      <button className={`bco-seg-btn${!isSingles ? " active" : ""}`} onClick={() => updateRoundMatchType(r.id, "team")}>
                        Team
                      </button>
                      <button className={`bco-seg-btn${isSingles ? " active" : ""}`} onClick={() => updateRoundMatchType(r.id, "singles")}>
                        Single
                      </button>
                    </div>
                  </div>

                  {roundMatchups.map((m) => (
                    <div key={m.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid #F0ECDF" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 4 }}>
                        <div style={{ fontSize: 9.5, fontWeight: 600, color: "#8A8371", letterSpacing: "0.03em" }}>HOME {isSingles ? "PLAYER" : "TEAM"}</div>
                        <div style={{ fontSize: 9.5, fontWeight: 600, color: "#8A8371", letterSpacing: "0.03em" }}>AWAY {isSingles ? "PLAYER" : "TEAM"}</div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 6, alignItems: "center" }}>
                        {isSingles ? (
                          <>
                            <FormSelect value={m.playerAId} onChange={(v) => updateMatchupField(m.id, "playerAId", Number(v))} options={playerOptionsFor(m.playerAId)} />
                            <FormSelect value={m.playerBId} onChange={(v) => updateMatchupField(m.id, "playerBId", Number(v))} options={playerOptionsFor(m.playerBId)} />
                          </>
                        ) : (
                          <>
                            <FormSelect value={m.teamAId} onChange={(v) => updateMatchupField(m.id, "teamAId", Number(v))} options={teamOptions} />
                            <FormSelect value={m.teamBId} onChange={(v) => updateMatchupField(m.id, "teamBId", Number(v))} options={teamOptions} />
                          </>
                        )}
                        <button
                          onClick={() => removeMatchup(m.id)}
                          style={{ border: "none", background: "none", color: "#B4AE9E", cursor: "pointer", fontSize: 14, padding: 2 }}
                          aria-label="Remove matchup"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => addMatchup(r)}
                    disabled={isSingles ? playersActive.length < 2 : teams.length < 2}
                    style={{ border: "none", background: "none", color: "#1B4332", fontSize: 11.5, fontWeight: 600, cursor: "pointer", padding: "4px 0", fontFamily: "'Inter', sans-serif" }}
                  >
                    + Add matchup
                  </button>
                </div>
              );
            })}
          </div>
          {teams.length < 2 && <div style={{ fontSize: 10.5, color: "#B4AE9E", marginTop: 8 }}>Set up at least two teams on Team setup for Team matchups, or players for Single matchups.</div>}
        </SettingsSection>
      )}
    </div>
  );
}

export default MatchupSetupSettings;
export { MatchupSetupSettings };
