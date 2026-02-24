/**
 * Games hub — exactly 4 tiles: Reaction Speed Test, Flappy Arm, Arm Power Arena (selector), Tic Tac Toe.
 * No duplicates. Arena tile goes to selector (Multiplayer | Trainer).
 */
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import MiniGameShareOverlay from "./MiniGameShareOverlay";

const CARD_STYLE = {
  display: "block",
  width: "100%",
  textAlign: "left",
  background: "var(--card-2)",
  borderRadius: 14,
  border: "1px solid var(--border)",
  padding: 14,
  cursor: "pointer",
  transition: "transform 0.2s ease, box-shadow 0.2s ease",
};

export default function GamesHub() {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [sendGame, setSendGame] = useState(null);
  const [bestScores, setBestScores] = useState({});

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
    if (!user?.id) return;
    let alive = true;
    supabase
      .from("user_game_best")
      .select("game_id, best_score")
      .eq("user_id", user.id)
      .then((r) => {
        if (!alive) return;
        const best = {};
        (r.data || []).forEach((row) => { best[row.game_id] = row.best_score; });
        setBestScores(best);
      });
    return () => { alive = false; };
  }, [user?.id]);

  const curated = useMemo(() => {
    const list = games;
    const reaction = list.find((g) => g.game_type === "reaction_test" || g.game_type === "reaction_speed");
    const flappy = list.find((g) => g.game_type === "flappy_arm");
    const ttt = list.find((g) => g.game_type === "tictactoe" || g.game_type === "tic_tac_toe");
    return [
      { type: "reaction", game: reaction, title: "Reaction Speed Test", emoji: "⚡", desc: "Tap when the screen turns green." },
      { type: "flappy", game: flappy, title: "Flappy Arm", emoji: "🦾", desc: "Dodge obstacles. Tap to rise." },
      { type: "arena", game: null, title: "Arm Power Arena", emoji: "🎯", desc: "Multiplayer or Aim Trainer." },
      { type: "ttt", game: ttt, title: "Tic Tac Toe", emoji: "❌", desc: "Play with a friend." },
    ];
  }, [games]);

  function handleCard(item) {
    if (item.type === "arena") {
      navigate("/games/arena-select");
      return;
    }
    if (item.type === "ttt" && item.game) {
      setSendGame(item.game);
      return;
    }
    if (item.game?.id) navigate(`/games/${item.game.id}`);
  }

  return (
    <div style={styles.wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <h1 style={styles.title}>Mini Games</h1>
        <button type="button" onClick={() => navigate("/games/arcade")} style={styles.arcadeStatsBtn}>
          My Arcade Stats
        </button>
      </div>

      {loading ? (
        <p style={styles.hint}>Loading…</p>
      ) : (
        <section style={styles.section}>
          <div style={styles.grid}>
            {curated.map((item) => {
              const best = item.game ? bestScores[item.game.id] : null;
              const isReaction = item.type === "reaction";
              const unavailable = (item.type === "reaction" || item.type === "flappy" || item.type === "ttt") && !item.game;
              return (
                <div key={item.type} style={styles.cardWrap}>
                  <button
                    type="button"
                    onClick={() => !unavailable && handleCard(item)}
                    disabled={unavailable}
                    style={{
                      ...CARD_STYLE,
                      opacity: unavailable ? 0.7 : 1,
                      cursor: unavailable ? "not-allowed" : "pointer",
                    }}
                    onMouseEnter={(e) => {
                      if (unavailable) return;
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 8px 24px color-mix(in srgb, var(--accent) 25%, transparent)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <span style={styles.cardEmoji}>{item.emoji}</span>
                    <span style={styles.cardTitle}>{item.title}</span>
                    <p style={styles.cardDesc}>{item.desc}</p>
                    {item.type === "arena" && <span style={styles.multiBadge}>Multiplayer · Trainer</span>}
                    {item.type === "ttt" && item.game && <span style={styles.multiBadge}>Multiplayer</span>}
                    {best != null && item.game && (
                      <span style={styles.bestScore}>
                        Best: {isReaction ? `${Number(best)} ms` : Number(best)}
                      </span>
                    )}
                    {item.type === "reaction" && item.game && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); navigate(`/games/leaderboard?game_id=${item.game.id}`); }}
                        style={styles.leaderboardBtn}
                      >
                        Leaderboard
                      </button>
                    )}
                    {item.type === "flappy" && item.game && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); navigate(`/games/leaderboard?game_type=flappy_arm`); }}
                        style={styles.leaderboardBtn}
                      >
                        Leaderboard
                      </button>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <MiniGameShareOverlay open={!!sendGame} onClose={() => setSendGame(null)} game={sendGame} onSent={() => setSendGame(null)} />
    </div>
  );
}

const styles = {
  wrap: { padding: "16px 16px 90px", maxWidth: "100%", margin: "0 auto" },
  title: { fontSize: 22, fontWeight: 900, margin: "0 0 16px", color: "var(--text)" },
  section: { marginBottom: 24 },
  hint: { color: "var(--text-dim)", fontSize: 14, margin: 0 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: 12,
  },
  cardWrap: {},
  cardEmoji: { fontSize: 28, display: "block", marginBottom: 6 },
  cardTitle: { color: "var(--text)", fontSize: 15, fontWeight: 800 },
  cardDesc: { margin: "8px 0 0", color: "var(--text-dim)", fontSize: 12, lineHeight: 1.35 },
  multiBadge: {
    display: "inline-block",
    marginTop: 6,
    padding: "2px 8px",
    borderRadius: 8,
    background: "color-mix(in srgb, var(--accent) 25%, transparent)",
    color: "var(--accent)",
    fontSize: 11,
    fontWeight: 700,
  },
  bestScore: { display: "block", marginTop: 6, fontSize: 12, color: "var(--text-dim)" },
  leaderboardBtn: {
    marginTop: 10,
    width: "100%",
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text-dim)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  arcadeStatsBtn: {
    padding: "8px 14px",
    borderRadius: 10,
    border: "1px solid var(--accent)",
    background: "color-mix(in srgb, var(--accent) 20%, transparent)",
    color: "var(--accent)",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
};
