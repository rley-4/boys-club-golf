import { useState, useEffect, useRef } from "react";
import { fetchEvents, fetchEventByYear, fetchRounds, createRound, updateRound, deleteRound } from "../../lib/api.js";
import { COURSES, ROUND_COURSE, SCORE_ROUNDS } from "../../data/dummyData.js";
import { ScreenHeader } from "../../components/ScreenHeader.jsx";
import { SettingsSection } from "../../components/SettingsSection.jsx";
import { FormField } from "../../components/FormField.jsx";
import { FormInput } from "../../components/FormInput.jsx";
import { FormSelect } from "../../components/FormSelect.jsx";
import { Banner } from "../../components/Banner.jsx";
import { RemoveButton, AddRowButton } from "../../components/RowButtons.jsx";

function RoundSetupSettings({ onBack, isLive, currentYear, refreshRoundMap }) {
  const idRef = useRef(1000);
  const nextId = () => ++idRef.current;

  const [years, setYears] = useState([currentYear]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedEventId, setSelectedEventId] = useState(null);

  const [rounds, setRounds] = useState(() =>
    SCORE_ROUNDS.map((r) => ({
      id: nextId(),
      label: r,
      courseId: (ROUND_COURSE[r] || COURSES[0]).id,
      countsForSolo: true,
      countsForTeam: true,
      countsForCarrollCup: false,
      playFormat: "stroke",
      appliesSkins: true,
      appliesPoker: true,
      appliesLowNet: true,
      appliesCtp: true,
    }))
  );
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
          return;
        }
        setSelectedEventId(event.id);
        const dbRounds = await fetchRounds(event.id);
        if (cancelled) return;
        setRounds(
          dbRounds.map((r) => ({
            id: r.id,
            label: r.label,
            courseId: r.course_id,
            countsForSolo: r.counts_for_solo !== false,
            countsForTeam: r.counts_for_team !== false,
            countsForCarrollCup: r.counts_for_carroll_cup === true,
            playFormat: r.play_format || "stroke",
            appliesSkins: r.applies_skins !== false,
            appliesPoker: r.applies_poker !== false,
            appliesLowNet: r.applies_low_net !== false,
            appliesCtp: r.applies_ctp !== false,
          }))
        );
      } catch (err) {
        console.error("Failed to load rounds:", err);
        setLiveError(err.message || String(err));
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, selectedYear]);

  // Score/Matches only ever look at the globally active Current Year, so
  // there's no need to force a refresh if we're editing some other year's
  // rounds here — they wouldn't be reading from it anyway.
  const maybeRefresh = () => {
    if (selectedYear === currentYear) refreshRoundMap();
  };

  const addRound = async () => {
    const label = `R${rounds.length + 1}`;
    const courseId = (COURSES.find((c) => c.isActiveThisYear !== false) || COURSES[0]).id;
    if (isLive && selectedEventId) {
      try {
        const id = await createRound({ eventId: selectedEventId, label, courseId, roundOrder: rounds.length + 1 });
        setRounds((prev) => [...prev, { id, label, courseId, countsForSolo: true, countsForTeam: true, countsForCarrollCup: false, playFormat: "stroke", appliesSkins: true, appliesPoker: true, appliesLowNet: true, appliesCtp: true }]);
        maybeRefresh();
      } catch (err) {
        console.error("Failed to add round:", err);
      }
    } else {
      setRounds((prev) => [...prev, { id: nextId(), label, courseId, countsForSolo: true, countsForTeam: true, countsForCarrollCup: false, playFormat: "stroke", appliesSkins: true, appliesPoker: true, appliesLowNet: true, appliesCtp: true }]);
    }
  };
  const removeRound = (id) => {
    setRounds((prev) => prev.filter((r) => r.id !== id));
    if (isLive && selectedEventId) {
      deleteRound(id)
        .then(maybeRefresh)
        .catch((err) => console.error("Failed to remove round:", err));
    }
  };
  const updateRoundField = (id, field, value) => {
    setRounds((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, [field]: value } : r));
      if (isLive && selectedEventId) {
        const r = next.find((x) => x.id === id);
        updateRound(id, {
          label: r.label,
          courseId: r.courseId,
          countsForSolo: r.countsForSolo,
          countsForTeam: r.countsForTeam,
          countsForCarrollCup: r.countsForCarrollCup,
          playFormat: r.playFormat,
          appliesSkins: r.appliesSkins,
          appliesPoker: r.appliesPoker,
          appliesLowNet: r.appliesLowNet,
          appliesCtp: r.appliesCtp,
        })
          .then(maybeRefresh)
          .catch((err) => console.error("Failed to update round:", err));
      }
      return next;
    });
  };

  const activeCourseOptions = COURSES.filter((c) => c.isActiveThisYear !== false).map((c) => ({
    value: c.id,
    label: `${c.name} — ${c.tee} (${c.holesCount || c.holes.length || 18}h)`,
  }));

  const courseOptionsFor = (currentCourseId) => {
    if (activeCourseOptions.some((o) => o.value === currentCourseId)) return activeCourseOptions;
    // The round's current course isn't active this year — keep it visible in
    // its own row (labeled as such) rather than silently showing the wrong
    // course, but don't offer it for newly-assigned rounds.
    const inactive = COURSES.find((c) => c.id === currentCourseId);
    if (!inactive) return activeCourseOptions;
    return [{ value: inactive.id, label: `${inactive.name} — ${inactive.tee} (inactive this year)` }, ...activeCourseOptions];
  };

  const yearOptions = years.map((y) => ({ value: y, label: String(y) }));

  return (
    <div style={{ padding: "14px 20px 24px" }}>
      <ScreenHeader title="Round setup" onBack={onBack} backLabel="Back to Admin" />

      <SettingsSection title="Year" description="Which year's rounds you're configuring. Add new years on Admin → Year settings.">
        <FormField label="Year">
          <FormSelect value={selectedYear} onChange={(v) => setSelectedYear(Number(v))} options={yearOptions} />
        </FormField>
      </SettingsSection>

      {isLive && liveError && (
        <div style={{ marginBottom: 14 }}>
          <Banner tone="error">Couldn't load live rounds ({liveError}) — showing local data instead.</Banner>
        </div>
      )}
      {isLive && liveLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 14 }}>Loading rounds…</div>}
      {isLive && !liveLoading && !liveError && !selectedEventId && (
        <div style={{ fontSize: 12.5, color: "#B4AE9E", padding: "12px 0", marginBottom: 10 }}>
          No event found for {selectedYear} yet — add it on Admin → Year settings first.
        </div>
      )}

      {(!isLive || selectedEventId) && (
        <SettingsSection
          title="Rounds"
          description="Almost all rounds are Solo and Team stroke/match play — the checkboxes below handle the edge cases where a round shouldn't roll up into one of those (or should also count toward Carroll Cup)."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rounds.map((r) => (
              <div key={r.id} style={{ background: "#FFFFFF", border: "1px solid #E4DFCE", borderRadius: 10, padding: 12, position: "relative" }}>
                <RemoveButton onClick={() => removeRound(r.id)} />
                <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 8, marginBottom: 10 }}>
                  <FormInput value={r.label} onChange={(v) => updateRoundField(r.id, "label", v)} />
                  <FormSelect value={r.courseId} onChange={(v) => updateRoundField(r.id, "courseId", Number(v))} options={courseOptionsFor(r.courseId)} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <FormField label="Play format">
                    <FormSelect
                      value={r.playFormat || "stroke"}
                      onChange={(v) => updateRoundField(r.id, "playFormat", v)}
                      options={[
                        { value: "stroke", label: "Stroke play" },
                        { value: "scramble", label: "Scramble" },
                        { value: "alternate_shot", label: "Alternate shot" },
                      ]}
                    />
                  </FormField>
                </div>
                <div style={{ fontSize: 9.5, fontWeight: 600, color: "#8A8371", letterSpacing: "0.03em", marginBottom: 6 }}>COUNTS TOWARD</div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#2C2A22", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={r.countsForSolo}
                      onChange={(e) => updateRoundField(r.id, "countsForSolo", e.target.checked)}
                      style={{ accentColor: "#1B4332", width: 15, height: 15 }}
                    />
                    Solo
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#2C2A22", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={r.countsForTeam}
                      onChange={(e) => updateRoundField(r.id, "countsForTeam", e.target.checked)}
                      style={{ accentColor: "#1B4332", width: 15, height: 15 }}
                    />
                    Team
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#2C2A22", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={r.countsForCarrollCup}
                      onChange={(e) => updateRoundField(r.id, "countsForCarrollCup", e.target.checked)}
                      style={{ accentColor: "#1B4332", width: 15, height: 15 }}
                    />
                    Carroll Cup
                  </label>
                </div>

                <div style={{ fontSize: 9.5, fontWeight: 600, color: "#8A8371", letterSpacing: "0.03em", marginTop: 12, marginBottom: 6 }}>GAMES PLAYED THIS ROUND</div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#2C2A22", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={r.appliesSkins}
                      onChange={(e) => updateRoundField(r.id, "appliesSkins", e.target.checked)}
                      style={{ accentColor: "#1B4332", width: 15, height: 15 }}
                    />
                    Skins
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#2C2A22", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={r.appliesPoker}
                      onChange={(e) => updateRoundField(r.id, "appliesPoker", e.target.checked)}
                      style={{ accentColor: "#1B4332", width: 15, height: 15 }}
                    />
                    Poker
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#2C2A22", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={r.appliesLowNet}
                      onChange={(e) => updateRoundField(r.id, "appliesLowNet", e.target.checked)}
                      style={{ accentColor: "#1B4332", width: 15, height: 15 }}
                    />
                    Low Net
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#2C2A22", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={r.appliesCtp}
                      onChange={(e) => updateRoundField(r.id, "appliesCtp", e.target.checked)}
                      style={{ accentColor: "#1B4332", width: 15, height: 15 }}
                    />
                    CTP
                  </label>
                </div>
              </div>
            ))}
            <AddRowButton label="+ Add round" onClick={addRound} />
          </div>
        </SettingsSection>
      )}
    </div>
  );
}

export default RoundSetupSettings;
export { RoundSetupSettings };
