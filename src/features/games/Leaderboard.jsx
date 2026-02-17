import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../supabaseClient";

export default function Leaderboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get("game_id");
  const [game, setGame] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const lowerIsBetter = game?.game_type === "reaction_test" || game?.game_type === "reaction_speed";

  function fetchLeaderboard() {
    if (!gameId) return;
    const order = lowerIsBetter ? { ascending: true } : { ascending: false };
    supabase
      .from("game_leaderboard")
      .select("id, user_id, score, created_at, profiles(username, display_name)")
      .eq("game_id", gameId)
      .order("score", order)
      .limit(100)
      .then(({ data }) => setEntries(data || []));
  }

  useEffect(() => {
    if (!gameId) {
      setLoading(false);
      return;
    }
    let alive = true;
    supabase.from("games").select("*").eq("id", gameId).single().then(({ data }) => {
      if (alive) setGame(data || null);
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;
    fetchLeaderboard();
  }, [gameId, game?.game_type]);

  useEffect(() => {
    if (!gameId) return;
    const channel = supabase
      .channel(`leaderboard-${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_leaderboard", filter: `game_id=eq.${gameId}` },
        () => fetchLeaderboard()
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [gameId]);

  if (!gameId) {
    return (
      <div style={styles.wrap}>
        <button type="button" onClick={() => navigate("/games")} style={styles.backBtn}>← Games</button>
        <p style={styles.hint}>Select a game from the hub to view leaderboard.</p>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <button type="button" onClick={() => navigate("/games")} style={styles.backBtn}>
        ← Games
      </button>
      <h2 style={styles.title}>Leaderboard</h2>
      {game && <p style={styles.subtitle}>{game.title}</p>}

      {loading ? (
        <p style={styles.hint}>Loading…</p>
      ) : (
        <ul style={styles.list}>
          {entries.map((e, i) => (
            <li key={e.id} style={styles.row}>
              <span style={styles.rank}>{i + 1}</span>
              <span style={styles.name}>{e.profiles?.display_name || e.profiles?.username || "Player"}</span>
              <span style={styles.score}>
                {lowerIsBetter ? `${Number(e.score)} ms` : Number(e.score)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!loading && entries.length === 0 && <p style={styles.hint}>No scores yet.</p>}
    </div>
  );
}

const styles = {
  wrap: { padding: "16px 16px 90px", maxWidth: "480px", margin: "0 auto" },
  backBtn: {
    marginBottom: 16,
    padding: "8px 0",
    background: "none",
    border: "none",
    color: "var(--text-dim)",
    fontSize: 14,
    cursor: "pointer",
  },
  title: { fontSize: 20, fontWeight: 800, margin: "0 0 4px", color: "var(--text)" },
  subtitle: { fontSize: 14, color: "var(--text-dim)", margin: "0 0 16px" },
  hint: { color: "var(--text-dim)", fontSize: 14, margin: 0 },
  list: { listStyle: "none", margin: 0, padding: 0 },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    background: "var(--card-2)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    marginBottom: 8,
  },
  rank: { width: 28, fontWeight: 800, color: "var(--accent)" },
  name: { flex: 1, color: "var(--text)", fontWeight: 600 },
  score: { color: "var(--text-dim)", fontWeight: 700 },
};
