import { useState, useEffect } from "react";
import {
  fetchEvents,
  createEvent,
  updateEvent,
  setCurrentEvent,
  fetchPayoutSnapshotTimestamp,
  recalculatePayoutSnapshot,
} from "../../lib/api.js";
import { recalculateYearStats, fetchYearStatsTimestamp } from "../../lib/stats.js";
import { RECORD_YEARS } from "../../data/dummyData.js";
import { ScreenHeader } from "../../components/ScreenHeader.jsx";
import { SettingsSection } from "../../components/SettingsSection.jsx";
import { FormField } from "../../components/FormField.jsx";
import { FormInput } from "../../components/FormInput.jsx";
import { Banner } from "../../components/Banner.jsx";
import { Button } from "../../components/Button.jsx";
import { RecalcRow } from "../../components/RecalculateControl.jsx";

// Solo/Team Leaderboard scoring drops the worst of these rounds — used only
// to seed a sensible default roundsPlayed before real event data loads.
const LEADERBOARD_ROUNDS = ["R1", "R2", "R3", "R4"];

function YearSettings({ onBack, currentYear, setCurrentYear, isLive }) {
  const [years, setYears] = useState(() => RECORD_YEARS.map((y) => ({ id: null, year: y, roundsPlayed: LEADERBOARD_ROUNDS.length, isCurrent: y === currentYear })));
  const [liveLoading, setLiveLoading] = useState(isLive);
  const [liveError, setLiveError] = useState(null);
  const [showAddYear, setShowAddYear] = useState(false);
  const [newYearInput, setNewYearInput] = useState(String(Math.max(...RECORD_YEARS) + 1));
  const [addYearError, setAddYearError] = useState(false);
  // "year-results" | "year-earnings" -> "running" | "error", tracked per row
  // so recalculating one year's data doesn't disable another year's button.
  const [recalcStatus, setRecalcStatus] = useState({});

  const load = async () => {
    if (!isLive) {
      setLiveLoading(false);
      return;
    }
    try {
      const events = await fetchEvents();
      const withTimestamps = await Promise.all(
        events.map(async (e) => {
          const [resultsTs, earningsTs] = await Promise.all([fetchYearStatsTimestamp(e.id), fetchPayoutSnapshotTimestamp(e.id)]);
          return { id: e.id, year: e.year, roundsPlayed: e.rounds_played, isCurrent: e.is_current, resultsTimestamp: resultsTs, earningsTimestamp: earningsTs };
        })
      );
      setYears(withTimestamps);
    } catch (err) {
      console.error("Failed to load events:", err);
      setLiveError(err.message || String(err));
    } finally {
      setLiveLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive]);

  const updateRoundsPlayed = (row, value) => {
    const roundsPlayed = Math.max(0, Number(value) || 0);
    setYears((prev) => prev.map((y) => (y.year === row.year ? { ...y, roundsPlayed } : y)));
    if (isLive && row.id) {
      updateEvent(row.id, { roundsPlayed }).catch((err) => console.error("Failed to update rounds played:", err));
    }
  };

  const handleSetCurrent = async (row) => {
    setYears((prev) => prev.map((y) => ({ ...y, isCurrent: y.year === row.year })));
    setCurrentYear(row.year);
    if (isLive && row.id) {
      try {
        await setCurrentEvent(row.id);
      } catch (err) {
        console.error("Failed to set current year:", err);
      }
    }
  };

  const handleRecalculateResults = async (row) => {
    if (!row.id) return;
    const key = `${row.year}-results`;
    setRecalcStatus((prev) => ({ ...prev, [key]: "running" }));
    try {
      await recalculateYearStats(row.id);
      const ts = await fetchYearStatsTimestamp(row.id);
      setYears((prev) => prev.map((y) => (y.year === row.year ? { ...y, resultsTimestamp: ts } : y)));
      setRecalcStatus((prev) => ({ ...prev, [key]: null }));
    } catch (err) {
      console.error("Failed to recalculate results:", err);
      setRecalcStatus((prev) => ({ ...prev, [key]: "error" }));
    }
  };

  const handleRecalculateEarnings = async (row) => {
    if (!row.id) return;
    const key = `${row.year}-earnings`;
    setRecalcStatus((prev) => ({ ...prev, [key]: "running" }));
    try {
      await recalculatePayoutSnapshot(row.id);
      const ts = await fetchPayoutSnapshotTimestamp(row.id);
      setYears((prev) => prev.map((y) => (y.year === row.year ? { ...y, earningsTimestamp: ts } : y)));
      setRecalcStatus((prev) => ({ ...prev, [key]: null }));
    } catch (err) {
      console.error("Failed to recalculate earnings:", err);
      setRecalcStatus((prev) => ({ ...prev, [key]: "error" }));
    }
  };

  const handleAddYear = async () => {
    const y = Number(newYearInput);
    if (!y || years.some((row) => row.year === y)) return;
    setAddYearError(false);
    if (isLive) {
      try {
        await createEvent(y);
        await load();
      } catch (err) {
        console.error("Failed to create year:", err);
        setAddYearError(true);
        return;
      }
    } else {
      setYears((prev) => [...prev, { id: null, year: y, roundsPlayed: 0, isCurrent: false }].sort((a, b) => b.year - a.year));
    }
    setNewYearInput(String(y + 1));
    setShowAddYear(false);
  };

  const sortedYears = [...years].sort((a, b) => b.year - a.year);

  return (
    <div style={{ padding: "14px 20px 24px" }}>
      <ScreenHeader title="Year settings" onBack={onBack} backLabel="Back to Admin" />

      {isLive && liveError && (
        <div style={{ marginBottom: 14 }}>
          <Banner tone="error">Couldn't load live years ({liveError}) — showing local data instead.</Banner>
        </div>
      )}
      {isLive && liveLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 14 }}>Loading years…</div>}

      {!liveLoading && (
        <SettingsSection title="Years" description="Every year on record, and how many rounds were played. The current year is what Score and Matches save under.">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sortedYears.map((row) => (
              <div
                key={row.year}
                style={{
                  display: "grid",
                  gridTemplateColumns: "56px 1fr auto",
                  gap: 10,
                  alignItems: "center",
                  background: "#FFFFFF",
                  border: `1px solid ${row.isCurrent ? "#1B4332" : "#E4DFCE"}`,
                  borderRadius: 10,
                  padding: "10px 12px",
                }}
              >
                <span className="bco-mono" style={{ fontSize: 14, fontWeight: 600, color: "#2C2A22" }}>
                  {row.year}
                </span>
                <FormField label="Rounds played">
                  <FormInput type="number" value={row.roundsPlayed} onChange={(v) => updateRoundsPlayed(row, v)} />
                </FormField>
                {row.isCurrent ? (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: "#1B4332",
                      background: "#DCEFE3",
                      borderRadius: 999,
                      padding: "4px 10px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Current
                  </span>
                ) : (
                  <button
                    onClick={() => handleSetCurrent(row)}
                    style={{
                      border: "1px solid #DCD6C4",
                      background: "#FFFFFF",
                      color: "#6B6455",
                      borderRadius: 999,
                      padding: "4px 10px",
                      fontSize: 10.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "'Inter', sans-serif",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Set current
                  </button>
                )}
                {isLive && row.id && (
                  <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6, marginTop: 4, paddingTop: 10, borderTop: "1px solid #F0ECDF" }}>
                    <RecalcRow
                      label="Results (Solo, Team)"
                      timestamp={row.resultsTimestamp}
                      status={recalcStatus[`${row.year}-results`]}
                      onClick={() => handleRecalculateResults(row)}
                    />
                    <RecalcRow
                      label="Earnings"
                      timestamp={row.earningsTimestamp}
                      status={recalcStatus[`${row.year}-earnings`]}
                      onClick={() => handleRecalculateEarnings(row)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 10 }}>
            {showAddYear ? (
              <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <FormField label="New year">
                    <FormInput type="number" value={newYearInput} onChange={setNewYearInput} />
                  </FormField>
                </div>
                <Button style={{ padding: "8px 14px", width: "auto" }} onClick={handleAddYear}>
                  Add
                </Button>
                <button
                  onClick={() => setShowAddYear(false)}
                  style={{ border: "1px solid #DCD6C4", background: "#FFFFFF", color: "#6B6455", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontFamily: "'Inter', sans-serif", cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddYear(true)}
                style={{ border: "1px solid #1B4332", color: "#1B4332", background: "#FFFFFF", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
              >
                + Add year
              </button>
            )}
            {addYearError && (
              <div style={{ marginTop: 8 }}>
                <Banner tone="error">Couldn't create that year — try again.</Banner>
              </div>
            )}
            {!isLive && <div style={{ fontSize: 10, color: "#B4AE9E", marginTop: 8 }}>Not connected to Supabase — local to this session.</div>}
          </div>
        </SettingsSection>
      )}
    </div>
  );
}

export default YearSettings;
export { YearSettings };
