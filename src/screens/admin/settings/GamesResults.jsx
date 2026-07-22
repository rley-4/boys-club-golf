import { useState, useEffect } from "react";
import { fetchEvents, fetchEventByYear, fetchPayoutSnapshot, fetchPayoutSnapshotTimestamp } from "../../../lib/api.js";
import { PLAYERS } from "../../../data/dummyData.js";
import { ScreenHeader } from "../../../components/ScreenHeader.jsx";
import { SettingsSection } from "../../../components/SettingsSection.jsx";
import { FormField } from "../../../components/FormField.jsx";
import { FormSelect } from "../../../components/FormSelect.jsx";
import { Banner } from "../../../components/Banner.jsx";
import { AutoComputedNote } from "../../../components/AutoComputedNote.jsx";
import { LastCalculatedNote } from "../../../components/RecalculateControl.jsx";

function GamesResultsSettings({ onBack, isLive, currentYear }) {
  const [years, setYears] = useState([currentYear]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [lastCalculatedAt, setLastCalculatedAt] = useState(null);
  const [liveLoading, setLiveLoading] = useState(isLive);
  const [liveError, setLiveError] = useState(null);

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

  const loadSnapshot = async (eventId) => {
    const [snapshotRows, ts] = await Promise.all([fetchPayoutSnapshot(eventId), fetchPayoutSnapshotTimestamp(eventId)]);
    setPayouts(snapshotRows);
    setLastCalculatedAt(ts);
  };

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
          setPayouts([]);
          setLastCalculatedAt(null);
          return;
        }
        setSelectedEventId(event.id);
        await loadSnapshot(event.id);
      } catch (err) {
        console.error("Failed to load game payouts:", err);
        setLiveError(err.message || String(err));
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, selectedYear]);

  return (
    <div style={{ padding: "14px 20px 24px" }}>
      <ScreenHeader title="Games results" onBack={onBack} backLabel="Back to Admin" />

      <SettingsSection title="Year">
        <FormField label="Year">
          <FormSelect value={selectedYear} onChange={(v) => setSelectedYear(Number(v))} options={years.map((y) => ({ value: y, label: String(y) }))} />
        </FormField>
      </SettingsSection>

      <AutoComputedNote>
        Cached, not live — these numbers are whatever the last "Recalculate" produced, not recomputed on every
        visit. Buy-ins assume anyone who logged a score for a round bought into every game flagged applicable for it
        that round. Buy-in amounts are set on Games Setup. This same cache also feeds Players and Record Book.
      </AutoComputedNote>

      {isLive && liveError && (
        <div style={{ marginBottom: 14 }}>
          <Banner tone="error">Couldn't load game payouts ({liveError}).</Banner>
        </div>
      )}
      {isLive && liveLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 14 }}>Loading…</div>}
      {!isLive && (
        <div style={{ marginBottom: 14 }}>
          <Banner tone="error">Not connected to Supabase.</Banner>
        </div>
      )}

      {!liveLoading && (
        <>
          <LastCalculatedNote lastCalculatedAt={lastCalculatedAt} />

          <SettingsSection title={`Player payouts — ${selectedYear}`}>
          {!isLive ? (
            <div style={{ fontSize: 11.5, color: "#B4AE9E" }}>Connect to Supabase to see payouts.</div>
          ) : payouts.length === 0 ? (
            <div style={{ fontSize: 11.5, color: "#B4AE9E" }}>No results recorded yet for {selectedYear} — click Recalculate above.</div>
          ) : (
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
                {payouts
                  .map((p) => ({
                    ...p,
                    name: PLAYERS.find((pl) => pl.id === p.player_id)?.name || `Player ${p.player_id}`,
                    net: Number(p.game_winnings) - Number(p.game_buy_ins),
                  }))
                  .filter((p) => Number(p.game_winnings) > 0 || Number(p.game_buy_ins) > 0)
                  .sort((a, b) => b.net - a.net)
                  .map((p) => (
                    <tr key={p.player_id}>
                      <td style={{ fontSize: 13, fontWeight: 500, color: "#2C2A22" }}>{p.name}</td>
                      <td className="bco-mono" style={{ textAlign: "right", fontSize: 13, color: "#8A8371" }}>
                        ${Number(p.game_buy_ins).toFixed(2)}
                      </td>
                      <td className="bco-mono" style={{ textAlign: "right", fontSize: 13, color: "#8A8371" }}>
                        ${Number(p.game_winnings).toFixed(2)}
                      </td>
                      <td className="bco-mono" style={{ textAlign: "right", fontSize: 13, fontWeight: 600, color: Number(p.net) >= 0 ? "#1B4332" : "#A3492E" }}>
                        {Number(p.net) >= 0 ? "+" : ""}
                        ${Number(p.net).toFixed(2)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
          </SettingsSection>
        </>
      )}
    </div>
  );
}

export default GamesResultsSettings;
export { GamesResultsSettings };
