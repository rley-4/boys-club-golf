import React, { useEffect, useState } from "react";
import AppShell, { PLAYERS, COURSES } from "./AppShell.jsx";
import LoginScreen from "./LoginScreen.jsx";
import { supabaseConfigured } from "./lib/supabaseClient.js";
import { fetchCurrentEvent, fetchPlayers, fetchCourses } from "./lib/api.js";

export default function App() {
  const [status, setStatus] = useState("loading"); // "loading" | "ready"
  const [isLive, setIsLive] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [initialYear, setInitialYear] = useState(undefined);
  const [loggedIn, setLoggedIn] = useState(false);
  const [viewMode, setViewMode] = useState("mobile");

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!supabaseConfigured) {
        // No .env set up yet — just run on the built-in demo data, same as
        // every screen has so far. Nothing to fetch.
        if (!cancelled) setStatus("ready");
        return;
      }

      try {
        const event = await fetchCurrentEvent();
        const [players, courses] = await Promise.all([fetchPlayers(event.id), fetchCourses()]);

        if (cancelled) return;

        // Hydrate the existing module-level arrays in place, so every screen
        // that already reads PLAYERS/COURSES directly (Score, Matches, Games,
        // Record Book, Players/Courses admin screens, etc.) picks up live
        // data with zero changes to those components. This is a pragmatic
        // bridge for testing — a cleaner pass later would thread this through
        // context/props instead of mutating shared arrays. Round-to-course
        // mapping is handled inside AppShell, since it needs to re-run
        // whenever Current Year changes, not just once at boot.
        if (players.length) {
          PLAYERS.length = 0;
          PLAYERS.push(...players);
        }
        if (courses.length) {
          courses.forEach((c) => {
            c.isActiveThisYear = c.playedEventId === event.id;
          });
          COURSES.length = 0;
          COURSES.push(...courses);
        }

        setInitialYear(event.year);
        setIsLive(true);
      } catch (err) {
        console.error("Failed to load live data from Supabase:", err);
        setLoadError(err.message || String(err));
      } finally {
        if (!cancelled) setStatus("ready");
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontFamily: "system-ui, sans-serif",
          color: "#6B6455",
        }}
      >
        Loading…
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <LoginScreen
        onEnter={(mode) => {
          setViewMode(mode);
          setLoggedIn(true);
        }}
      />
    );
  }

  return (
    <div style={{ padding: "24px 12px", minHeight: "100vh", background: "#EFEAE0" }}>
      <AppShell initialYear={initialYear} isLive={isLive} loadError={loadError} initialViewMode={viewMode} />
    </div>
  );
}
