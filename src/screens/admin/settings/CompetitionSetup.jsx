import { useState, useEffect } from "react";
import {
  fetchEvents,
  fetchEventByYear,
  fetchPlayers,
  fetchTeams,
  fetchCompetitionSettings,
  upsertCompetitionSettings,
  fetchCompetitionPayoutPlaces,
  upsertCompetitionPayoutPlace,
  deleteCompetitionPayoutPlace,
} from "../../../lib/api.js";
import { ScreenHeader } from "../../../components/ScreenHeader.jsx";
import { SettingsSection } from "../../../components/SettingsSection.jsx";
import { FormField } from "../../../components/FormField.jsx";
import { FormInput } from "../../../components/FormInput.jsx";
import { FormSelect } from "../../../components/FormSelect.jsx";
import { Banner } from "../../../components/Banner.jsx";
import { Button } from "../../../components/Button.jsx";
import { AutoComputedNote } from "../../../components/AutoComputedNote.jsx";

const COMPETITION_LABELS = { solo: "Solo", team: "Team", carroll_cup: "Carroll Cup" };

function CompetitionSetupSettings({ onBack, isLive, currentYear }) {
  const [years, setYears] = useState([currentYear]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [settings, setSettings] = useState({ soloBuyIn: 0, teamBuyIn: 0, carrollCupBuyIn: 0 });
  const [places, setPlaces] = useState([]); // [{competition, place, amount}]
  const [soloCount, setSoloCount] = useState(0);
  const [teamCount, setTeamCount] = useState(0);
  const [liveLoading, setLiveLoading] = useState(isLive);
  const [liveError, setLiveError] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null); // null | "saving" | "saved" | "error"
  const [placeSavingKey, setPlaceSavingKey] = useState(null); // "competition-place" currently saving

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

  // Setup only touches game_settings-style config tables and cheap
  // participant counts — no rank/payout views, so this never has to wait
  // on the expensive tiebreaker/payout computation (that's Results).
  useEffect(() => {
    if (!isLive) {
      setLiveLoading(false);
      return;
    }
    let cancelled = false;
    setLiveLoading(true);
    setLiveError(null);
    setSaveStatus(null);
    (async () => {
      try {
        const event = await fetchEventByYear(selectedYear);
        if (cancelled) return;
        if (!event) {
          setSelectedEventId(null);
          setSettings({ soloBuyIn: 0, teamBuyIn: 0, carrollCupBuyIn: 0 });
          setPlaces([]);
          return;
        }
        setSelectedEventId(event.id);
        const [cs, placeRows, playersRows, teamsRows] = await Promise.all([
          fetchCompetitionSettings(event.id),
          fetchCompetitionPayoutPlaces(event.id),
          fetchPlayers(event.id),
          fetchTeams(event.id),
        ]);
        if (cancelled) return;
        setSettings(
          cs
            ? { soloBuyIn: Number(cs.solo_buy_in), teamBuyIn: Number(cs.team_buy_in), carrollCupBuyIn: Number(cs.carroll_cup_buy_in) }
            : { soloBuyIn: 0, teamBuyIn: 0, carrollCupBuyIn: 0 }
        );
        setPlaces(placeRows.map((p) => ({ ...p, amount: Number(p.amount) })));
        setSoloCount(playersRows.filter((p) => p.competing !== false).length);
        setTeamCount(teamsRows.length);
      } catch (err) {
        console.error("Failed to load competition setup:", err);
        setLiveError(err.message || String(err));
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, selectedYear]);

  const update = (field, value) => setSettings((prev) => ({ ...prev, [field]: value === "" ? 0 : Number(value) }));

  const handleSaveBuyIns = async () => {
    if (!isLive || !selectedEventId) return;
    setSaveStatus("saving");
    try {
      await upsertCompetitionSettings(selectedEventId, settings);
      setSaveStatus("saved");
    } catch (err) {
      console.error("Failed to save competition buy-ins:", err);
      setSaveStatus("error");
    }
  };

  const placesFor = (competition) => places.filter((p) => p.competition === competition).sort((a, b) => a.place - b.place);

  const handlePlaceAmountChange = (competition, place, amount) => {
    setPlaces((prev) => prev.map((p) => (p.competition === competition && p.place === place ? { ...p, amount } : p)));
  };

  const handlePlaceAmountSave = async (competition, place, amount) => {
    if (!isLive || !selectedEventId) return;
    setPlaceSavingKey(`${competition}-${place}`);
    try {
      await upsertCompetitionPayoutPlace(selectedEventId, competition, place, amount || 0);
    } catch (err) {
      console.error("Failed to save payout place:", err);
    } finally {
      setPlaceSavingKey(null);
    }
  };

  const addPlace = (competition) => {
    const existing = placesFor(competition);
    const nextPlace = existing.length > 0 ? Math.max(...existing.map((p) => p.place)) + 1 : 1;
    setPlaces((prev) => [...prev, { competition, place: nextPlace, amount: 0 }]);
    if (isLive && selectedEventId) {
      upsertCompetitionPayoutPlace(selectedEventId, competition, nextPlace, 0).catch((err) => console.error("Failed to add place:", err));
    }
  };

  const removePlace = (competition, place) => {
    setPlaces((prev) => prev.filter((p) => !(p.competition === competition && p.place === place)));
    if (isLive && selectedEventId) {
      deleteCompetitionPayoutPlace(selectedEventId, competition, place).catch((err) => console.error("Failed to remove place:", err));
    }
  };

  // For a brand-new year with no places set yet, seed Carroll Cup with its
  // two fixed places (winning side / losing side) so there's always
  // exactly 2 rows to fill in, rather than an empty list to build from
  // scratch every time.
  useEffect(() => {
    if (!isLive || !selectedEventId || liveLoading) return;
    const carrollPlaces = placesFor("carroll_cup");
    if (carrollPlaces.length === 0) {
      setPlaces((prev) => [...prev, { competition: "carroll_cup", place: 1, amount: 0 }, { competition: "carroll_cup", place: 2, amount: 0 }]);
      Promise.all([
        upsertCompetitionPayoutPlace(selectedEventId, "carroll_cup", 1, 0),
        upsertCompetitionPayoutPlace(selectedEventId, "carroll_cup", 2, 0),
      ]).catch((err) => console.error("Failed to seed Carroll Cup places:", err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, selectedEventId, liveLoading]);

  const renderPlaceRow = (competition, p, labelOverride) => (
    <div key={`${competition}-${p.place}`} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <div style={{ width: 84, fontSize: 12.5, color: "#6B6455", flexShrink: 0 }}>{labelOverride || `Place ${p.place}`}</div>
      <input
        type="number"
        value={p.amount}
        onChange={(e) => handlePlaceAmountChange(competition, p.place, e.target.value === "" ? 0 : Number(e.target.value))}
        onBlur={(e) => handlePlaceAmountSave(competition, p.place, e.target.value === "" ? 0 : Number(e.target.value))}
        style={{ flex: 1, border: "1px solid #DCD6C4", borderRadius: 8, padding: "7px 10px", fontSize: 13, fontFamily: "'Inter', sans-serif" }}
      />
      {placeSavingKey === `${competition}-${p.place}` && <span style={{ fontSize: 10, color: "#8A8371" }}>Saving…</span>}
      {!labelOverride && (
        <button
          onClick={() => removePlace(competition, p.place)}
          style={{ border: "none", background: "none", color: "#B4AE9E", cursor: "pointer", fontSize: 14, padding: 2 }}
          aria-label={`Remove place ${p.place}`}
        >
          ×
        </button>
      )}
    </div>
  );

  return (
    <div style={{ padding: "14px 20px 24px" }}>
      <ScreenHeader title="Competition setup" onBack={onBack} backLabel="Back to Admin" />

      <SettingsSection title="Year" description="Buy-ins and payout places are saved per year.">
        <FormField label="Year">
          <FormSelect value={selectedYear} onChange={(v) => setSelectedYear(Number(v))} options={years.map((y) => ({ value: y, label: String(y) }))} />
        </FormField>
      </SettingsSection>

      <AutoComputedNote>
        Buy-ins and payouts here are for the season-long standings — final Solo place, final Team place, Carroll Cup
        outcome — not the daily round games (that's Games Setup). Set a dollar amount for whichever finishing places
        you want to pay out; unset places pay nothing. Results (who actually won what) lives on Competition Results.
      </AutoComputedNote>

      {isLive && liveError && (
        <div style={{ marginBottom: 14 }}>
          <Banner tone="error">Couldn't load competition setup ({liveError}).</Banner>
        </div>
      )}
      {isLive && liveLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 14 }}>Loading…</div>}
      {!isLive && (
        <div style={{ marginBottom: 14 }}>
          <Banner tone="error">Not connected to Supabase — changes here won't be saved.</Banner>
        </div>
      )}

      {!liveLoading && (
        <>
          <SettingsSection title="Buy-ins (per player)">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <FormField label="Solo ($)">
                <FormInput type="number" value={settings.soloBuyIn} onChange={(v) => update("soloBuyIn", v)} />
              </FormField>
              <FormField label="Team ($)">
                <FormInput type="number" value={settings.teamBuyIn} onChange={(v) => update("teamBuyIn", v)} />
              </FormField>
              <FormField label="Carroll Cup ($)">
                <FormInput type="number" value={settings.carrollCupBuyIn} onChange={(v) => update("carrollCupBuyIn", v)} />
              </FormField>
            </div>
            {isLive && (
              <div style={{ fontSize: 10.5, color: "#8A8371", marginTop: 8, lineHeight: 1.5 }}>
                Solo pool: ${(settings.soloBuyIn * soloCount).toFixed(2)} ({soloCount} players). Team pool: $
                {(settings.teamBuyIn * teamCount * 2).toFixed(2)} ({teamCount} teams). Carroll Cup pool: $
                {(settings.carrollCupBuyIn * soloCount).toFixed(2)} ({soloCount} players, roster-dependent).
              </div>
            )}
            {saveStatus === "saved" && (
              <div style={{ marginTop: 10 }}>
                <Banner tone="success">Buy-ins saved for {selectedYear}.</Banner>
              </div>
            )}
            {saveStatus === "error" && (
              <div style={{ marginTop: 10 }}>
                <Banner tone="error">Couldn't save — try again.</Banner>
              </div>
            )}
            <Button style={{ marginTop: 10 }} onClick={handleSaveBuyIns} disabled={!isLive || !selectedEventId || saveStatus === "saving"}>
              {saveStatus === "saving" ? "Saving…" : "Save buy-ins"}
            </Button>
          </SettingsSection>

          <SettingsSection title="Solo payouts by place" description={`${soloCount} players this year — pay out however many places you want.`}>
            {placesFor("solo").map((p) => renderPlaceRow("solo", p))}
            <button
              onClick={() => addPlace("solo")}
              style={{ border: "none", background: "none", color: "#1B4332", fontSize: 11.5, fontWeight: 600, cursor: "pointer", padding: "4px 0", fontFamily: "'Inter', sans-serif" }}
            >
              + Add place
            </button>
          </SettingsSection>

          <SettingsSection title="Team payouts by place" description={`${teamCount} teams this year — pay out however many places you want.`}>
            {placesFor("team").map((p) => renderPlaceRow("team", p))}
            <button
              onClick={() => addPlace("team")}
              style={{ border: "none", background: "none", color: "#1B4332", fontSize: 11.5, fontWeight: 600, cursor: "pointer", padding: "4px 0", fontFamily: "'Inter', sans-serif" }}
            >
              + Add place
            </button>
          </SettingsSection>

          <SettingsSection title="Carroll Cup payout" description="Always exactly 2 places — the winning side's pool, and the losing side's (usually $0). A tie splits both across everyone.">
            {placesFor("carroll_cup").map((p) => renderPlaceRow("carroll_cup", p, p.place === 1 ? "Winning side" : "Losing side"))}
          </SettingsSection>
        </>
      )}
    </div>
  );
}

export default CompetitionSetupSettings;
export { CompetitionSetupSettings };
