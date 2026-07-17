import React, { useState } from "react";
import { signInWithPassword } from "./lib/auth.js";

export default function LoginScreen({ onSignedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState(null); // null | "loading" | "error"
  const [error, setError] = useState(null);

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

        <div style={{ fontSize: 10, color: "#B4AE9E", marginTop: 14, textAlign: "center", lineHeight: 1.5 }}>
          New here? You'll need an invite from the organizer — check your email for a link to set your password.
        </div>
      </div>
    </div>
  );
}
