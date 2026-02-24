import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../supabaseClient";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isUuid(value) {
  return typeof value === "string" && UUID_REGEX.test(value);
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const gameIdParam = searchParams.get("game_id");
  const gameTypeParam = searchParams.get("game_type");
  const [game, setGame] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const key = gameIdParam || gameTypeParam;
    if (!key) {
      setLoading(false);
      setGame(null);
      return;
    }
    let alive = true;
    const promise = isUuid(gameIdParam)
      ? supabase.from("games").select("*").eq("id", gameIdParam).single()
      : supabase.from("games").select("*").eq("game_type", gameTypeParam || gameIdParam).maybeSingle();
    promise.then(({ data }) => {
      if (alive) setGame(data || null);
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, [gameIdParam, gameTypeParam]);

  const resolvedGameId = game?.id ?? null;
  const isFlappyArm = game?.game_type === "flappy_arm";
  const lowerIsBetter = game?.game_type === "reaction_test" || game?.game_type === "reaction_speed";

  const fetchLeaderboard = useCallback(async () => {
    if (isFlappyArm) {
      const { data: rows, error } = await supabase
        .from("arcade_flappy_arm_leaderboard")
        .select("user_id, best_score, total_games")
        .order("best_score", { ascending: false })
        .limit(50);
      if (error) {
        console.error("Leaderboard fetch error:", error);
        setEntries([]);
        return;
      }
      const list = rows || [];
      const userIds = [...new Set(list.map((r) => r.user_id).filter(Boolean))];
      let profileMap = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, username, handle")
          .in("id", userIds);
        (profiles || []).forEach((p) => (profileMap[p.id] = p));
      }
      setEntries(
        list.map((r) => ({
          user_id: r.user_id,
          score: r.best_score,
          achieved_at: null,
          profiles: profileMap[r.user_id] || null,
        }))
      );
      return;
    }
    if (!resolvedGameId) return;
    const order = lowerIsBetter ? { ascending: true } : { ascending: false };
    const { data, error } = await supabase
      .from("game_leaderboard")
      .select(`
        id,
        user_id,
        score,
        created_at,
        profiles(display_name, username)
      `)
      .eq("game_id", resolvedGameId)
      .order("score", order)
      .limit(100);
    if (error) console.error("Leaderboard fetch error:", error);
    setEntries(data ?? []);
  }, [resolvedGameId, lowerIsBetter, isFlappyArm]);

  useEffect(() => {
    if (isFlappyArm || resolvedGameId) fetchLeaderboard();
  }, [resolvedGameId, isFlappyArm, fetchLeaderboard]);

  useEffect(() => {
    if (!isFlappyArm && !resolvedGameId) return;
    const channelName = isFlappyArm ? "leaderboard-flappy" : `leaderboard-${resolvedGameId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: isFlappyArm ? "arcade_flappy_arm_scores" : "game_leaderboard" },
        fetchLeaderboard
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [resolvedGameId, isFlappyArm, fetchLeaderboard]);

  if (!gameIdParam && !gameTypeParam) {
    return (
      <div style={styles.wrap}>
        <button type="button" onClick={() => navigate("/games")} style={styles.backBtn}>← Games</button>
        <p style={styles.hint}>Select a game from the hub to view leaderboard.</p>
      </div>
    );
  }

  const displayScore = (e) => (lowerIsBetter && !isFlappyArm ? `${Number(e.score)} ms` : Number(e.score));

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
          {entries.map((e, i) => {
            const rank = i + 1;
            const isTop3 = rank <= 3;
            const rowStyle = isTop3 ? { ...styles.row, ...styles.rowTop3 } : styles.row;
            const rankStyle = rank === 1 ? styles.rankGold : rank === 2 ? styles.rankSilver : rank === 3 ? styles.rankBronze : styles.rank;
            return (
              <li key={e.id || e.user_id || i} style={rowStyle}>
                <span style={rankStyle}>{rank}</span>
                <span style={styles.name}>{e.profiles?.display_name || e.profiles?.username || e.profiles?.handle || "Player"}</span>
                <span style={styles.score}>{displayScore(e)}</span>
              </li>
            );
          })}
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
  rowTop3: {
    borderWidth: 2,
    fontWeight: 700,
  },
  rank: { width: 28, fontWeight: 800, color: "var(--accent)" },
  rankGold: { width: 28, fontWeight: 800, color: "#f0c14b" },
  rankSilver: { width: 28, fontWeight: 800, color: "#c0c0c0" },
  rankBronze: { width: 28, fontWeight: 800, color: "#cd7f32" },
  name: { flex: 1, color: "var(--text)", fontWeight: 600 },
  score: { color: "var(--text-dim)", fontWeight: 700 },
};
