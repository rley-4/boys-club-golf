import React, { useState } from "react";

// Wireframe only — no real authentication yet (that's Phase 1 in the auth
// planning doc). This just gates entry to the app and captures which view
// mode to open in, replacing the old corner toggle inside AppShell.
export default function LoginScreen({ onEnter }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [viewMode, setViewMode] = useState("mobile");
  const [touched, setTouched] = useState(false);

  const canEnter = email.trim() !== "" && password !== "";

  const handleEnter = () => {
    setTouched(true);
    if (!canEnter) return;
    onEnter(viewMode);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleEnter();
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

      <img
        src="/bco-logo.jpg"
        alt="Boys Club Open"
        style={{ width: 168, height: 168, borderRadius: 16, marginBottom: 28 }}
      />

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
          style={{
            width: "100%",
            boxSizing: "border-box",
            border: `1px solid ${touched && !email.trim() ? "#C1554E" : "#DCD6C4"}`,
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 14,
            marginBottom: 14,
            fontFamily: "inherit",
          }}
        />

        <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6455", marginBottom: 6, letterSpacing: "0.02em" }}>PASSWORD</div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="••••••••"
          style={{
            width: "100%",
            boxSizing: "border-box",
            border: `1px solid ${touched && !password ? "#C1554E" : "#DCD6C4"}`,
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 14,
            marginBottom: 18,
            fontFamily: "inherit",
          }}
        />

        <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6455", marginBottom: 6, letterSpacing: "0.02em" }}>VIEW AS</div>
        <div style={{ display: "flex", border: "1px solid #DCD6C4", borderRadius: 8, overflow: "hidden", marginBottom: 20 }}>
          <button
            onClick={() => setViewMode("mobile")}
            style={{
              flex: 1,
              border: "none",
              background: viewMode === "mobile" ? "#1B4332" : "#FFFFFF",
              color: viewMode === "mobile" ? "#F3EFE2" : "#6B6455",
              padding: "9px 0",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Mobile
          </button>
          <button
            onClick={() => setViewMode("desktop")}
            style={{
              flex: 1,
              border: "none",
              borderLeft: "1px solid #DCD6C4",
              background: viewMode === "desktop" ? "#1B4332" : "#FFFFFF",
              color: viewMode === "desktop" ? "#F3EFE2" : "#6B6455",
              padding: "9px 0",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Desktop
          </button>
        </div>

        {touched && !canEnter && (
          <div style={{ fontSize: 11.5, color: "#A3492E", marginBottom: 12 }}>Enter an email and password to continue.</div>
        )}

        <button
          onClick={handleEnter}
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
          }}
        >
          Enter
        </button>

        <div style={{ fontSize: 10, color: "#B4AE9E", marginTop: 14, textAlign: "center", lineHeight: 1.5 }}>
          Wireframe login — accounts and access levels aren't live yet.
        </div>
      </div>
    </div>
  );
}
