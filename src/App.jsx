import React, { useEffect, useState } from "react";
import AppShell, { PLAYERS, COURSES } from "./AppShell.jsx";
import LoginScreen from "./LoginScreen.jsx";
import SetPasswordScreen from "./SetPasswordScreen.jsx";
import ClaimProfileScreen from "./ClaimProfileScreen.jsx";
import { supabaseConfigured } from "./lib/supabaseClient.js";
import { fetchCurrentEvent, fetchPlayers, fetchCourses } from "./lib/api.js";
import { onAuthStateChange, fetchMyPlayer } from "./lib/auth.js";

// Supabase redirects an invite/password-reset link back here with
// #access_token=...&type=invite (or type=recovery) in the URL hash, and its
// SDK auto-signs the visitor into a temporary session before this even
// runs. Checking for that hash is how we tell "just clicked an invite link"
// apart from "already has a real session."
function urlIndicatesPasswordSetup() {
  const hash = window.location.hash || "";
  return hash.includes("type=invite") || hash.includes("type=recovery");
}

export default function App() {
  const [status, setStatus] = useState("loading"); // "loading" | "ready"
  const [isLive, setIsLive] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [initialYear, setInitialYear] = useState(undefined);
  const [viewMode, setViewMode] = useState("mobile");

  // "checking" | "needs-password" | "needs-login" | "needs-claim" | "authed"
  // Demo mode (no Supabase configured) skips straight to "authed" — there's
  // nothing to authenticate against.
  const [authPhase, setAuthPhase] = useState(supabaseConfigured ? "checking" : "authed");
  const [myPlayer, setMyPlayer] = useState(null); // { id, name, role } | null
  const [checkTimedOut, setCheckTimedOut] = useState(false);

  const resolveAfterSignIn = async (mode) => {
    if (mode) setViewMode(mode);
    console.log("[auth] resolving player profile…");
    try {
      const player = await fetchMyPlayer();
      console.log("[auth] player:", player);
      if (player) {
        setMyPlayer(player);
        setAuthPhase("authed");
      } else {
        setAuthPhase("needs-claim");
      }
    } catch (err) {
      console.error("[auth] failed to resolve player profile:", err);
      setAuthPhase("needs-claim");
    }
  };

  useEffect(() => {
    if (!supabaseConfigured) return;
    let cancelled = false;
    let handledInitial = false;

    // Captured immediately, synchronously, before any async work — Supabase
    // strips the access-token hash from the URL as part of its own internal
    // processing before it fires onAuthStateChange, so checking the hash
    // from inside that callback (later, async) is unreliable: the hash may
    // already be gone by then, silently skipping the password screen.
    const cameFromInviteLink = urlIndicatesPasswordSetup();

    // If nothing settles the "checking" phase within 10s — a hung network
    // call, a Supabase project that's unreachable, etc. — show something
    // actionable instead of spinning forever with no way to tell what's
    // wrong.
    const timeout = setTimeout(() => {
      if (!cancelled) setCheckTimedOut(true);
    }, 10000);

    // Relying on onAuthStateChange alone (not also calling getSession()
    // separately) — it fires immediately with the current state
    // (INITIAL_SESSION) and again on every future change, and running both
    // mechanisms in parallel is a known source of race conditions.
    const unsubscribe = onAuthStateChange((event, session) => {
      if (cancelled) return;
      console.log("[auth]", event, session ? "session present" : "no session");
      clearTimeout(timeout); // heard back from Supabase at all — no need for the fallback screen

      if (!session) {
        setAuthPhase("needs-login");
        return;
      }
      if (cameFromInviteLink) {
        setAuthPhase("needs-password");
        return;
      }
      if (!handledInitial || event === "SIGNED_IN") {
        handledInitial = true;
        resolveAfterSignIn();
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Boots live data once we actually know who's signed in (or immediately,
  // in demo mode). This also means once RLS is turned on, reads will
  // correctly wait for a real session before firing.
  useEffect(() => {
    if (authPhase !== "authed") return;
    let cancelled = false;

    const timeout = setTimeout(() => {
      if (!cancelled) setCheckTimedOut(true);
    }, 10000);

    async function boot() {
      console.log("[boot] starting, supabaseConfigured:", supabaseConfigured);
      if (!supabaseConfigured) {
        if (!cancelled) setStatus("ready");
        return;
      }

      try {
        const event = await fetchCurrentEvent();
        console.log("[boot] current event:", event);
        const [players, courses] = await Promise.all([fetchPlayers(event.id), fetchCourses()]);
        console.log("[boot] loaded", players.length, "players,", courses.length, "courses");

        if (cancelled) return;

        // Hydrate the existing module-level arrays in place, so every screen
        // that already reads PLAYERS/COURSES directly (Score, Matches, Games,
        // Record Book, Players/Courses admin screens, etc.) picks up live
        // data with zero changes to those components. Round-to-course
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
      clearTimeout(timeout);
    };
  }, [authPhase]);

  const stillLoading = authPhase === "checking" || (authPhase === "authed" && status === "loading");

  if (stillLoading) {
    if (checkTimedOut) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            padding: "24px",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
            color: "#6B6455",
          }}
        >
          <div style={{ fontWeight: 600, color: "#2C2A22", marginBottom: 8 }}>This is taking longer than expected</div>
          <div style={{ fontSize: 13, maxWidth: 340, lineHeight: 1.5, marginBottom: 16 }}>
            Check the browser console for the actual error. Common causes: the Supabase project's Site URL /
            Redirect URLs (Authentication → URL Configuration) don't include this app's URL, or the invite link has
            already been used.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{ border: "1px solid #DCD6C4", background: "#FFFFFF", color: "#2C2A22", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}
          >
            Reload
          </button>
        </div>
      );
    }
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

  if (authPhase === "needs-login") {
    return <LoginScreen onSignedIn={resolveAfterSignIn} />;
  }

  if (authPhase === "needs-password") {
    return (
      <SetPasswordScreen
        onDone={() => {
          // Clear the invite/recovery hash so a refresh doesn't re-trigger
          // this screen, then resolve whether a profile still needs claiming.
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
          resolveAfterSignIn();
        }}
      />
    );
  }

  if (authPhase === "needs-claim") {
    return <ClaimProfileScreen onClaimed={resolveAfterSignIn} />;
  }

  return (
    <div style={{ padding: "24px 12px", minHeight: "100vh", background: "#EFEAE0" }}>
      <AppShell initialYear={initialYear} isLive={isLive} loadError={loadError} initialViewMode={viewMode} myPlayer={myPlayer} />
    </div>
  );
}
