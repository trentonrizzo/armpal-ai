import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { getOrCreateConversation } from "../../utils/getOrCreateConversation";

/**
 * GamePigeon-style share: pick a friend, create game_session, optionally open session.
 * Reuses same friend-loading logic as ShareWorkoutsModal.
 */
export default function MiniGameShareOverlay({ open, onClose, game, onSent }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let alive = true;
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (alive) setUser(u ?? null);
    });
    return () => { alive = false; };
  }, [open]);

  useEffect(() => {
    if (!open || !user?.id) return;
    setLoading(true);
    setError("");
    let alive = true;
    (async () => {
      const { data: frRows } = await supabase
        .from("friends")
        .select("user_id, friend_id, status")
        .eq("status", "accepted")
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);
      if (!alive) return;
      const otherIds = [...new Set((frRows || []).map((r) => (r.user_id === user.id ? r.friend_id : r.user_id)))];
      if (otherIds.length === 0) {
        setFriends([]);
        setLoading(false);
        return;
      }
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", otherIds);
      setFriends((profs || []).map((p) => ({ id: p.id, name: p.display_name || p.username || "Friend" })));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [open, user?.id]);

  async function handleSelectFriend(friendId) {
    if (!game || !user?.id || sending) return;
    setSending(true);
    setError("");
    try {
      const chatId = await getOrCreateConversation(user.id, friendId);
      const state = {
        board: [null, null, null, null, null, null, null, null, null],
        turn: "player_one",
        winner: null,
        score: { player_one: 0, player_two: 0 },
      };
      const { data: session, error: err } = await supabase
        .from("game_sessions")
        .insert({
          game_id: game.id,
          player_one: user.id,
          player_two: friendId,
          current_turn: friendId,
          state,
          status: "pending",
          ...(chatId && { chat_id: chatId }),
        })
        .select()
        .single();
      if (err) throw err;
      const payload = JSON.stringify({
        type: "game_session",
        session_id: session?.id,
        game_title: game?.title || "Game",
      });
      await supabase.from("messages").insert({
        sender_id: user.id,
        receiver_id: friendId,
        text: payload,
      });
      onSent?.(session);
      onClose?.();
      if (session) navigate(`/games/session/${session.id}`);
    } catch (e) {
      setError(e?.message || "Failed to start game");
    }
    setSending(false);
  }

  if (!open) return null;

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={styles.title}>
          Send {game?.title ?? "Game"} to a friend
        </h3>
        {error ? <p style={styles.error}>{error}</p> : null}
        {loading ? (
          <p style={styles.hint}>Loading friends…</p>
        ) : friends.length === 0 ? (
          <p style={styles.hint}>No friends yet. Add friends to play together.</p>
        ) : (
          <ul style={styles.list}>
            {friends.map((f) => (
              <li key={f.id} style={styles.item}>
                <button
                  type="button"
                  onClick={() => handleSelectFriend(f.id)}
                  disabled={sending}
                  style={styles.friendBtn}
                >
                  {f.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={onClose} style={styles.cancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    zIndex: 10000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modal: {
    width: "100%",
    maxWidth: 320,
    background: "var(--card)",
    borderRadius: 16,
    padding: 20,
    border: "1px solid var(--border)",
  },
  title: {
    fontSize: 18,
    fontWeight: 800,
    margin: "0 0 16px",
    color: "var(--text)",
  },
  error: { color: "var(--accent)", fontSize: 13, margin: "0 0 12px" },
  hint: { color: "var(--text-dim)", fontSize: 14, margin: 0 },
  list: { listStyle: "none", margin: "0 0 16px", padding: 0 },
  item: { marginBottom: 8 },
  friendBtn: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--card-2)",
    color: "var(--text)",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  cancel: {
    width: "100%",
    padding: "10px",
    borderRadius: 10,
    border: "none",
    background: "transparent",
    color: "var(--text-dim)",
    fontSize: 14,
    cursor: "pointer",
  },
};
