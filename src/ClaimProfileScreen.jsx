import React, { useEffect, useState } from "react";
import { fetchUnclaimedPlayers, claimPlayer, signOut } from "./lib/auth.js";

// Shown once, right after someone's first sign-in — links their account to
// one of the (as-yet-unclaimed) player rows, so the app knows who they are
// from then on.
export default function ClaimProfileScreen({ onClaimed }) {
  const [players, setPlayers] = useState(null); // null = loading
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState(null); // null | "saving" | "error"
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchUnclaimedPlayers();
        if (!cancelled) setPlayers(rows);
      } catch (err) {
        console.error("Failed to load players:", err);
        if (!cancelled) setPlayers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleClaim = async () => {
    if (!selectedId) return;
    setStatus("saving");
    setError(null);
    try {
      await claimPlayer(Number(selectedId));
      onClaimed();
    } catch (err) {
      console.error("Failed to claim player profile:", err);
      setError(err.message || "Couldn't link that profile — try again, or ask the organizer for help.");
      setStatus("error");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#357E46",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <img src="/bco-logo.jpg" alt="Boys Club Open" style={{ width: 140, height: 140, borderRadius: 16, marginBottom: 24 }} />

      <div style={{ width: "100%", maxWidth: 340, background: "#FBF8F1", borderRadius: 16, padding: "24px 22px", boxShadow: "0 8px 30px rgba(0,0,0,0.18)" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#1B4332", marginBottom: 4 }}>Which player are you?</div>
        <div style={{ fontSize: 12, color: "#6B6455", marginBottom: 18, lineHeight: 1.5 }}>
          One-time step — this links your account to your player profile, so your scores are yours.
        </div>

        {players === null ? (
          <div style={{ fontSize: 12.5, color: "#8A8371", textAlign: "center", padding: "10px 0" }}>Loading…</div>
        ) : players.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "#A3492E", lineHeight: 1.5, marginBottom: 14 }}>
            No unclaimed player profiles found. Ask the organizer to add you as a player, or check if you've already
            claimed one under a different account.
          </div>
        ) : (
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "1px solid #DCD6C4",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 14,
              marginBottom: 18,
              fontFamily: "inherit",
              background: "#FFFFFF",
              color: "#2C2A22",
            }}
          >
            <option value="">Select your name…</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}

        {error && <div style={{ fontSize: 11.5, color: "#A3492E", marginBottom: 12, lineHeight: 1.5 }}>{error}</div>}

        <button
          onClick={handleClaim}
          disabled={!selectedId || status === "saving"}
          style={{
            width: "100%",
            border: "none",
            background: "#1B4332",
            color: "#FBF8F1",
            borderRadius: 8,
            padding: "12px 0",
            fontSize: 14.5,
            fontWeight: 600,
            cursor: selectedId ? "pointer" : "default",
            fontFamily: "inherit",
            opacity: !selectedId || status === "saving" ? 0.6 : 1,
            marginBottom: 10,
          }}
        >
          {status === "saving" ? "Linking…" : "This is me"}
        </button>

        <button
          onClick={() => signOut().then(() => window.location.reload())}
          style={{ width: "100%", border: "none", background: "none", color: "#8A8371", fontSize: 12, cursor: "pointer", fontFamily: "inherit", padding: "6px 0" }}
        >
          Wrong account? Sign out
        </button>
      </div>
    </div>
  );
}
