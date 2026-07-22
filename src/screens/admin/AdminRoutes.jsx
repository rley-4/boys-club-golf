import React from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AdminSetupMenu, AdminResultsMenu } from "./AdminMenus.jsx";
import { ImportResults } from "./ImportResults.jsx";
import { ExportResults } from "./ExportResults.jsx";
import { RolesSettings } from "./settings/Roles.jsx";
import { YearSettings } from "./settings/Year.jsx";
import { TeamSetupSettings } from "./settings/TeamSetup.jsx";
import { RoundSetupSettings } from "./settings/RoundSetup.jsx";
import { MatchupSetupSettings } from "./settings/MatchupSetup.jsx";
import { GamesSetupSettings } from "./settings/GamesSetup.jsx";
import { GamesResultsSettings } from "./settings/GamesResults.jsx";
import { CompetitionSetupSettings } from "./settings/CompetitionSetup.jsx";
import { CompetitionResultsSettings } from "./settings/CompetitionResults.jsx";

// ---------------------------------------------------------------------------
// Routes mounted at /admin/* — Admin Setup and Admin Results, plus every
// screen nested under each. Reached from the More menu, but lives as its
// own top-level route tree rather than nested under /more. `isAdmin` gates
// the whole subtree the same way the More menu hides these rows: not real
// security (that's RLS, sql/26), just keeping direct URL access consistent
// with what the menu shows. "Back" from the top of either menu returns to
// /more, since that's conceptually where Admin was launched from.
// ---------------------------------------------------------------------------
export function AdminRoutes({ isAdmin, currentYear, setCurrentYear, isLive, currentEventId, refreshRoundMap }) {
  const navigate = useNavigate();

  if (!isAdmin) {
    return <Navigate to="/more" replace />;
  }

  return (
    <Routes>
      <Route path="setup" element={<AdminSetupMenu onBack={() => navigate("/more")} />} />
      <Route path="setup/roles" element={<RolesSettings onBack={() => navigate("/admin/setup")} isLive={isLive} />} />
      <Route
        path="setup/years"
        element={<YearSettings onBack={() => navigate("/admin/setup")} currentYear={currentYear} setCurrentYear={setCurrentYear} isLive={isLive} />}
      />
      <Route
        path="setup/rounds"
        element={<RoundSetupSettings onBack={() => navigate("/admin/setup")} isLive={isLive} currentYear={currentYear} refreshRoundMap={refreshRoundMap} />}
      />
      <Route path="setup/teams" element={<TeamSetupSettings onBack={() => navigate("/admin/setup")} isLive={isLive} currentYear={currentYear} />} />
      <Route
        path="setup/matchups"
        element={<MatchupSetupSettings onBack={() => navigate("/admin/setup")} isLive={isLive} currentYear={currentYear} />}
      />
      <Route
        path="setup/competitions"
        element={<CompetitionSetupSettings onBack={() => navigate("/admin/setup")} isLive={isLive} currentYear={currentYear} />}
      />
      <Route path="setup/games" element={<GamesSetupSettings onBack={() => navigate("/admin/setup")} isLive={isLive} currentYear={currentYear} />} />

      <Route path="results" element={<AdminResultsMenu onBack={() => navigate("/more")} />} />
      <Route
        path="results/competitions"
        element={<CompetitionResultsSettings onBack={() => navigate("/admin/results")} isLive={isLive} currentYear={currentYear} />}
      />
      <Route
        path="results/games"
        element={<GamesResultsSettings onBack={() => navigate("/admin/results")} isLive={isLive} currentYear={currentYear} />}
      />
      <Route path="results/import" element={<ImportResults onBack={() => navigate("/admin/results")} isLive={isLive} />} />
      <Route
        path="results/export"
        element={<ExportResults onBack={() => navigate("/admin/results")} isLive={isLive} currentEventId={currentEventId} />}
      />

      <Route path="*" element={<Navigate to="setup" replace />} />
    </Routes>
  );
}
