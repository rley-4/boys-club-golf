import { useState, useEffect, useRef } from "react";
import { fetchMessages, sendMessage, deleteMessage } from "../lib/api.js";
import { PLAYERS } from "../data/dummyData.js";
import { Banner } from "../components/Banner.jsx";

// ---------------------------------------------------------------------------
// Messages — simple group chat. One shared room, everyone signed in can
// read, admin/player roles can send (see sql/39_messages.sql). Polls
// rather than using a realtime subscription — good enough for v1, simple
// to reason about; worth upgrading to Supabase Realtime later if the
// polling delay ever actually bothers people.
// ---------------------------------------------------------------------------
export function MessagesScreen({ isLive, myPlayer }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(isLive);
  const [error, setError] = useState(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const wasAtBottomRef = useRef(true);

  const load = async () => {
    try {
      const rows = await fetchMessages();
      setMessages(rows);
      setError(null);
    } catch (err) {
      console.error("Failed to load messages:", err);
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLive) {
      setLoading(false);
      return;
    }
    load();
    // Refetch when the tab/window regains focus, instead of polling on a
    // timer — event-driven, so someone leaving this screen open in the
    // background generates zero ongoing load, rather than a query every
    // few seconds indefinitely. A stale chat for a few minutes while
    // someone's looking at another app is a fine tradeoff for not
    // hammering the database around the clock.
    const onFocus = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    // Only auto-scroll if the person was already near the bottom — if
    // they've scrolled up to read history, a new message (or a poll tick)
    // shouldn't yank them back down.
    if (wasAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const canSend = isLive && myPlayer && (myPlayer.role === "admin" || myPlayer.role === "player");

  const handleSend = async () => {
    const trimmed = body.trim();
    if (!trimmed || !canSend || sending) return;
    setSending(true);
    try {
      await sendMessage(myPlayer.id, trimmed);
      setBody("");
      wasAtBottomRef.current = true;
      await load();
    } catch (err) {
      console.error("Failed to send message:", err);
      setError(err.message || String(err));
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      setMessages((prev) => prev.filter((m) => m.id !== id));
      await deleteMessage(id);
    } catch (err) {
      console.error("Failed to delete message:", err);
      load(); // put it back if the delete didn't actually go through
    }
  };

  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  };

  if (!isLive) {
    return (
      <div style={{ padding: "24px 20px", textAlign: "center" }}>
        <div className="bco-display" style={{ fontSize: 19, fontWeight: 600, color: "#1B4332", marginBottom: 10 }}>
          Messages
        </div>
        <div style={{ fontSize: 12.5, color: "#B4AE9E" }}>Connect to Supabase to use the group chat.</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "14px 20px 10px", borderBottom: "1px solid #E4DFCE", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="bco-display" style={{ fontSize: 19, fontWeight: 600, color: "#1B4332" }}>
          Messages
        </div>
        <button
          onClick={load}
          aria-label="Refresh messages"
          style={{ border: "1px solid #DCD6C4", background: "#FFFFFF", color: "#6B6455", borderRadius: 8, padding: "5px 10px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ padding: "8px 20px 0" }}>
          <Banner tone="error">Couldn't load messages ({error}).</Banner>
        </div>
      )}

      <div ref={listRef} onScroll={handleScroll} style={{ flex: 1, overflowY: "auto", padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          <div style={{ fontSize: 12, color: "#8A8371", textAlign: "center", padding: "24px 0" }}>Loading…</div>
        ) : messages.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "#B4AE9E", textAlign: "center", padding: "24px 0" }}>No messages yet — be the first to say something.</div>
        ) : (
          messages.map((m) => {
            const sender = PLAYERS.find((p) => p.id === m.player_id);
            const isMine = myPlayer && m.player_id === myPlayer.id;
            const canDelete = myPlayer && (isMine || myPlayer.role === "admin");
            return (
              <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start" }}>
                {!isMine && (
                  <div style={{ fontSize: 10.5, fontWeight: 600, color: "#8A8371", marginBottom: 2, marginLeft: 2 }}>{sender?.name || "Unknown"}</div>
                )}
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6, maxWidth: "80%" }}>
                  {isMine && canDelete && (
                    <button
                      onClick={() => handleDelete(m.id)}
                      aria-label="Delete message"
                      style={{ border: "none", background: "none", color: "#C9C2AC", cursor: "pointer", fontSize: 13, padding: 2, flexShrink: 0 }}
                    >
                      ×
                    </button>
                  )}
                  <div
                    style={{
                      background: isMine ? "#DCEFE3" : "#FFFFFF",
                      border: isMine ? "none" : "1px solid #E4DFCE",
                      color: "#2C2A22",
                      borderRadius: 14,
                      padding: "8px 12px",
                      fontSize: 13.5,
                      lineHeight: 1.4,
                      wordBreak: "break-word",
                    }}
                  >
                    {m.body}
                  </div>
                </div>
                <div style={{ fontSize: 9.5, color: "#B4AE9E", marginTop: 2, marginRight: isMine ? 2 : 0, marginLeft: isMine ? 0 : 2 }}>{formatTime(m.created_at)}</div>
              </div>
            );
          })
        )}
      </div>

      <div style={{ borderTop: "1px solid #E4DFCE", padding: "10px 20px", flexShrink: 0 }}>
        {!canSend ? (
          <div style={{ fontSize: 11.5, color: "#B4AE9E", textAlign: "center", padding: "8px 0" }}>
            {myPlayer?.role === "viewer" ? "Viewer access — read-only." : "Sign in with a linked player account to send messages."}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Message the group…"
              maxLength={2000}
              style={{ flex: 1, border: "1px solid #DCD6C4", borderRadius: 20, padding: "10px 16px", fontSize: 13.5, fontFamily: "'Inter', sans-serif" }}
            />
            <button
              onClick={handleSend}
              disabled={!body.trim() || sending}
              style={{
                border: "none",
                borderRadius: 20,
                padding: "10px 18px",
                fontSize: 13.5,
                fontWeight: 600,
                fontFamily: "'Inter', sans-serif",
                background: body.trim() ? "#1B4332" : "#DCD6C4",
                color: "#F3EFE2",
                cursor: body.trim() ? "pointer" : "default",
                whiteSpace: "nowrap",
              }}
            >
              {sending ? "…" : "Send"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default MessagesScreen;
