import React, { useState } from "react";
import { signInWithPassword, sendPasswordReset } from "./lib/auth.js";

export default function LoginScreen({ onSignedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState(null); // null | "loading" | "error"
  const [error, setError] = useState(null);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetStatus, setResetStatus] = useState(null); // null | "sending" | "sent" | "error"

  const handleSignIn = async () => {
    if (!email.trim() || !password) return;
    setStatus("loading");
    setError(null);
    try {
      await signInWithPassword(email.trim(), password);
      onSignedIn();
    } catch (err) {
      console.error("Sign-in failed:", err);
      setError(err.message || "Couldn't sign in — check your email and password.");
      setStatus("error");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSignIn();
  };

  const handleSendReset = async () => {
    if (!resetEmail.trim()) return;
    setResetStatus("sending");
    try {
      await sendPasswordReset(resetEmail.trim());
      setResetStatus("sent");
    } catch (err) {
      console.error("Failed to send reset link:", err);
      setResetStatus("error");
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
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');`}</style>

      <img src="/bco-logo.jpg" alt="Boys Club Open" style={{ width: 168, height: 168, borderRadius: 16, marginBottom: 28 }} />

      <div
        style={{
          width: "100%",
          maxWidth: 340,
          background: "#FBF8F1",
          borderRadius: 16,
          padding: "24px 22px",
          boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
        }}
      >
        {!showReset ? (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6455", marginBottom: 6, letterSpacing: "0.02em" }}>EMAIL</div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="you@example.com"
              autoComplete="username"
              style={{ width: "100%", boxSizing: "border-box", border: "1px solid #DCD6C4", borderRadius: 8, padding: "10px 12px", fontSize: 14, marginBottom: 14, fontFamily: "inherit" }}
            />

            <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6455", marginBottom: 6, letterSpacing: "0.02em" }}>PASSWORD</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="••••••••"
              autoComplete="current-password"
              style={{ width: "100%", boxSizing: "border-box", border: "1px solid #DCD6C4", borderRadius: 8, padding: "10px 12px", fontSize: 14, marginBottom: 18, fontFamily: "inherit" }}
            />

            {status === "error" && <div style={{ fontSize: 11.5, color: "#A3492E", marginBottom: 12, lineHeight: 1.5 }}>{error}</div>}

            <button
              onClick={handleSignIn}
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
              {status === "loading" ? "Signing in…" : "Sign in"}
            </button>

            <button
              onClick={() => {
                setShowReset(true);
                setResetEmail(email);
                setResetStatus(null);
              }}
              style={{ width: "100%", border: "none", background: "none", color: "#6B6455", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", padding: "12px 0 0", textDecoration: "underline" }}
            >
              First time, or your link didn't work? Get a new setup link
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1B4332", marginBottom: 4 }}>Get a setup link</div>
            <div style={{ fontSize: 12, color: "#6B6455", marginBottom: 16, lineHeight: 1.5 }}>
              Enter the email your invite was sent to — we'll send a fresh link. This also fixes the common case
              where the original link didn't work because it was already opened by an email security scanner
              before you clicked it.
            </div>

            {resetStatus === "sent" ? (
              <div style={{ fontSize: 12.5, color: "#1B4332", background: "#DCEFE3", borderRadius: 8, padding: "10px 12px", marginBottom: 14, lineHeight: 1.5 }}>
                Check your email for a new link.
              </div>
            ) : (
              <>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="username"
                  style={{ width: "100%", boxSizing: "border-box", border: "1px solid #DCD6C4", borderRadius: 8, padding: "10px 12px", fontSize: 14, marginBottom: 14, fontFamily: "inherit" }}
                />
                {resetStatus === "error" && (
                  <div style={{ fontSize: 11.5, color: "#A3492E", marginBottom: 12, lineHeight: 1.5 }}>
                    Couldn't send that — try again in a moment.
                  </div>
                )}
                <button
                  onClick={handleSendReset}
                  disabled={resetStatus === "sending"}
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
                    opacity: resetStatus === "sending" ? 0.7 : 1,
                    marginBottom: 10,
                  }}
                >
                  {resetStatus === "sending" ? "Sending…" : "Send setup link"}
                </button>
              </>
            )}

            <button
              onClick={() => setShowReset(false)}
              style={{ width: "100%", border: "none", background: "none", color: "#8A8371", fontSize: 12, cursor: "pointer", fontFamily: "inherit", padding: "6px 0" }}
            >
              Back to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
