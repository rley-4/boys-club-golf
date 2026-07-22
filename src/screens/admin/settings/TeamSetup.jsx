import { useState, useEffect, useRef } from "react";
import { fetchEvents, fetchEventByYear, fetchTeams, createTeam, updateTeam, deleteTeam, fetchCarrollCupRoster, upsertCarrollCupAssignment, fetchAllPlayerCompetedYears } from "../../../lib/api.js";
import { PLAYERS, TEAMS, CARROLL_CUP_ROSTER_DEFAULT } from "../../../data/dummyData.js";
import { ScreenHeader } from "../../../components/ScreenHeader.jsx";
import { SettingsSection } from "../../../components/SettingsSection.jsx";
import { FormField } from "../../../components/FormField.jsx";
import { FormInput } from "../../../components/FormInput.jsx";
import { FormSelect } from "../../../components/FormSelect.jsx";
import { Banner } from "../../../components/Banner.jsx";
import { RemoveButton, AddRowButton } from "../../../components/RowButtons.jsx";

function TeamSetupSettings({ onBack, isLive, currentYear }) {
  const idRef = useRef(1000);
  const nextId = () => ++idRef.current;

  // Team setup manages its own year, separate from the global Current
  // Year — you might be setting up next year's teams before this year's
  // event has even happened. Each year is its own real event_id, so last
  // year's teams are never affected by changing this year's pairs. New
  // years are added on Admin → Year settings, not here.
  const [years, setYears] = useState([currentYear]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedEventId, setSelectedEventId] = useState(null);

  const [teams, setTeams] = useState(TEAMS.map((t, i) => ({ id: i + 1, name: t.name, playerA: t.players[0], playerB: t.players[1] })));
  const [carrollRoster, setCarrollRoster] = useState(CARROLL_CUP_ROSTER_DEFAULT);
  const [liveLoading, setLiveLoading] = useState(isLive);
  const [liveError, setLiveError] = useState(null);

  // Which players are actually competing in whichever year this screen is
  // configuring (not necessarily the global Current Year) — so the
  // Player A/B pickers only offer active players for that specific year.
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

  const playerNameToId = (name) => PLAYERS.find((p) => p.name === name)?.id;

  // Load the real list of years on record, so the dropdown reflects actual
  // events rather than just the current one.
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

  // Resolve the real event_id for whichever year is selected, then load
  // that year's teams and Carroll Cup roster.
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
          setTeams([]);
          setCarrollRoster({});
          return;
        }
        setSelectedEventId(event.id);
        const [dbTeams, dbRoster] = await Promise.all([fetchTeams(event.id), fetchCarrollCupRoster(event.id)]);
        if (cancelled) return;
        setTeams(
          dbTeams.map((t) => ({
            id: t.id,
            name: t.name,
            playerA: PLAYERS.find((p) => p.id === t.player_a_id)?.name || "",
            playerB: PLAYERS.find((p) => p.id === t.player_b_id)?.name || "",
          }))
        );
        const rosterMap = {};
        dbRoster.forEach((r) => {
          const name = PLAYERS.find((p) => p.id === r.player_id)?.name;
          if (name) rosterMap[name] = r.side;
        });
        setCarrollRoster(rosterMap);
      } catch (err) {
        console.error("Failed to load teams:", err);
        setLiveError(err.message || String(err));
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, selectedYear]);

  const updateTeamField = (id, field, value) => {
    setTeams((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, [field]: value } : t));
      if (isLive && selectedEventId) {
        const t = next.find((x) => x.id === id);
        updateTeam(id, { name: t.name, playerAId: playerNameToId(t.playerA), playerBId: playerNameToId(t.playerB) }).catch((err) =>
          console.error("Failed to update team:", err)
        );
      }
      return next;
    });
  };
  const [addingTeam, setAddingTeam] = useState(false);
  const addTeam = async () => {
    if (addingTeam) return; // guards against a fast double-click firing two creates
    setAddingTeam(true);
    const name = `Team ${teams.length + 1}`;
    const playerA = PLAYERS[0]?.name || "";
    const playerB = PLAYERS[1]?.name || "";
    try {
      if (isLive && selectedEventId) {
        const id = await createTeam({ eventId: selectedEventId, name, playerAId: playerNameToId(playerA), playerBId: playerNameToId(playerB) });
        setTeams((prev) => [...prev, { id, name, playerA, playerB }]);
      } else {
        setTeams((prev) => [...prev, { id: nextId(), name, playerA, playerB }]);
      }
    } catch (err) {
      console.error("Failed to add team:", err);
    } finally {
      setAddingTeam(false);
    }
  };
  const removeTeam = (id) => {
    setTeams((prev) => prev.filter((t) => t.id !== id));
    if (isLive && selectedEventId) deleteTeam(id).catch((err) => console.error("Failed to remove team:", err));
  };

  const toggleCarroll = (playerName, side) => {
    setCarrollRoster((prev) => ({ ...prev, [playerName]: side }));
    if (isLive && selectedEventId) {
      const playerId = PLAYERS.find((p) => p.name === playerName)?.id;
      if (playerId) {
        upsertCarrollCupAssignment(selectedEventId, playerId, side).catch((err) => console.error("Failed to save Carroll Cup assignment:", err));
      }
    }
  };

  // Active for the year being configured — falls back to showing everyone
  // when offline or the data hasn't loaded yet, so the picker never goes
  // empty. A currently-assigned player stays visible even if they're not
  // active, so an existing pairing never silently disappears.
  const activePlayerNames = new Set(
    isLive && selectedEventId
      ? PLAYERS.filter((p) => (competedByPlayer[p.id] || []).includes(selectedEventId)).map((p) => p.name)
      : PLAYERS.map((p) => p.name)
  );
  const playerOptionsFor = (currentValue) => {
    const names = new Set(activePlayerNames);
    if (currentValue) names.add(currentValue);
    return PLAYERS.filter((p) => names.has(p.name)).map((p) => ({ value: p.name, label: p.name }));
  };
  const yearOptions = years.map((y) => ({ value: y, label: String(y) }));

  return (
    <div style={{ padding: "14px 20px 24px" }}>
      <ScreenHeader title="Team setup" onBack={onBack} backLabel="Back to Admin" />

      <SettingsSection title="Year" description="Teams and Carroll Cup roster are saved per year — editing one year never touches another's history. Add new years on Admin → Year settings.">
        <FormField label="Year">
          <FormSelect value={selectedYear} onChange={(v) => setSelectedYear(Number(v))} options={yearOptions} />
        </FormField>
      </SettingsSection>

      {isLive && liveError && (
        <div style={{ marginBottom: 14 }}>
          <Banner tone="error">Couldn't load live teams ({liveError}) — showing local data instead.</Banner>
        </div>
      )}
      {isLive && liveLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 14 }}>Loading teams…</div>}
      {isLive && !liveLoading && !liveError && !selectedEventId && (
        <div style={{ fontSize: 12.5, color: "#B4AE9E", padding: "12px 0", marginBottom: 10 }}>
          No event found for {selectedYear} yet — add it above to start setting up teams.
        </div>
      )}

      {(!isLive || selectedEventId) && (
        <>
          <SettingsSection title="Team pairs" description="Who's paired together for Team leaderboard and match play.">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {teams.map((t) => (
                <div key={t.id} style={{ background: "#FFFFFF", border: "1px solid #E4DFCE", borderRadius: 10, padding: 12, position: "relative" }}>
                  <RemoveButton onClick={() => removeTeam(t.id)} />
                  <FormField label="Team name">
                    <FormInput value={t.name} onChange={(v) => updateTeamField(t.id, "name", v)} />
                  </FormField>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <FormField label="Player A">
                      <FormSelect value={t.playerA} onChange={(v) => updateTeamField(t.id, "playerA", v)} options={playerOptionsFor(t.playerA)} />
                    </FormField>
                    <FormField label="Player B">
                      <FormSelect value={t.playerB} onChange={(v) => updateTeamField(t.id, "playerB", v)} options={playerOptionsFor(t.playerB)} />
                    </FormField>
                  </div>
                </div>
              ))}
              <AddRowButton label={addingTeam ? "Adding…" : "+ Add team"} onClick={addTeam} disabled={addingTeam} />
            </div>
          </SettingsSection>

          <SettingsSection title="Carroll Cup teams" description="Assign every player to Red or Blue.">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {PLAYERS.filter((p) => activePlayerNames.has(p.name) || carrollRoster[p.name]).map((p) => {
                const side = carrollRoster[p.name];
                return (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "#FFFFFF",
                      border: "1px solid #E4DFCE",
                      borderRadius: 10,
                      padding: "8px 10px",
                    }}
                  >
                    <span style={{ fontSize: 13, color: "#2C2A22" }}>{p.name}</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={() => toggleCarroll(p.name, "red")}
                        style={{
                          border: `1px solid ${side === "red" ? "#8C2F2A" : "#E4DFCE"}`,
                          background: side === "red" ? "#F7DCDA" : "#FFFFFF",
                          color: side === "red" ? "#8C2F2A" : "#8A8371",
                          borderRadius: 7,
                          padding: "4px 10px",
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "'Inter', sans-serif",
                        }}
                      >
                        Red
                      </button>
                      <button
                        onClick={() => toggleCarroll(p.name, "blue")}
                        style={{
                          border: `1px solid ${side === "blue" ? "#26456B" : "#E4DFCE"}`,
                          background: side === "blue" ? "#DCE7F2" : "#FFFFFF",
                          color: side === "blue" ? "#26456B" : "#8A8371",
                          borderRadius: 7,
                          padding: "4px 10px",
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "'Inter', sans-serif",
                        }}
                      >
                        Blue
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </SettingsSection>
        </>
      )}
    </div>
  );
}

export default TeamSetupSettings;
export { TeamSetupSettings };
