import React, { useState } from "react";
import { Flag, Trophy, MoreHorizontal, BookOpen, ChevronRight } from "lucide-react";
import { signOut } from "../lib/auth.js";
import { RecordBook } from "./RecordBook.jsx";
import { PlayersScreen } from "../admin/PlayersScreen.jsx";
import { CoursesScreen } from "../admin/CoursesScreen.jsx";
import { AdminSetupMenu, AdminResultsMenu } from "../admin/AdminMenus.jsx";
import { ImportResults } from "../admin/ImportResults.jsx";
import { ExportResults } from "../admin/ExportResults.jsx";
import { RolesSettings } from "../admin/settings/Roles.jsx";
import { YearSettings } from "../admin/settings/Year.jsx";
import { TeamSetupSettings } from "../admin/settings/TeamSetup.jsx";
import { RoundSetupSettings } from "../admin/settings/RoundSetup.jsx";
import { MatchupSetupSettings } from "../admin/settings/MatchupSetup.jsx";
import { GamesSetupSettings } from "../admin/settings/GamesSetup.jsx";
import { GamesResultsSettings } from "../admin/settings/GamesResults.jsx";
import { CompetitionSetupSettings } from "../admin/settings/CompetitionSetup.jsx";
import { CompetitionResultsSettings } from "../admin/settings/CompetitionResults.jsx";

// ---------------------------------------------------------------------------
// More tab — settings hub. Currently houses Record Book and Admin; other
// management screens will get added here as their own menu rows.
// ---------------------------------------------------------------------------
export function More({ currentYear, setCurrentYear, isLive, currentEventId, refreshRoundMap, myPlayer }) {
  const [view, setView] = useState("menu");
  // Not real security yet — that's what RLS (sql/26) is for. This just
  // keeps the menu honest about what a non-admin can actually do once RLS
  // is on. In demo/offline mode (no real accounts at all) everything stays
  // visible, same as before.
  const isAdmin = !isLive || myPlayer?.role === "admin";

  if (view === "recordbook") {
    return <RecordBook onBack={() => setView("menu")} isLive={isLive} myPlayer={myPlayer} />;
  }
  if (view === "players") {
    return <PlayersScreen onBack={() => setView("menu")} isLive={isLive} currentEventId={currentEventId} currentYear={currentYear} />;
  }
  if (view === "courses") {
    return <CoursesScreen onBack={() => setView("menu")} isLive={isLive} />;
  }
  if (view === "admin-setup") {
    return <AdminSetupMenu onBack={() => setView("menu")} onNavigate={setView} />;
  }
  if (view === "admin-results") {
    return <AdminResultsMenu onBack={() => setView("menu")} onNavigate={setView} />;
  }
  if (view === "admin-import") {
    return <ImportResults onBack={() => setView("admin-results")} isLive={isLive} />;
  }
  if (view === "admin-export") {
    return <ExportResults onBack={() => setView("admin-results")} isLive={isLive} currentEventId={currentEventId} />;
  }
  if (view === "admin-general") {
    return <YearSettings onBack={() => setView("admin-setup")} currentYear={currentYear} setCurrentYear={setCurrentYear} isLive={isLive} />;
  }
  if (view === "admin-roles") {
    return <RolesSettings onBack={() => setView("admin-setup")} isLive={isLive} />;
  }
  if (view === "admin-teams") {
    return <TeamSetupSettings onBack={() => setView("admin-setup")} isLive={isLive} currentYear={currentYear} />;
  }
  if (view === "admin-rounds") {
    return <RoundSetupSettings onBack={() => setView("admin-setup")} isLive={isLive} currentYear={currentYear} refreshRoundMap={refreshRoundMap} />;
  }
  if (view === "admin-matchups") {
    return <MatchupSetupSettings onBack={() => setView("admin-setup")} isLive={isLive} currentYear={currentYear} />;
  }
  if (view === "admin-games-setup") {
    return <GamesSetupSettings onBack={() => setView("admin-setup")} isLive={isLive} currentYear={currentYear} />;
  }
  if (view === "admin-games-results") {
    return <GamesResultsSettings onBack={() => setView("admin-results")} isLive={isLive} currentYear={currentYear} />;
  }
  if (view === "admin-competitions-setup") {
    return <CompetitionSetupSettings onBack={() => setView("admin-setup")} isLive={isLive} currentYear={currentYear} />;
  }
  if (view === "admin-competitions-results") {
    return <CompetitionResultsSettings onBack={() => setView("admin-results")} isLive={isLive} currentYear={currentYear} />;
  }

  const MENU_ITEMS = [
    { key: "recordbook", label: "Record Book", note: "All-time solo and team stats", icon: BookOpen, enabled: true },
    { key: "players", label: "Players", note: "Roster, bios, and handicap indexes", icon: Flag, enabled: true },
    { key: "courses", label: "Courses", note: "Course-tees and hole-by-hole data", icon: Trophy, enabled: true },
    { key: "admin-setup", label: "Admin Setup", note: "Roles, years, tournament, and money setup", icon: MoreHorizontal, enabled: isAdmin },
    { key: "admin-results", label: "Admin Results", note: "Computed payouts, plus import/export", icon: MoreHorizontal, enabled: isAdmin },
  ];

  return (
    <div style={{ padding: "18px 20px 24px" }}>
      <div className="bco-display" style={{ fontSize: 20, fontWeight: 600, color: "#1B4332", marginBottom: 14 }}>
        More
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => item.enabled && setView(item.key)}
              disabled={!item.enabled}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                textAlign: "left",
                background: "#FFFFFF",
                border: "1px solid #E4DFCE",
                borderRadius: 12,
                padding: "13px 14px",
                cursor: item.enabled ? "pointer" : "default",
                opacity: item.enabled ? 1 : 0.45,
                fontFamily: "'Inter', sans-serif",
              }}
            >
              <Icon size={18} strokeWidth={1.8} color="#1B4332" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "#2C2A22" }}>{item.label}</div>
                <div style={{ fontSize: 11, color: "#8A8371", marginTop: 1 }}>
                  {item.enabled ? item.note : item.key.startsWith("admin") ? "Organizer only" : `${item.note} — coming soon`}
                </div>
              </div>
              {item.enabled && <ChevronRight size={16} color="#B9B3A2" />}
            </button>
          );
        })}
      </div>

      {isLive && (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid #E4DFCE" }}>
          <div style={{ fontSize: 11.5, color: "#8A8371", marginBottom: 8 }}>
            {myPlayer ? `Signed in as ${myPlayer.name}` : "Signed in"}
          </div>
          <button
            onClick={() => signOut().then(() => window.location.reload())}
            style={{
              border: "1px solid #DCD6C4",
              background: "#FFFFFF",
              color: "#6B6455",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
