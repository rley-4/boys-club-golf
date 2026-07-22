import { formatCalculatedAt } from "../lib/format.js";

export function RecalcRow({ label, timestamp, status, onClick }) {
  const running = status === "running";
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <div>
        <div style={{ fontSize: 12, color: "#2C2A22" }}>{label}</div>
        <div style={{ fontSize: 10, color: status === "error" ? "#A3492E" : "#8A8371" }}>
          {status === "error" ? "Couldn't recalculate — try again." : timestamp ? formatCalculatedAt(timestamp) : "Never calculated"}
        </div>
      </div>
      <button
        onClick={onClick}
        disabled={running}
        style={{
          border: "1px solid #DCD6C4",
          background: running ? "#F3EFE2" : "#FFFFFF",
          color: "#1B4332",
          borderRadius: 8,
          padding: "6px 12px",
          fontSize: 11.5,
          fontWeight: 600,
          cursor: running ? "default" : "pointer",
          fontFamily: "'Inter', sans-serif",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {running ? "Recalculating…" : "Recalculate"}
      </button>
    </div>
  );
}

// Shared by Games Results and Competition Results — both read from the same
// payout_snapshots cache, and a single Recalculate refreshes both at once
// (they're derived together server-side, so there's no meaningful way to
// refresh just one half without risking them drifting apart).
// Read-only — actually recalculating happens on Admin → Year Settings now,
// not scattered across every screen that displays cached data. This just
// shows whether what's on screen might be stale.
export function LastCalculatedNote({ lastCalculatedAt }) {
  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E4DFCE", borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 11.5, color: "#8A8371" }}>
      {lastCalculatedAt ? (
        <>Last calculated {formatCalculatedAt(lastCalculatedAt)}. Recalculate on Admin → Year Settings.</>
      ) : (
        <>Never calculated for this year — recalculate on Admin → Year Settings.</>
      )}
    </div>
  );
}

export function RecalculateControl({ isLive, eventId, lastCalculatedAt, recalculating, onRecalculate }) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E4DFCE",
        borderRadius: 10,
        padding: 12,
        marginBottom: 14,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <div style={{ fontSize: 11.5, color: "#8A8371", lineHeight: 1.4 }}>
        {lastCalculatedAt ? (
          <>
            Last calculated
            <br />
            {formatCalculatedAt(lastCalculatedAt)}
          </>
        ) : (
          "Never calculated for this year"
        )}
      </div>
      <button
        onClick={onRecalculate}
        disabled={!isLive || !eventId || recalculating}
        style={{
          border: "none",
          background: "#1B4332",
          color: "#F3EFE2",
          borderRadius: 8,
          padding: "9px 16px",
          fontSize: 12.5,
          fontWeight: 600,
          cursor: !isLive || !eventId || recalculating ? "default" : "pointer",
          opacity: !isLive || !eventId || recalculating ? 0.6 : 1,
          fontFamily: "'Inter', sans-serif",
          whiteSpace: "nowrap",
        }}
      >
        {recalculating ? "Recalculating…" : "Recalculate"}
      </button>
    </div>
  );
}
