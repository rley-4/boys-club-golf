import React from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, Coins, Swords, User, Calendar, Users, Import, Upload } from "lucide-react";
import { ScreenHeader } from "../../components/ScreenHeader.jsx";

// ---------------------------------------------------------------------------
// Admin menu — Import/Export, Event settings, and Game settings are real.
// ---------------------------------------------------------------------------
// lucide-react has no golf-specific icon — this matches its stroke style
// (24x24, round caps/joins) closely enough to sit next to the real ones.
function GolfClubIcon({ size = 18, strokeWidth = 1.8, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 3 L8 18" />
      <path d="M8 18 L12.5 20 L10.5 15.3 Z" />
      <circle cx="5.5" cy="20.5" r="1.4" fill={color} stroke="none" />
    </svg>
  );
}

function AdminIconButton({ label, icon: Icon, onClick, enabled = true }) {
  return (
    <button
      onClick={() => enabled && onClick()}
      disabled={!enabled}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        width: 82,
        padding: "12px 6px",
        background: "#FFFFFF",
        border: "1px solid #E4DFCE",
        borderRadius: 12,
        cursor: enabled ? "pointer" : "default",
        opacity: enabled ? 1 : 0.45,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 10, background: "#DCEFE3", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={19} strokeWidth={1.8} color="#1B4332" />
      </div>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "#2C2A22", textAlign: "center", lineHeight: 1.25 }}>{label}</div>
    </button>
  );
}

function AdminIconRow({ title, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: "#8A8371", letterSpacing: "0.04em", marginBottom: 10, textTransform: "uppercase" }}>{title}</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

// Data-driven menu config — each Admin menu is just a list of titled rows
// of {label, icon, target} shown via `AdminIconRow`/`AdminIconButton`.
// Adding a new admin screen means adding one row here, not new markup.
const ADMIN_SETUP_SECTIONS = [
  {
    title: "General setup",
    items: [
      { label: "Roles", icon: User, target: "/admin/setup/roles" },
      { label: "Years", icon: Calendar, target: "/admin/setup/years" },
    ],
  },
  {
    title: "Tournament setup",
    items: [
      { label: "Round setup", icon: GolfClubIcon, target: "/admin/setup/rounds" },
      { label: "Team setup", icon: Users, target: "/admin/setup/teams" },
      { label: "Matchup setup", icon: Swords, target: "/admin/setup/matchups" },
    ],
  },
  {
    title: "Money setup",
    items: [
      { label: "Competition setup", icon: Trophy, target: "/admin/setup/competitions" },
      { label: "Games setup", icon: Coins, target: "/admin/setup/games" },
    ],
  },
];

const ADMIN_RESULTS_SECTIONS = [
  {
    title: "Results data",
    items: [
      { label: "Competition results", icon: Trophy, target: "/admin/results/competitions" },
      { label: "Games results", icon: Coins, target: "/admin/results/games" },
    ],
  },
  {
    title: "Bulk data",
    items: [
      { label: "Import", icon: Import, target: "/admin/results/import" },
      { label: "Export", icon: Upload, target: "/admin/results/export" },
    ],
  },
];

function AdminMenu({ title, sections, onBack }) {
  const navigate = useNavigate();
  return (
    <div style={{ padding: "14px 20px 24px" }}>
      <ScreenHeader title={title} onBack={onBack} backLabel="Back to More" marginBottom={18} />

      {sections.map((section) => (
        <AdminIconRow key={section.title} title={section.title}>
          {section.items.map((item) => (
            <AdminIconButton key={item.label} label={item.label} icon={item.icon} onClick={() => navigate(item.target)} />
          ))}
        </AdminIconRow>
      ))}
    </div>
  );
}

export function AdminSetupMenu({ onBack }) {
  return <AdminMenu title="Admin setup" sections={ADMIN_SETUP_SECTIONS} onBack={onBack} />;
}

export function AdminResultsMenu({ onBack }) {
  return <AdminMenu title="Admin results" sections={ADMIN_RESULTS_SECTIONS} onBack={onBack} />;
}
