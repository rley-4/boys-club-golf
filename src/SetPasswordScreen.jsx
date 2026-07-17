import React, { useState } from "react";
import { setPassword } from "./lib/auth.js";

// Shown when someone arrives via an invite (or password-reset) email link —
// Supabase signs them into a temporary session automatically; this sets
// their real password on it.
export default function SetPasswordScreen({ onDone }) {
  const [password, setPasswordValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState(null); // null | "loading" | "error"
  const [error, setError] = useState(null);

  const canSubmit = password.length >= 8 && password === confirm;

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError(password.length < 8 ? "Password needs to be at least 8 characters." : "Passwords don't match.");
      return;
    }
    setStatus("loading");
    setError(null);
    try {
      await setPassword(password);
      onDone();
    } catch (err) {
      console.error("Failed to set password:", err);
      setError(err.message || "Couldn't set your password — try again.");
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
        <div style={{ fontSize: 15, fontWeight: 600, color: "#1B4332", marginBottom: 4 }}>Welcome — set your password</div>
        <div style={{ fontSize: 12, color: "#6B6455", marginBottom: 18, lineHeight: 1.5 }}>
          This is the password you'll use to sign in from now on.
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6455", marginBottom: 6, letterSpacing: "0.02em" }}>NEW PASSWORD</div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPasswordValue(e.target.value)}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          style={{ width: "100%", boxSizing: "border-box", border: "1px solid #DCD6C4", borderRadius: 8, padding: "10px 12px", fontSize: 14, marginBottom: 14, fontFamily: "inherit" }}
        />

        <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6455", marginBottom: 6, letterSpacing: "0.02em" }}>CONFIRM PASSWORD</div>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Type it again"
          autoComplete="new-password"
          style={{ width: "100%", boxSizing: "border-box", border: "1px solid #DCD6C4", borderRadius: 8, padding: "10px 12px", fontSize: 14, marginBottom: 18, fontFamily: "inherit" }}
        />

        {error && <div style={{ fontSize: 11.5, color: "#A3492E", marginBottom: 12, lineHeight: 1.5 }}>{error}</div>}

        <button
          onClick={handleSubmit}
          disabled={status === "loading"}
          style={{
            width: "100%",
            border: "none",
            background: "#1B4332",
            color: "#FBF8F1",
            borderRadius: 8,
            padding: "12px 0",
            fontSize: 14.5,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
            opacity: status === "loading" ? 0.7 : 1,
          }}
        >
          {status === "loading" ? "Saving…" : "Set password & continue"}
        </button>
      </div>
    </div>
  );
}
