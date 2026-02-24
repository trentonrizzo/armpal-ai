import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";

const GAME_TYPES = {
  flappy_arm: "Flappy Arm",
  tictactoe: "Tic Tac Toe",
  tic_tac_toe: "Tic Tac Toe",
  reaction_speed: "Reaction Speed",
};

export default function ArcadeProfile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [arcadeStats, setArcadeStats] = useState(null);
  const [statsByType, setStatsByType] = useState({});
  const [rankByGameId, setRankByGameId] = useState({});
  const [gamesWithLeaderboard, setGamesWithLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (alive) setUser(u ?? null);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      const { data: arcadeRow } = await supabase
        .from("arcade_flappy_arm_leaderboard")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (!alive) return;
      setArcadeStats(
        arcadeRow
          ? {
              flappy_best_score: arcadeRow.best_score ?? 0,
              flappy_total_games: arcadeRow.total_games ?? 0,
              flappy_last_score: "—",
            }
          : null
      );

      const types = ["tictactoe", "tic_tac_toe", "reaction_speed"];
      const { data: statsRows } = await supabase
        .from("game_user_stats")
        .select("game_type, best_score, total_games, wins, losses, win_streak, best_streak, fastest_time")
        .eq("user_id", user.id)
        .in("game_type", types);
      if (!alive) return;
      const byType = {};
      (statsRows || []).forEach((r) => {
        byType[r.game_type] = r;
      });
      setStatsByType(byType);

      const { data: games } = await supabase
        .from("games")
        .select("id, game_type")
        .in("game_type", ["flappy_arm", "reaction_speed"]);
      if (!alive) return;
      setGamesWithLeaderboard(games || []);

      const ranks = {};
      for (const g of games || []) {
        if (g.game_type === "flappy_arm") {
          const { data: flappyRows } = await supabase
            .from("arcade_flappy_arm_leaderboard")
            .select("user_id")
            .order("best_score", { ascending: false })
            .limit(500);
          if (!alive) break;
          const idx = (flappyRows || []).findIndex((e) => e.user_id === user.id);
          if (idx >= 0) ranks[g.id] = idx + 1;
        } else {
          const lowerIsBetter = g.game_type === "reaction_speed" || g.game_type === "reaction_test";
          const order = lowerIsBetter ? { ascending: true } : { ascending: false };
          const { data: entries } = await supabase
            .from("game_leaderboard")
            .select("user_id, score")
            .eq("game_id", g.id)
            .order("score", order)
            .limit(500);
          if (!alive) break;
          const idx = (entries || []).findIndex((e) => e.user_id === user.id);
          if (idx >= 0) ranks[g.id] = idx + 1;
        }
      }
      if (alive) setRankByGameId(ranks);
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [user?.id]);

  const ttt = statsByType.tictactoe || statsByType.tic_tac_toe;
  const reaction = statsByType.reaction_speed;
  const flappyRank = rankByGameId[gamesWithLeaderboard.find((g) => g.game_type === "flappy_arm")?.id];
  const reactionRank = rankByGameId[gamesWithLeaderboard.find((g) => g.game_type === "reaction_speed")?.id];

  return (
    <div style={styles.wrap}>
      <button type="button" onClick={() => navigate("/games")} style={styles.backBtn}>
        ← Games
      </button>
      <h1 style={styles.title}>🔥 Player Arcade Profile</h1>

      {loading ? (
        <p style={styles.hint}>Loading…</p>
      ) : (
        <>
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Flappy Arm</h2>
            <ul style={styles.statsList}>
              <li style={styles.statRow}><span style={styles.statLabel}>Best Score</span><span style={styles.statVal}>{arcadeStats?.flappy_best_score ?? 0}</span></li>
              {flappyRank != null && (
                <li style={styles.statRow}><span style={styles.statLabel}>Rank</span><span style={styles.statVal}>#{flappyRank}</span></li>
              )}
              <li style={styles.statRow}><span style={styles.statLabel}>Total Games</span><span style={styles.statVal}>{arcadeStats?.flappy_total_games ?? 0}</span></li>
              <li style={styles.statRow}><span style={styles.statLabel}>Last Score</span><span style={styles.statVal}>{arcadeStats?.flappy_last_score ?? "—"}</span></li>
            </ul>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Tic Tac Toe</h2>
            <ul style={styles.statsList}>
              <li style={styles.statRow}><span style={styles.statLabel}>Wins</span><span style={styles.statVal}>{ttt?.wins ?? 0}</span></li>
              <li style={styles.statRow}><span style={styles.statLabel}>Losses</span><span style={styles.statVal}>{ttt?.losses ?? 0}</span></li>
              <li style={styles.statRow}><span style={styles.statLabel}>Current Streak</span><span style={styles.statVal}>{ttt?.win_streak ?? 0}</span></li>
              <li style={styles.statRow}><span style={styles.statLabel}>Best Streak</span><span style={styles.statVal}>{ttt?.best_streak ?? 0}</span></li>
            </ul>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Reaction Speed</h2>
            <ul style={styles.statsList}>
              <li style={styles.statRow}>
                <span style={styles.statLabel}>Best Time</span>
                <span style={styles.statVal}>{reaction?.fastest_time != null ? `${Number(reaction.fastest_time)} ms` : "—"}</span>
              </li>
              {reactionRank != null && (
                <li style={styles.statRow}><span style={styles.statLabel}>Rank</span><span style={styles.statVal}>#{reactionRank}</span></li>
              )}
              <li style={styles.statRow}><span style={styles.statLabel}>Tests Completed</span><span style={styles.statVal}>{reaction?.total_games ?? 0}</span></li>
            </ul>
          </section>
        </>
      )}
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
  title: { fontSize: 22, fontWeight: 800, margin: "0 0 20px", color: "var(--text)" },
  hint: { color: "var(--text-dim)", fontSize: 14, margin: 0 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: "var(--text)", margin: "0 0 10px" },
  statsList: { listStyle: "none", margin: 0, padding: 0 },
  statRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 14px",
    background: "var(--card-2)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    marginBottom: 8,
  },
  statLabel: { color: "var(--text-dim)", fontSize: 14 },
  statVal: { color: "var(--text)", fontWeight: 700, fontSize: 15 },
};
