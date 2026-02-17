import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { getOrCreateConversation } from "../../utils/getOrCreateConversation";

export default function GamesHub() {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [sendGame, setSendGame] = useState(null);
  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.from("games").select("*");
      if (!alive) return;
      setGames(data ?? []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (alive) setUser(u ?? null);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!sendGame || !user?.id) return;
    setLoadingFriends(true);
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
        setLoadingFriends(false);
        return;
      }
      const { data: profs } = await supabase.from("profiles").select("id, username, display_name").in("id", otherIds);
      setFriends((profs || []).map((p) => ({ id: p.id, name: p.display_name || p.username || "Friend" })));
      setLoadingFriends(false);
    })();
    return () => { alive = false; };
  }, [sendGame, user?.id]);

  async function handleSendToFriend(friendId) {
    if (!sendGame || !user?.id || sending) return;
    setSending(true);
    try {
      const chatId = await getOrCreateConversation(user.id, friendId);
      const { data: session, error } = await supabase
        .from("game_sessions")
        .insert({
          game_id: sendGame.id,
          player_one: user.id,
          player_two: friendId,
          current_turn: user.id,
          state: { board: [null, null, null, null, null, null, null, null, null] },
          ...(chatId && { chat_id: chatId }),
        })
        .select()
        .single();
      if (error) throw error;
      setSendGame(null);
      if (session) navigate(`/games/session/${session.id}`);
    } catch (e) {
      console.error(e);
    }
    setSending(false);
  }

  const singlePlayer = games.filter((g) => (g.mode || "single") === "single");
  const multiplayer = games.filter((g) => g.mode === "multiplayer");

  function renderCard(game) {
    const isMulti = game.mode === "multiplayer";
    return (
      <div key={game.id} style={styles.cardWrap}>
        <button
          type="button"
          onClick={() => (!isMulti ? navigate(`/games/${game.id}`) : setSendGame(game))}
          style={styles.card}
        >
          <span style={styles.cardTitle}>{game.title}</span>
          {game.description && <p style={styles.cardDesc}>{game.description}</p>}
          {isMulti && <span style={styles.sendLabel}>Send To Friend</span>}
        </button>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <h1 style={styles.title}>Mini Games</h1>

      {loading ? (
        <p style={styles.hint}>Loading…</p>
      ) : (
        <>
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Recently Played</h2>
            <p style={styles.placeholder}>No recent games yet.</p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Single Player</h2>
            {singlePlayer.length === 0 ? (
              <p style={styles.hint}>No single player games yet.</p>
            ) : (
              <div style={styles.grid}>
                {singlePlayer.map(renderCard)}
              </div>
            )}
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Multiplayer</h2>
            {multiplayer.length === 0 ? (
              <p style={styles.hint}>No multiplayer games yet.</p>
            ) : (
              <div style={styles.grid}>
                {multiplayer.map(renderCard)}
              </div>
            )}
          </section>
        </>
      )}

      {sendGame && (
        <div style={styles.modalBackdrop} onClick={() => setSendGame(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Send {sendGame.title} to a friend</h3>
            {loadingFriends ? (
              <p style={styles.hint}>Loading friends…</p>
            ) : friends.length === 0 ? (
              <p style={styles.hint}>No friends yet.</p>
            ) : (
              <ul style={styles.friendList}>
                {friends.map((f) => (
                  <li key={f.id} style={styles.friendItem}>
                    <button
                      type="button"
                      onClick={() => handleSendToFriend(f.id)}
                      disabled={sending}
                      style={styles.friendBtn}
                    >
                      {f.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={() => setSendGame(null)} style={styles.cancelBtn}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: { padding: "16px 16px 90px", maxWidth: "560px", margin: "0 auto" },
  title: { fontSize: 22, fontWeight: 900, margin: "0 0 20px", color: "var(--text)" },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: 800, margin: "0 0 12px", color: "var(--text)" },
  placeholder: { color: "var(--text-dim)", fontSize: 14, margin: 0 },
  hint: { color: "var(--text-dim)", fontSize: 14, margin: 0 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 },
  cardWrap: {},
  card: {
    display: "block",
    width: "100%",
    textAlign: "left",
    background: "var(--card-2)",
    borderRadius: 14,
    border: "1px solid var(--border)",
    padding: 14,
    cursor: "pointer",
  },
  cardTitle: { color: "var(--text)", fontSize: 15, fontWeight: 800 },
  cardDesc: { margin: "8px 0 0", color: "var(--text-dim)", fontSize: 13, lineHeight: 1.35 },
  sendLabel: { display: "block", marginTop: 8, fontSize: 12, color: "var(--accent)", fontWeight: 700 },
  modalBackdrop: {
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
  modalTitle: { fontSize: 16, fontWeight: 800, margin: "0 0 16px", color: "var(--text)" },
  friendList: { listStyle: "none", margin: "0 0 16px", padding: 0 },
  friendItem: { marginBottom: 8 },
  friendBtn: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--card-2)",
    color: "var(--text)",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  cancelBtn: {
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
