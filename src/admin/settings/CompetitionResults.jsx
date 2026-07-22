import { useState, useEffect } from "react";
import {
  fetchEvents,
  fetchEventByYear,
  fetchTeams,
  fetchPayoutSnapshot,
  fetchPayoutSnapshotTimestamp,
  fetchSoloTiebreakDetail,
  fetchTeamTiebreakDetail,
} from "../../lib/api.js";
import { PLAYERS } from "../../data/dummyData.js";
import { ScreenHeader } from "../../components/ScreenHeader.jsx";
import { SettingsSection } from "../../components/SettingsSection.jsx";
import { FormField } from "../../components/FormField.jsx";
import { FormSelect } from "../../components/FormSelect.jsx";
import { Banner } from "../../components/Banner.jsx";
import { AutoComputedNote } from "../../components/AutoComputedNote.jsx";
import { LastCalculatedNote } from "../../components/RecalculateControl.jsx";

function CompetitionResultsSettings({ onBack, isLive, currentYear }) {
  const [years, setYears] = useState([currentYear]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [teamsForYear, setTeamsForYear] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [lastCalculatedAt, setLastCalculatedAt] = useState(null);
  const [soloTiebreaks, setSoloTiebreaks] = useState([]);
  const [teamTiebreaks, setTeamTiebreaks] = useState([]);
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

  const loadPayoutSnapshot = async (eventId) => {
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
          setSoloTiebreaks([]);
          setTeamTiebreaks([]);
          return;
        }
        setSelectedEventId(event.id);
        const [teamsRows, soloTb, teamTb] = await Promise.all([
          fetchTeams(event.id),
          fetchSoloTiebreakDetail(event.id),
          fetchTeamTiebreakDetail(event.id),
        ]);
        if (cancelled) return;
        setTeamsForYear(teamsRows);
        setSoloTiebreaks(soloTb);
        setTeamTiebreaks(teamTb);
        await loadPayoutSnapshot(event.id);
      } catch (err) {
        console.error("Failed to load competition results:", err);
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
      <ScreenHeader title="Competition results" onBack={onBack} backLabel="Back to Admin" />

      <SettingsSection title="Year">
        <FormField label="Year">
          <FormSelect value={selectedYear} onChange={(v) => setSelectedYear(Number(v))} options={years.map((y) => ({ value: y, label: String(y) }))} />
        </FormField>
      </SettingsSection>

      <AutoComputedNote>
        Computed live from actual final standings, including every tiebreak level — nothing here to update by hand.
        Buy-ins and payout-by-place amounts are set on Competition Setup.
      </AutoComputedNote>

      {isLive && liveError && (
        <div style={{ marginBottom: 14 }}>
          <Banner tone="error">Couldn't load competition results ({liveError}).</Banner>
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
          <SettingsSection
            title="How places were decided"
            description="Outright, or which tiebreak level resolved it. A true tie (survived every level) combines the places it spans and splits the total evenly."
          >
            {!isLive ? (
              <div style={{ fontSize: 11.5, color: "#B4AE9E" }}>Connect to Supabase to see this.</div>
            ) : (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6455", marginBottom: 6 }}>Solo</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
                  {soloTiebreaks.length === 0 ? (
                    <div style={{ fontSize: 11.5, color: "#B4AE9E" }}>No Solo standings yet for {selectedYear}.</div>
                  ) : (
                    soloTiebreaks.map((t) => (
                      <div key={t.player_id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: "1px solid #F0ECDF" }}>
                        <span style={{ color: "#2C2A22" }}>
                          #{t.year_rank} {PLAYERS.find((p) => p.id === t.player_id)?.name || `Player ${t.player_id}`}
                        </span>
                        <span style={{ color: t.decided_by === "Outright" ? "#8A8371" : t.decided_by === "True tie" ? "#A3492E" : "#1B4332", fontWeight: t.decided_by === "Outright" ? 400 : 600 }}>
                          {t.decided_by}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6455", marginBottom: 6 }}>Team</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {teamTiebreaks.length === 0 ? (
                    <div style={{ fontSize: 11.5, color: "#B4AE9E" }}>No Team standings yet for {selectedYear}.</div>
                  ) : (
                    teamTiebreaks.map((t) => (
                      <div key={t.team_id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: "1px solid #F0ECDF" }}>
                        <span style={{ color: "#2C2A22" }}>
                          #{t.year_rank} {teamsForYear.find((tm) => tm.id === t.team_id)?.name || `Team ${t.team_id}`}
                        </span>
                        <span style={{ color: t.decided_by === "Outright" ? "#8A8371" : t.decided_by === "True tie" ? "#A3492E" : "#1B4332", fontWeight: t.decided_by === "Outright" ? 400 : 600 }}>
                          {t.decided_by}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </SettingsSection>

          <LastCalculatedNote lastCalculatedAt={lastCalculatedAt} />

          <SettingsSection
            title={`Competition payouts — ${selectedYear}`}
            description="Player | Buy-ins | Winnings | Net, combined across Solo, Team, and Carroll Cup."
          >
            {!isLive ? (
              <div style={{ fontSize: 11.5, color: "#B4AE9E" }}>Connect to Supabase to see payouts.</div>
            ) : payouts.length === 0 ? (
              <div style={{ fontSize: 11.5, color: "#B4AE9E" }}>No payout places set, or no final standings yet for {selectedYear} — click Recalculate above.</div>
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
                      net: Number(p.competition_winnings) - Number(p.competition_buy_ins),
                    }))
                    .filter((p) => Number(p.competition_winnings) > 0 || Number(p.competition_buy_ins) > 0)
                    .sort((a, b) => b.net - a.net)
                    .map((p) => (
                      <tr key={p.player_id}>
                        <td style={{ fontSize: 13, fontWeight: 500, color: "#2C2A22" }}>{p.name}</td>
                        <td className="bco-mono" style={{ textAlign: "right", fontSize: 13, color: "#8A8371" }}>
                          ${Number(p.competition_buy_ins).toFixed(2)}
                        </td>
                        <td className="bco-mono" style={{ textAlign: "right", fontSize: 13, color: "#8A8371" }}>
                          ${Number(p.competition_winnings).toFixed(2)}
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

export default CompetitionResultsSettings;
export { CompetitionResultsSettings };
