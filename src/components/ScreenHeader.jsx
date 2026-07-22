import { ChevronLeft } from "lucide-react";

// The `ChevronLeft` + title header used at the top of ~20 screens/settings
// panels across AppShell.jsx. Two visual variants existed side by side:
//   - "large": the `bco-display` serif title used for full screens/menus.
//   - "compact": the smaller sans-serif title (optionally with a subtitle
//     line) used inside drilldowns like scorecards.
// Both are reproduced exactly here so swapping call sites is a pure move,
// not a visual change.
export function ScreenHeader({ title, subtitle, onBack, backLabel = "Back", variant = "large", marginBottom, right }) {
  const isCompact = variant === "compact";
  const mb = marginBottom ?? (isCompact ? 10 : 14);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: mb }}>
      <button
        onClick={onBack}
        style={{ border: "none", background: "none", cursor: "pointer", padding: 4, display: "flex", color: "#6B6455" }}
        aria-label={backLabel}
      >
        <ChevronLeft size={18} />
      </button>
      {isCompact ? (
        subtitle !== undefined ? (
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1B4332" }}>{title}</div>
            <div style={{ fontSize: 10.5, color: "#8A8371" }}>{subtitle}</div>
          </div>
        ) : (
          <span style={{ fontSize: 14, fontWeight: 600, color: "#1B4332" }}>{title}</span>
        )
      ) : (
        <span className="bco-display" style={{ fontSize: 19, fontWeight: 600, color: "#1B4332", ...(right !== undefined ? { flex: 1 } : null) }}>
          {title}
        </span>
      )}
      {right}
    </div>
  );
}

export default ScreenHeader;
