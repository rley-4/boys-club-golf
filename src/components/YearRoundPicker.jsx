import { Pill } from "./Pill.jsx";

export function YearPill({ label, active, onClick }) {
  return (
    <Pill
      as="button"
      onClick={onClick}
      bg={active ? "#1B4332" : "#FFFFFF"}
      fg={active ? "#F3EFE2" : "#6B6455"}
      border={`1px solid ${active ? "#1B4332" : "#E4DFCE"}`}
      fontSize={12}
      padding="6px 13px"
      style={{ flexShrink: 0, fontFamily: "'Inter', sans-serif", cursor: "pointer" }}
    >
      {label}
    </Pill>
  );
}

export function YearRoundPicker({ years, selectedYear, setSelectedYear }) {
  if (years.length <= 1) return null;
  return (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 12 }}>
      {years.map((y) => (
        <YearPill key={y} label={String(y)} active={selectedYear === y} onClick={() => setSelectedYear(y)} />
      ))}
    </div>
  );
}

export function RoundPicker({ rounds, selectedRound, setSelectedRound }) {
  if (rounds.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 10 }}>
      {rounds.map((r) => (
        <YearPill key={r} label={r} active={selectedRound === r} onClick={() => setSelectedRound(r)} />
      ))}
    </div>
  );
}
