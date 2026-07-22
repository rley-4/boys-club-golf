import { useState, useEffect } from "react";
import { fetchEvents, fetchEventByYear, fetchRounds } from "../lib/api.js";

// Shared by every screen with a year/round picker (Games, Leaderboard, Match
// Results) — loads the list of years, then the rounds for whichever year is
// selected, refetching rounds whenever the selected year changes.
export function useYearRoundData(isLive, defaultYear) {
  const [years, setYears] = useState([defaultYear]);
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [rounds, setRounds] = useState([]); // [{label, id, courseId, countsForSolo, countsForTeam, countsForCarrollCup, appliesSkins, appliesPoker, appliesLowNet, appliesCtp}]
  const [loading, setLoading] = useState(isLive);
  const [error, setError] = useState(null);

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
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
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
        const sorted = [...dbRounds].sort((a, b) => (a.round_order ?? 0) - (b.round_order ?? 0));
        setRounds(
          sorted.map((r) => ({
            label: r.label,
            id: r.id,
            courseId: r.course_id,
            playFormat: r.play_format || "stroke",
            matchType: r.match_type || "team",
            countsForSolo: r.counts_for_solo !== false,
            countsForTeam: r.counts_for_team !== false,
            countsForCarrollCup: r.counts_for_carroll_cup === true,
            appliesSkins: r.applies_skins !== false,
            appliesPoker: r.applies_poker !== false,
            appliesLowNet: r.applies_low_net !== false,
            appliesCtp: r.applies_ctp !== false,
          }))
        );
      } catch (err) {
        console.error("Failed to load rounds for year:", err);
        setError(err.message || String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive, selectedYear]);

  return { years, selectedYear, setSelectedYear, selectedEventId, rounds, loading, error };
}

export default useYearRoundData;
