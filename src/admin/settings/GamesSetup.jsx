import { useState, useEffect } from "react";
import { fetchEvents, fetchEventByYear, fetchGameSettings, upsertGameSettings, fetchRounds } from "../../lib/api.js";
import { SKINS_SETTINGS } from "../../data/dummyData.js";
import { ScreenHeader } from "../../components/ScreenHeader.jsx";
import { SettingsSection } from "../../components/SettingsSection.jsx";
import { FormField } from "../../components/FormField.jsx";
import { FormInput } from "../../components/FormInput.jsx";
import { FormSelect } from "../../components/FormSelect.jsx";
import { Banner } from "../../components/Banner.jsx";
import { Button } from "../../components/Button.jsx";
import { AutoComputedNote } from "../../components/AutoComputedNote.jsx";

function GamesSetupSettings({ onBack, isLive, currentYear }) {
  const DEFAULTS = {
    skinsBuyIn: SKINS_SETTINGS.buyInPerPlayer,
    pokerBuyIn: 5,
    pokerThreePuttPenalty: 1,
    lowNetSoloBuyIn: 10,
    lowNetTeamBuyIn: 5,
    ctpPrize: 20,
  };
  const [years, setYears] = useState([currentYear]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [settings, setSettings] = useState(DEFAULTS);
  const [roundsForYear, setRoundsForYear] = useState([]);
  const [liveLoading, setLiveLoading] = useState(isLive);
  const [liveError, setLiveError] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null); // null | "saving" | "saved" | "error"

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

  // Setup only touches game_settings and the round-applicability flags —
  // no payout aggregation, so it never has to wait on that (Results does).
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
          setSettings(DEFAULTS);
          return;
        }
        setSelectedEventId(event.id);
        const [gs, rounds] = await Promise.all([fetchGameSettings(event.id), fetchRounds(event.id)]);
        if (cancelled) return;
        setRoundsForYear(rounds);
        setSettings(
          gs
            ? {
                skinsBuyIn: Number(gs.skins_buy_in),
                pokerBuyIn: Number(gs.poker_buy_in),
                pokerThreePuttPenalty: Number(gs.poker_three_putt_buy_in),
                lowNetSoloBuyIn: Number(gs.low_net_solo_buy_in),
                lowNetTeamBuyIn: Number(gs.low_net_team_buy_in),
                ctpPrize: Number(gs.ctp_prize),
              }
            : DEFAULTS
        );
      } catch (err) {
        console.error("Failed to load game settings:", err);
        setLiveError(err.message || String(err));
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, selectedYear]);

  const update = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setSaveStatus(null);
  };

  const handleSave = async () => {
    if (!isLive || !selectedEventId) return;
    setSaveStatus("saving");
    try {
      await upsertGameSettings(selectedEventId, settings);
      setSaveStatus("saved");
    } catch (err) {
      console.error("Failed to save game settings:", err);
      setSaveStatus("error");
    }
  };

  // Illustrative only — buy-in x number of applicable rounds. The actual
  // per-player payout math (on Games Results) is participant-weighted per
  // round, since not everyone necessarily plays every round; this is just
  // a quick "roughly how big is this pool" figure for the admin.
  const totalRounds = roundsForYear.length;
  const skinsRounds = roundsForYear.filter((r) => r.applies_skins).length;
  const pokerRounds = roundsForYear.filter((r) => r.applies_poker).length;
  const lowNetRounds = roundsForYear.filter((r) => r.applies_low_net).length;
  const ctpRounds = roundsForYear.filter((r) => r.applies_ctp).length;

  return (
    <div style={{ padding: "14px 20px 24px" }}>
      <ScreenHeader title="Games setup" onBack={onBack} backLabel="Back to Admin" />

      <SettingsSection title="Year" description="Buy-ins and prizes are saved per year. Add new years on Admin → Year settings.">
        <FormField label="Year">
          <FormSelect value={selectedYear} onChange={(v) => setSelectedYear(Number(v))} options={years.map((y) => ({ value: y, label: String(y) }))} />
        </FormField>
      </SettingsSection>

      <AutoComputedNote>
        These drive the pot math shown on Games for {selectedYear} (Skins and Poker payouts read this directly; Low
        Net and CTP show it as context). Results (who actually won what) lives on Games Results.
      </AutoComputedNote>

      {isLive && liveError && (
        <div style={{ marginBottom: 14 }}>
          <Banner tone="error">Couldn't load live game settings ({liveError}) — showing defaults instead.</Banner>
        </div>
      )}
      {isLive && liveLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 14 }}>Loading…</div>}
      {isLive && !liveLoading && !liveError && !selectedEventId && (
        <div style={{ fontSize: 12.5, color: "#B4AE9E", padding: "12px 0", marginBottom: 10 }}>
          No event found for {selectedYear} yet — add it on Admin → Year settings first.
        </div>
      )}
      {!isLive && (
        <div style={{ marginBottom: 14 }}>
          <Banner tone="error">Not connected to Supabase — changes here won't be saved.</Banner>
        </div>
      )}

      <SettingsSection title="Skins">
        <FormField label="Buy-in per player ($)">
          <FormInput type="number" value={settings.skinsBuyIn} onChange={(v) => update("skinsBuyIn", v)} />
        </FormField>
        {isLive && totalRounds > 0 && (
          <div style={{ fontSize: 10.5, color: "#8A8371", marginTop: 8 }}>
            Applies to {skinsRounds} of {totalRounds} rounds this year — roughly ${(settings.skinsBuyIn * skinsRounds).toFixed(2)}/player
            in buy-ins across the year (actual pot per round also depends on how many played).
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Putting Poker">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <FormField label="Buy-in ($)">
            <FormInput type="number" value={settings.pokerBuyIn} onChange={(v) => update("pokerBuyIn", v)} />
          </FormField>
          <FormField label="3-putt penalty ($)">
            <FormInput type="number" value={settings.pokerThreePuttPenalty} onChange={(v) => update("pokerThreePuttPenalty", v)} />
          </FormField>
        </div>
        {isLive && totalRounds > 0 && (
          <div style={{ fontSize: 10.5, color: "#8A8371", marginTop: 8 }}>
            Applies to {pokerRounds} of {totalRounds} rounds this year. Pot per round is buy-ins + 3-putt penalties, so
            it varies with actual putting — see Games for each round's real pot.
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Low Net" description="Both are per-player buy-ins — a team's pot is the team buy-in × 2, since it's paid in by each player individually.">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <FormField label="Solo buy-in ($/player)">
            <FormInput type="number" value={settings.lowNetSoloBuyIn} onChange={(v) => update("lowNetSoloBuyIn", v)} />
          </FormField>
          <FormField label="Team buy-in ($/player)">
            <FormInput type="number" value={settings.lowNetTeamBuyIn} onChange={(v) => update("lowNetTeamBuyIn", v)} />
          </FormField>
        </div>
        {isLive && totalRounds > 0 && (
          <div style={{ fontSize: 10.5, color: "#8A8371", marginTop: 8 }}>
            Applies to {lowNetRounds} of {totalRounds} rounds this year.
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        title="Closest to Pin"
        description="Buy-in is per player, per round — the pot (buy-in × players who played that round) splits evenly across however many par-3 holes that round's actual course has."
      >
        <FormField label="Buy-in per player, per round ($)">
          <FormInput type="number" value={settings.ctpPrize} onChange={(v) => update("ctpPrize", v)} />
        </FormField>
        {isLive && totalRounds > 0 && (
          <div style={{ fontSize: 10.5, color: "#8A8371", marginTop: 8 }}>
            Applies to {ctpRounds} of {totalRounds} rounds this year.
          </div>
        )}
      </SettingsSection>

      {saveStatus === "saved" && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="success">Game settings saved for {currentYear}.</Banner>
        </div>
      )}
      {saveStatus === "error" && (
        <div style={{ marginBottom: 10 }}>
          <Banner tone="error">Couldn't save — try again.</Banner>
        </div>
      )}
      <Button onClick={handleSave} disabled={!isLive || !selectedEventId || saveStatus === "saving"}>
        {saveStatus === "saving" ? "Saving…" : "Save game settings"}
      </Button>
    </div>
  );
}

export default GamesSetupSettings;
export { GamesSetupSettings };
