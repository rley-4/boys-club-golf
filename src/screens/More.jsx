import React from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { Flag, Trophy, MoreHorizontal, BookOpen, ChevronRight } from "lucide-react";
import { signOut } from "../lib/auth.js";
import { RecordBook } from "./RecordBook.jsx";
import { PlayersScreen } from "./admin/PlayersScreen.jsx";
import { CoursesScreen } from "./admin/CoursesScreen.jsx";

// ---------------------------------------------------------------------------
// More tab — settings hub. Currently houses Record Book and Admin; other
// management screens will get added here as their own menu rows.
//
// Everything under here is a real nested route (/more, /more/record-book,
// etc.) rather than local view-state, so refreshing the page — or
// sharing/bookmarking a link — lands back on the exact same screen. Admin
// is reached from this menu but lives under its own top-level /admin/*
// route tree (see admin/AdminRoutes.jsx), not nested under /more.
// ---------------------------------------------------------------------------
export function More({ currentYear, isLive, currentEventId, myPlayer, isAdmin }) {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route index element={<MoreMenu isAdmin={isAdmin} isLive={isLive} myPlayer={myPlayer} />} />
      <Route path="record-book" element={<RecordBook onBack={() => navigate("/more")} isLive={isLive} myPlayer={myPlayer} />} />
      <Route
        path="players"
        element={<PlayersScreen onBack={() => navigate("/more")} isLive={isLive} currentEventId={currentEventId} currentYear={currentYear} />}
      />
      <Route path="courses" element={<CoursesScreen onBack={() => navigate("/more")} isLive={isLive} />} />
      <Route path="*" element={<Navigate to="/more" replace />} />
    </Routes>
  );
}

function MoreMenu({ isAdmin, isLive, myPlayer }) {
  const navigate = useNavigate();

  const MENU_ITEMS = [
    { key: "record-book", label: "Record Book", note: "All-time solo and team stats", icon: BookOpen, enabled: true },
    { key: "players", label: "Players", note: "Roster, bios, and handicap indexes", icon: Flag, enabled: true },
    { key: "courses", label: "Courses", note: "Course-tees and hole-by-hole data", icon: Trophy, enabled: true },
    { key: "/admin/setup", label: "Admin Setup", note: "Roles, years, tournament, and money setup", icon: MoreHorizontal, enabled: isAdmin },
    { key: "/admin/results", label: "Admin Results", note: "Computed payouts, plus import/export", icon: MoreHorizontal, enabled: isAdmin },
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
              onClick={() => item.enabled && navigate(item.key)}
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
                  {item.enabled ? item.note : item.key.startsWith("/admin") ? "Organizer only" : `${item.note} — coming soon`}
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
