// Shared "label over mono value" stat tile behind `StatBlock`, `TotalStat`,
// `StrokeBubble`, and `HcpBubble` in AppShell.jsx. Each of those kept enough
// visual differences (background, border, text-align, sizes) that they're
// reproduced here as variants rather than forced into one generic shape —
// this only collapses the *duplication*, not the intentional differences.
export function StatTile({ variant = "block", label, value, sub, unavailable, emphasize }) {
  if (variant === "stroke") {
    const getsStroke = value === 1;
    return (
      <div
        style={{
          background: getsStroke ? "#DCEFE3" : "#F3EFE2",
          border: `1px solid ${getsStroke ? "#B7DCC6" : "#E4DFCE"}`,
          borderRadius: 8,
          padding: "7px 8px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 9.5, fontWeight: 600, color: "#8A8371", letterSpacing: "0.03em" }}>{label.toUpperCase()}</div>
        <div className="bco-mono" style={{ fontSize: 14, fontWeight: 600, color: getsStroke ? "#1B4332" : "#6B6455", marginTop: 1 }}>
          {unavailable ? "–" : value}
        </div>
      </div>
    );
  }

  if (variant === "hcp") {
    return (
      <div style={{ background: "rgba(255,255,255,0.10)", borderRadius: 8, padding: "6px 4px", textAlign: "center" }}>
        <div style={{ fontSize: 9.5, fontWeight: 600, opacity: 0.75, letterSpacing: "0.03em" }}>{label}</div>
        <div className="bco-mono" style={{ fontSize: 15, fontWeight: 600, marginTop: 1 }}>
          {value}
        </div>
      </div>
    );
  }

  if (variant === "total") {
    return (
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#8A8371", letterSpacing: "0.03em" }}>{label}</div>
        <div className="bco-mono" style={{ fontSize: emphasize ? 24 : 20, fontWeight: 600, color: "#1B4332", marginTop: 2 }}>
          {value}
        </div>
        <div style={{ fontSize: 10, color: "#A39C89" }}>{sub}</div>
      </div>
    );
  }

  // "block" (default)
  return (
    <div style={{ background: "#F3EFE2", borderRadius: 8, padding: "7px 9px" }}>
      <div style={{ fontSize: 9.5, fontWeight: 600, color: "#8A8371", letterSpacing: "0.02em" }}>{label.toUpperCase()}</div>
      <div className="bco-mono" style={{ fontSize: 14, fontWeight: 600, color: "#2C2A22", marginTop: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 9.5, color: "#A39C89" }}>{sub}</div>}
    </div>
  );
}

export default StatTile;
