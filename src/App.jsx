import React, { useEffect, useState } from "react";
import AppShell, { PLAYERS, COURSES } from "./AppShell.jsx";
import LoginScreen from "./LoginScreen.jsx";
import SetPasswordScreen from "./SetPasswordScreen.jsx";
import ClaimProfileScreen from "./ClaimProfileScreen.jsx";
import { supabaseConfigured } from "./lib/supabaseClient.js";
import { fetchCurrentEvent, fetchPlayers, fetchCourses } from "./lib/api.js";
import { getSession, onAuthStateChange, fetchMyPlayer } from "./lib/auth.js";

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
  const [viewMode] = useState("mobile");

  // "checking" | "needs-password" | "needs-login" | "needs-claim" | "authed"
  // Demo mode (no Supabase configured) skips straight to "authed" — there's
  // nothing to authenticate against.
  const [authPhase, setAuthPhase] = useState(supabaseConfigured ? "checking" : "authed");
  const [myPlayer, setMyPlayer] = useState(null); // { id, name, is_admin } | null

  const resolveAfterSignIn = async () => {
    try {
      const player = await fetchMyPlayer();
      if (player) {
        setMyPlayer(player);
        setAuthPhase("authed");
      } else {
        setAuthPhase("needs-claim");
      }
    } catch (err) {
      console.error("Failed to resolve player profile:", err);
      setAuthPhase("needs-claim");
    }
  };

  useEffect(() => {
    if (!supabaseConfigured) return;
    let cancelled = false;

    const cameFromInviteLink = urlIndicatesPasswordSetup();

    const unsubscribe = onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (!session) {
        setAuthPhase("needs-login");
      }
      // A real SIGNED_IN/INITIAL_SESSION event with no invite/recovery hash
      // is handled by the getSession() check below, to avoid double-firing
      // the player lookup.
    });

    (async () => {
      try {
        const session = await getSession();
        if (cancelled) return;
        if (!session) {
          setAuthPhase("needs-login");
          return;
        }
        if (cameFromInviteLink) {
          setAuthPhase("needs-password");
          return;
        }
        await resolveAfterSignIn();
      } catch (err) {
        console.error("Failed to check session:", err);
        if (!cancelled) setAuthPhase("needs-login");
      }
    })();

    return () => {
      cancelled = true;
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

    async function boot() {
      if (!supabaseConfigured) {
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
    };
  }, [authPhase]);

  if (authPhase === "checking" || status === "loading") {
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
