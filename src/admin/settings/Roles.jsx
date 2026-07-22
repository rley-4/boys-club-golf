import { useState, useEffect } from "react";
import { fetchPlayerRoles, updatePlayerRole } from "../../lib/api.js";
import { ScreenHeader } from "../../components/ScreenHeader.jsx";
import { SettingsSection } from "../../components/SettingsSection.jsx";
import { Banner } from "../../components/Banner.jsx";

const ROLE_INFO = {
  admin: {
    label: "Admin",
    description: "Create, edit, and remove anything — all admin screens, all data.",
    bg: "#F3EFE2",
    fg: "#1B4332",
  },
  player: {
    label: "Player",
    description: "Create and edit only their own scores. Read access to everything else, same as anyone signed in.",
    bg: "#DCEFE3",
    fg: "#1B4332",
  },
  viewer: {
    label: "Viewer",
    description: "Read-only, everywhere — no create or edit access, not even to their own scores. No access to Admin.",
    bg: "#EFEBDE",
    fg: "#6B6455",
  },
};

function RolesSettings({ onBack, isLive }) {
  const [players, setPlayers] = useState([]);
  const [liveLoading, setLiveLoading] = useState(isLive);
  const [liveError, setLiveError] = useState(null);
  const [savingId, setSavingId] = useState(null); // playerId currently being saved, or null

  useEffect(() => {
    if (!isLive) {
      setLiveLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchPlayerRoles();
        if (cancelled) return;
        setPlayers(rows);
      } catch (err) {
        console.error("Failed to load roles:", err);
        setLiveError(err.message || String(err));
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLive]);

  const handleRoleChange = async (playerId, role) => {
    const previous = players.find((p) => p.id === playerId)?.role;
    setPlayers((prev) => prev.map((p) => (p.id === playerId ? { ...p, role } : p)));
    if (!isLive) return;
    setSavingId(playerId);
    try {
      await updatePlayerRole(playerId, role);
    } catch (err) {
      console.error("Failed to update role:", err);
      setPlayers((prev) => prev.map((p) => (p.id === playerId ? { ...p, role: previous } : p)));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div style={{ padding: "14px 20px 24px" }}>
      <ScreenHeader title="Roles" onBack={onBack} backLabel="Back to Admin" />

      <SettingsSection title="What each role can do">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Object.entries(ROLE_INFO).map(([key, r]) => (
            <div key={key} style={{ background: r.bg, borderRadius: 10, padding: "11px 13px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: r.fg, marginBottom: 3 }}>{r.label}</div>
              <div style={{ fontSize: 11.5, color: r.fg, opacity: 0.85, lineHeight: 1.5 }}>{r.description}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: "#B4AE9E", marginTop: 8, lineHeight: 1.5 }}>
          These three are fixed — there's no arbitrary "create a new role" here, since what a role can do is enforced
          by real database rules, not just app settings.
        </div>
      </SettingsSection>

      {isLive && liveError && (
        <div style={{ marginBottom: 14 }}>
          <Banner tone="error">Couldn't load live roles ({liveError}) — showing local demo data instead.</Banner>
        </div>
      )}
      {isLive && liveLoading && <div style={{ fontSize: 12, color: "#8A8371", marginBottom: 14 }}>Loading…</div>}

      {!liveLoading && (
        <SettingsSection title="Assign roles" description="One role per player. Defaults to Player — switch someone to Viewer if they're not competing this year, or Admin if they help run things.">
          {!isLive ? (
            <div style={{ fontSize: 11.5, color: "#B4AE9E" }}>Connect to Supabase to assign roles.</div>
          ) : players.length === 0 ? (
            <div style={{ fontSize: 11.5, color: "#B4AE9E" }}>No players on the roster yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {players.map((p) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#FFFFFF", border: "1px solid #E4DFCE", borderRadius: 10, padding: "9px 12px" }}>
                  <span style={{ fontSize: 13, color: "#2C2A22" }}>{p.name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {savingId === p.id && <span style={{ fontSize: 10, color: "#8A8371" }}>Saving…</span>}
                    <select
                      value={p.role || "player"}
                      onChange={(e) => handleRoleChange(p.id, e.target.value)}
                      style={{
                        border: "1px solid #DCD6C4",
                        borderRadius: 8,
                        padding: "6px 10px",
                        fontSize: 12.5,
                        fontFamily: "'Inter', sans-serif",
                        background: "#FFFFFF",
                        color: "#2C2A22",
                      }}
                    >
                      <option value="admin">Admin</option>
                      <option value="player">Player</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SettingsSection>
      )}
    </div>
  );
}

export default RolesSettings;
export { RolesSettings };
