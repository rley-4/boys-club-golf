import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import {
  fetchEvents,
  fetchPlayerHandicaps,
  fetchPlayerCompetedYears,
  fetchAllPlayerCompetedYears,
  setPlayerCompetedYear,
  updatePlayer,
  updatePlayerHandicap,
  fetchAllPayoutSnapshots,
  createPlayer,
} from "../lib/api.js";
import { PLAYERS, WIREFRAME_YEARS } from "../data/dummyData.js";
import { ScreenHeader } from "../components/ScreenHeader.jsx";
import { StatTile } from "../components/StatTile.jsx";
import { FormField } from "../components/FormField.jsx";
import { FormInput } from "../components/FormInput.jsx";
import { Banner } from "../components/Banner.jsx";
import { Button } from "../components/Button.jsx";

// ---------------------------------------------------------------------------
// Players — roster with bios and handicap index. This screen edits a local
// copy of PLAYERS for now; once the players table is real, handicapIndex set
// here becomes the single source of truth Score/Matches read from.
// ---------------------------------------------------------------------------
export function PlayersScreen({ onBack, isLive, currentEventId, currentYear }) {
  const [players, setPlayers] = useState(PLAYERS);
  const [expanded, setExpanded] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", handicapIndex: "", hometown: "", bio: "" });
  const [addStatus, setAddStatus] = useState(null); // null | "saving" | "error"
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editStatus, setEditStatus] = useState(null); // null | "saving" | "error"
  const [editError, setEditError] = useState(null);

  // Handicap-by-year — years come from real events (like Year settings);
  // each player's history is lazy-loaded the first time their card opens.
  const [years, setYears] = useState([]);
  const [handicapsByPlayer, setHandicapsByPlayer] = useState({}); // playerId -> { eventId: finalIndex }
  const [handicapLoading, setHandicapLoading] = useState({}); // playerId -> bool
  const [handicapSaving, setHandicapSaving] = useState({}); // "playerId-eventId" -> "saving" | "error"
  const [competedYearsByPlayer, setCompetedYearsByPlayer] = useState({}); // playerId -> [eventId, ...]
  const [competedSaving, setCompetedSaving] = useState({}); // "playerId-eventId" -> "saving" | "error"
  const [filterYears, setFilterYears] = useState([]); // selected event ids — multi-select, empty = show all
  const [allPayoutSnapshots, setAllPayoutSnapshots] = useState([]);

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
        setCompetedYearsByPlayer((prev) => ({ ...map, ...prev }));
      } catch (err) {
        console.error("Failed to load players' competed years:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive]);

  // Cached payout snapshot — same source as Record Book's Earnings tab, not
  // a live computation. Fetched once, filtered per-player when their card
  // expands.
  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchAllPayoutSnapshots();
        if (cancelled) return;
        setAllPayoutSnapshots(rows);
      } catch (err) {
        console.error("Failed to load payout snapshots:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive]);

  const toggleFilterYear = (eventId) => {
    setFilterYears((prev) => (prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]));
  };

  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    (async () => {
      try {
        const events = await fetchEvents();
        if (cancelled) return;
        setYears(events.map((e) => ({ id: e.id, year: e.year })).sort((a, b) => b.year - a.year));
      } catch (err) {
        console.error("Failed to load events:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive]);

  const loadPlayerHandicaps = async (playerId) => {
    if (!isLive || handicapsByPlayer[playerId]) return;
    setHandicapLoading((prev) => ({ ...prev, [playerId]: true }));
    try {
      const [rows, competedYears] = await Promise.all([fetchPlayerHandicaps(playerId), fetchPlayerCompetedYears(playerId)]);
      const map = {};
      rows.forEach((r) => {
        map[r.event_id] = r.final_index;
      });
      setHandicapsByPlayer((prev) => ({ ...prev, [playerId]: map }));
      setCompetedYearsByPlayer((prev) => ({ ...prev, [playerId]: competedYears }));
    } catch (err) {
      console.error("Failed to load handicap history:", err);
    } finally {
      setHandicapLoading((prev) => ({ ...prev, [playerId]: false }));
    }
  };

  const toggleYearCompetedLive = async (player, yearRow) => {
    const current = competedYearsByPlayer[player.id] || [];
    const next = current.includes(yearRow.id) ? current.filter((id) => id !== yearRow.id) : [...current, yearRow.id];
    setCompetedYearsByPlayer((prev) => ({ ...prev, [player.id]: next }));
    const key = `${player.id}-${yearRow.id}`;
    setCompetedSaving((prev) => ({ ...prev, [key]: "saving" }));
    try {
      await setPlayerCompetedYear(player.id, yearRow.id, !current.includes(yearRow.id));
      setCompetedSaving((prev) => ({ ...prev, [key]: null }));
    } catch (err) {
      console.error("Failed to save competed year:", err);
      setCompetedSaving((prev) => ({ ...prev, [key]: "error" }));
      // Revert the optimistic update since the save failed.
      setCompetedYearsByPlayer((prev) => ({ ...prev, [player.id]: current }));
    }
  };

  const saveHandicapForYear = async (player, yearRow, value) => {
    const finalIndex = value === "" ? null : Number(value);
    if (finalIndex != null && !Number.isFinite(finalIndex)) return;
    const key = `${player.id}-${yearRow.id}`;
    setHandicapsByPlayer((prev) => ({ ...prev, [player.id]: { ...prev[player.id], [yearRow.id]: finalIndex } }));
    if (!isLive || finalIndex == null) return;
    setHandicapSaving((prev) => ({ ...prev, [key]: "saving" }));
    try {
      await updatePlayerHandicap(player.id, yearRow.id, finalIndex);
      setHandicapSaving((prev) => ({ ...prev, [key]: null }));
      // Keep the flat handicapIndex (used everywhere else in the app — Score
      // entry, leaderboards, etc.) in sync when editing the currently active
      // year specifically. Editing other years' history doesn't touch it.
      if (yearRow.year === currentYear) {
        player.handicapIndex = finalIndex;
        setPlayers((prev) => [...prev]);
      }
    } catch (err) {
      console.error("Failed to save handicap:", err);
      setHandicapSaving((prev) => ({ ...prev, [key]: "error" }));
    }
  };

  const sorted = [...players]
    .filter((p) => filterYears.length === 0 || filterYears.some((fy) => (competedYearsByPlayer[p.id] || []).includes(fy)))
    .sort((a, b) => a.name.localeCompare(b.name));

  const updateForm = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const startEdit = (player) => {
    setEditingId(player.id);
    setEditForm({
      name: player.name,
      hometown: player.hometown || "",
      bio: player.bio || "",
    });
    setEditStatus(null);
    setEditError(null);
  };
  const updateEditForm = (field, value) => setEditForm((prev) => ({ ...prev, [field]: value }));

  const saveEdit = async (player) => {
    if (!editForm.name.trim()) return;
    const updates = {
      name: editForm.name.trim(),
      hometown: editForm.hometown.trim(),
      bio: editForm.bio.trim(),
    };

    if (isLive && currentEventId) {
      setEditStatus("saving");
      setEditError(null);
      try {
        await updatePlayer(player.id, updates);
      } catch (err) {
        console.error("Failed to update player:", err);
        setEditStatus("error");
        setEditError(err?.message || err?.error_description || err?.hint || String(err));
        return;
      }
    }

    // Mutate the shared player object in place — same pattern as the
    // competing toggle — so Score entry and everywhere else picks this up.
    Object.assign(player, updates);
    setPlayers((prev) => [...prev]);
    setEditingId(null);
    setEditForm(null);
    setEditStatus(null);
  };

  const handleAdd = async () => {
    if (!form.name.trim() || !form.handicapIndex) return;

    const base = {
      name: form.name.trim(),
      handicapIndex: Number(form.handicapIndex),
      hometown: form.hometown.trim(),
      bio: form.bio.trim(),
      competing: true,
      yearsCompeted: [], // wireframe only for now — toggle after adding
    };

    if (isLive && currentEventId) {
      setAddStatus("saving");
      try {
        const id = await createPlayer({ ...base, eventId: currentEventId });
        const newPlayer = { id, ...base };
        PLAYERS.push(newPlayer); // so Score entry's dropdown sees it immediately
        setPlayers((prev) => [...prev, newPlayer]);
        setAddStatus(null);
      } catch (err) {
        console.error("Failed to add player:", err);
        setAddStatus("error");
        return; // leave the form open so nothing's lost
      }
    } else {
      const nextId = Math.max(0, ...players.map((p) => p.id)) + 1;
      const newPlayer = { id: nextId, ...base };
      PLAYERS.push(newPlayer);
      setPlayers((prev) => [...prev, newPlayer]);
    }

    setForm({ name: "", handicapIndex: "", hometown: "", bio: "" });
    setShowForm(false);
  };

  // Offline fallback (no Supabase connection) — local-only, keyed by plain
  // year number rather than a real event id.
  const toggleYearCompetedOffline = (targetPlayer, year) => {
    const current = targetPlayer.yearsCompeted || [];
    targetPlayer.yearsCompeted = current.includes(year) ? current.filter((y) => y !== year) : [...current, year].sort((a, b) => a - b);
    setPlayers((prev) => [...prev]);
  };

  return (
    <div style={{ padding: "14px 20px 24px" }}>
      <ScreenHeader
        title="Players"
        onBack={onBack}
        backLabel="Back to More"
        right={
          <button
            onClick={() => setShowForm((v) => !v)}
            style={{
              border: "1px solid #1B4332",
              color: "#1B4332",
              background: showForm ? "#1B4332" : "#FFFFFF",
              borderRadius: 8,
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {showForm ? "Cancel" : "+ Add player"}
          </button>
        }
      />

      {!showForm && isLive && years.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: "#8A8371", letterSpacing: "0.03em", marginBottom: 6 }}>FILTER BY YEARS COMPETED</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {years.map((yearRow) => {
              const active = filterYears.includes(yearRow.id);
              return (
                <button
                  key={yearRow.id}
                  onClick={() => toggleFilterYear(yearRow.id)}
                  className="bco-mono"
                  style={{
                    border: `1px solid ${active ? "#1B4332" : "#E4DFCE"}`,
                    background: active ? "#1B4332" : "#FFFFFF",
                    color: active ? "#F3EFE2" : "#6B6455",
                    borderRadius: 999,
                    padding: "5px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {yearRow.year}
                </button>
              );
            })}
            {filterYears.length > 0 && (
              <button
                onClick={() => setFilterYears([])}
                style={{ border: "none", background: "none", color: "#8A8371", fontSize: 11.5, cursor: "pointer", fontFamily: "'Inter', sans-serif", padding: "5px 6px" }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <div style={{ background: "#FFFFFF", border: "1px solid #E4DFCE", borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <FormField label="Name">
            <FormInput value={form.name} onChange={(v) => updateForm("name", v)} placeholder="Full name" />
          </FormField>
          <FormField label={`Handicap index (${currentYear})`}>
            <FormInput value={form.handicapIndex} onChange={(v) => updateForm("handicapIndex", v)} placeholder="e.g. 9.6" type="number" />
          </FormField>
          <FormField label="Hometown">
            <FormInput value={form.hometown} onChange={(v) => updateForm("hometown", v)} placeholder="City, State" />
          </FormField>
          <FormField label="Bio">
            <textarea
              value={form.bio}
              onChange={(e) => updateForm("bio", e.target.value)}
              placeholder="One line about their game"
              rows={2}
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: "1px solid #DCD6C4",
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 13,
                fontFamily: "'Inter', sans-serif",
                resize: "none",
              }}
            />
          </FormField>
          {addStatus === "error" && (
            <div style={{ marginBottom: 8 }}>
              <Banner tone="error">Couldn't save to Supabase — check the console. Nothing was lost, try again.</Banner>
            </div>
          )}
          <Button
            style={{ marginTop: 4 }}
            onClick={handleAdd}
            disabled={!form.name.trim() || !form.handicapIndex || addStatus === "saving"}
          >
            {addStatus === "saving" ? "Saving…" : "Add player"}
          </Button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sorted.map((p) => {
          const isOpen = expanded === p.id;
          const initials = p.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
          return (
            <div key={p.id} style={{ background: "#FFFFFF", border: "1px solid #E4DFCE", borderRadius: 12, overflow: "hidden" }}>
              <button
                onClick={() => {
                  setExpanded((prev) => (prev === p.id ? null : p.id));
                  loadPlayerHandicaps(p.id);
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "11px 14px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 999,
                    background: p.competing === false ? "#B9B3A2" : "#1B4332",
                    color: "#F3EFE2",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {initials}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#2C2A22" }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "#8A8371", marginTop: 1 }}>
                    {p.hometown}
                    {p.competing === false && (
                      <span style={{ color: "#A3492E", fontWeight: 600 }}>{p.hometown ? " · " : ""}Not competing</span>
                    )}
                  </div>
                </div>
                <span
                  className="bco-mono"
                  style={{ fontSize: 12, fontWeight: 600, color: "#1B4332", background: "#DCEFE3", borderRadius: 999, padding: "3px 9px" }}
                >
                  HI {p.handicapIndex.toFixed(1)}
                </span>
                <ChevronRight size={15} color="#B9B3A2" style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s ease" }} />
              </button>

              {isOpen && (
                <div style={{ padding: "0 14px 14px", borderTop: "1px solid #EFEBDE" }}>
                  {editingId === p.id ? (
                    <div style={{ marginTop: 10 }}>
                      <FormField label="Name">
                        <FormInput value={editForm.name} onChange={(v) => updateEditForm("name", v)} />
                      </FormField>
                      <FormField label="Hometown">
                        <FormInput value={editForm.hometown} onChange={(v) => updateEditForm("hometown", v)} />
                      </FormField>
                      <FormField label="Bio">
                        <textarea
                          value={editForm.bio}
                          onChange={(e) => updateEditForm("bio", e.target.value)}
                          rows={2}
                          style={{
                            width: "100%",
                            boxSizing: "border-box",
                            border: "1px solid #DCD6C4",
                            borderRadius: 8,
                            padding: "8px 10px",
                            fontSize: 13,
                            fontFamily: "'Inter', sans-serif",
                            resize: "none",
                          }}
                        />
                      </FormField>
                      {editStatus === "error" && (
                        <div style={{ marginBottom: 8 }}>
                          <Banner tone="error">Couldn't save: {editError || "unknown error — check the console"}</Banner>
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setEditForm(null);
                          }}
                          style={{ border: "1px solid #DCD6C4", background: "#FFFFFF", color: "#6B6455", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontFamily: "'Inter', sans-serif", cursor: "pointer" }}
                        >
                          Cancel
                        </button>
                        <Button
                          style={{ flex: 1 }}
                          onClick={() => saveEdit(p)}
                          disabled={!editForm.name.trim() || editStatus === "saving"}
                        >
                          {editStatus === "saving" ? "Saving…" : "Save"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {p.bio && <div style={{ fontSize: 12.5, color: "#3F3B32", marginTop: 10, lineHeight: 1.5 }}>{p.bio}</div>}

                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 12, color: "#6B6455", marginBottom: 6 }}>Handicap by year</div>
                        {!isLive ? (
                          <div style={{ fontSize: 10.5, color: "#B4AE9E" }}>Connect to Supabase to see and edit handicap history per year.</div>
                        ) : handicapLoading[p.id] ? (
                          <div style={{ fontSize: 11, color: "#8A8371" }}>Loading…</div>
                        ) : years.length === 0 ? (
                          <div style={{ fontSize: 10.5, color: "#B4AE9E" }}>No years on record yet — add one on Admin → Year settings.</div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {years.map((yearRow) => {
                              const value = handicapsByPlayer[p.id]?.[yearRow.id];
                              const saveKey = `${p.id}-${yearRow.id}`;
                              const saving = handicapSaving[saveKey];
                              return (
                                <div
                                  key={yearRow.id}
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "56px 1fr auto",
                                    gap: 8,
                                    alignItems: "center",
                                    background: yearRow.year === currentYear ? "#F3EFE2" : "transparent",
                                    borderRadius: 8,
                                    padding: "4px 6px",
                                  }}
                                >
                                  <span className="bco-mono" style={{ fontSize: 12.5, fontWeight: 600, color: "#2C2A22" }}>
                                    {yearRow.year}
                                  </span>
                                  <input
                                    type="number"
                                    value={value ?? ""}
                                    placeholder="—"
                                    onChange={(e) => saveHandicapForYear(p, yearRow, e.target.value)}
                                    style={{
                                      width: "100%",
                                      boxSizing: "border-box",
                                      border: "1px solid #DCD6C4",
                                      borderRadius: 6,
                                      padding: "5px 8px",
                                      fontSize: 12.5,
                                      fontFamily: "'IBM Plex Mono', monospace",
                                    }}
                                  />
                                  <span style={{ fontSize: 9.5, color: saving === "error" ? "#A3492E" : "#B4AE9E", whiteSpace: "nowrap", minWidth: 40 }}>
                                    {saving === "saving" ? "Saving…" : saving === "error" ? "Failed" : ""}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 12, color: "#6B6455", marginBottom: 6 }}>Years competed</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {(isLive ? years : WIREFRAME_YEARS.map((y) => ({ id: y, year: y }))).map((yearRow) => {
                            const active = isLive
                              ? (competedYearsByPlayer[p.id] || []).includes(yearRow.id)
                              : (p.yearsCompeted || []).includes(yearRow.year);
                            const saving = isLive ? competedSaving[`${p.id}-${yearRow.id}`] : null;
                            return (
                              <button
                                key={yearRow.id}
                                onClick={() => (isLive ? toggleYearCompetedLive(p, yearRow) : toggleYearCompetedOffline(p, yearRow.year))}
                                className="bco-mono"
                                style={{
                                  border: `${yearRow.year === currentYear ? 2 : 1}px solid ${saving === "error" ? "#A3492E" : active ? "#1B4332" : "#E4DFCE"}`,
                                  background: active ? "#DCEFE3" : "#FFFFFF",
                                  color: active ? "#1B4332" : "#8A8371",
                                  borderRadius: 999,
                                  padding: yearRow.year === currentYear ? "4px 11px" : "5px 12px",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  opacity: saving === "saving" ? 0.6 : 1,
                                }}
                              >
                                {yearRow.year}
                              </button>
                            );
                          })}
                        </div>
                        {!isLive && <div style={{ fontSize: 9.5, color: "#B4AE9E", marginTop: 4 }}>Connect to Supabase to save this.</div>}
                      </div>

                      {isLive && (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontSize: 12, color: "#6B6455", marginBottom: 6 }}>Earnings (all-time)</div>
                          {(() => {
                            const rows = allPayoutSnapshots.filter((s) => s.player_id === p.id);
                            if (rows.length === 0) {
                              return <div style={{ fontSize: 10.5, color: "#B4AE9E" }}>No cached earnings yet — an admin needs to recalculate at least one year.</div>;
                            }
                            const winnings = rows.reduce((sum, r) => sum + Number(r.total_winnings), 0);
                            const buyIns = rows.reduce((sum, r) => sum + Number(r.total_buy_ins), 0);
                            const net = winnings - buyIns;
                            return (
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                                <StatTile variant="block" label="Buy-ins" value={`$${buyIns.toFixed(2)}`} />
                                <StatTile variant="block" label="Winnings" value={`$${winnings.toFixed(2)}`} />
                                <StatTile variant="block" label="Net" value={`${net >= 0 ? "+" : ""}$${net.toFixed(2)}`} />
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
                        <span style={{ fontSize: 12, color: "#6B6455" }}>Competing this year</span>
                        <span
                          style={{
                            border: `1px solid ${p.competing === false ? "#E4DFCE" : "#1B4332"}`,
                            background: p.competing === false ? "#FFFFFF" : "#DCEFE3",
                            color: p.competing === false ? "#8A8371" : "#1B4332",
                            borderRadius: 999,
                            padding: "4px 12px",
                            fontSize: 11.5,
                            fontWeight: 600,
                          }}
                        >
                          {p.competing === false ? "No" : "Yes"}
                        </span>
                      </div>
                      <div style={{ fontSize: 9.5, color: "#B4AE9E", marginTop: 4 }}>Set by toggling the current year under "Years competed" above.</div>

                      <button
                        onClick={() => startEdit(p)}
                        style={{
                          width: "100%",
                          marginTop: 10,
                          border: "1px solid #DCD6C4",
                          background: "#FFFFFF",
                          color: "#1B4332",
                          borderRadius: 8,
                          padding: "8px 0",
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "'Inter', sans-serif",
                        }}
                      >
                        Edit
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PlayersScreen;
