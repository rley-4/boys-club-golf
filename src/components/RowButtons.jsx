// Small "editable list" chrome shared by the admin setup screens (Team,
// Round, Matchup, Games setups): an "x" to remove a row, and a dashed
// "+ add" button to append one.

export function RemoveButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Remove"
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        border: "none",
        background: "none",
        color: "#B4AE9E",
        cursor: "pointer",
        fontSize: 16,
        lineHeight: 1,
        padding: 4,
      }}
    >
      ×
    </button>
  );
}

export function AddRowButton({ label, onClick, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        border: "1px dashed #C9C2AC",
        background: "#FFFFFF",
        color: "#1B4332",
        borderRadius: 10,
        padding: "9px 0",
        fontSize: 12.5,
        fontWeight: 600,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {label}
    </button>
  );
}
