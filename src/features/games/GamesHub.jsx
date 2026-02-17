import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import MiniGameShareOverlay from "./MiniGameShareOverlay";

const TITLE_EMOJI = {
  "Reaction Test": "⚡",
  "Reaction Speed": "⚡",
  "Tic Tac Toe": "❌",
  "Flappy Arm": "🦾",
};

function getEmoji(title) {
  if (!title) return "🎮";
  return TITLE_EMOJI[title] || "🎮";
}

export default function GamesHub() {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [sendGame, setSendGame] = useState(null);
  const [search, setSearch] = useState("");
  const [bestScores, setBestScores] = useState({});
  const [recentSessions, setRecentSessions] = useState([]);
  const [recentScores, setRecentScores] = useState([]);

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
    (async () => {
      const [sessRes, scoresRes, bestRes] = await Promise.all([
        supabase
          .from("game_sessions")
          .select("id, game_id, created_at, games(title)")
          .or(`player_one.eq.${user.id},player_two.eq.${user.id}`)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("user_game_scores")
          .select("game_id, score, created_at, games(title)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase.from("user_game_best").select("game_id, best_score").eq("user_id", user.id).then((r) => r),
      ]);
      if (!alive) return;
      setRecentSessions(
        (sessRes.data || []).map((s) => ({
          game_id: s.game_id,
          game_title: s.games?.title || "Game",
          session_id: s.id,
          created_at: s.created_at,
        }))
      );
      setRecentScores(
        (scoresRes.data || []).map((r) => ({
          game_id: r.game_id,
          game_title: r.games?.title || "Game",
          created_at: r.created_at,
        }))
      );
      const best = {};
      if (bestRes.data) {
        (bestRes.data || []).forEach((r) => {
          best[r.game_id] = r.best_score;
        });
      }
      setBestScores(best);
    })();
    return () => { alive = false; };
  }, [user?.id]);

  const singlePlayer = games.filter((g) => (g.mode || "single") === "single");
  const multiplayer = games.filter((g) => g.mode === "multiplayer");

  const searchLower = search.trim().toLowerCase();
  const filterGames = (list) =>
    searchLower
      ? list.filter(
          (g) =>
            (g.title || "").toLowerCase().includes(searchLower) ||
            (g.description || "").toLowerCase().includes(searchLower)
        )
      : list;

  const recentMerged = useMemo(() => {
    const byGame = new Map();
    recentSessions.forEach((s) => {
      const key = s.session_id ? `session-${s.session_id}` : s.game_id;
      if (!byGame.has(key))
        byGame.set(key, { game_id: s.game_id, game_title: s.game_title, session_id: s.session_id, created_at: s.created_at });
    });
    recentScores.forEach((r) => {
      const key = `score-${r.game_id}-${r.created_at}`;
      if (!byGame.has(key))
        byGame.set(key, { game_id: r.game_id, game_title: r.game_title, session_id: null, created_at: r.created_at });
    });
    return [...byGame.values()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 16);
  }, [recentSessions, recentScores]);

  const uniqueRecent = useMemo(() => {
    const recentGames = recentMerged.map((r) => ({
      ...r,
      id: r.session_id || `score-${r.game_id}-${r.created_at}`,
    }));
    return Array.from(new Map(recentGames.map((g) => [g.id, g])).values());
  }, [recentMerged]);

  function renderCard(game, options = {}) {
    const { recentSessionId, showBest = false } = options;
    const isMulti = game.mode === "multiplayer";
    const best = bestScores[game.id];
    const isReaction = game.game_type === "reaction_test" || game.game_type === "reaction_speed";
    const emoji = getEmoji(game.title);
    return (
      <div key={game.id} style={styles.cardWrap}>
        <button
          type="button"
          onClick={() => {
            if (recentSessionId) navigate(`/games/session/${recentSessionId}`);
            else if (!isMulti) navigate(`/games/${game.id}`);
            else setSendGame(game);
          }}
          style={styles.card}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 8px 24px color-mix(in srgb, var(--accent) 25%, transparent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <span style={styles.cardEmoji}>{emoji}</span>
          <span style={styles.cardTitle}>{game.title}</span>
          {game.description && <p style={styles.cardDesc}>{game.description}</p>}
          {isMulti && <span style={styles.multiBadge}>Multiplayer</span>}
          {showBest && best != null && (
            <span style={styles.bestScore}>
              Best: {isReaction ? `${Number(best)} ms` : Number(best)}
            </span>
          )}
          {isMulti && !recentSessionId && <span style={styles.sendLabel}>Send To Friend</span>}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); navigate(`/games/leaderboard?game_id=${game.id}`); }}
            style={styles.leaderboardBtn}
          >
            Leaderboard
          </button>
        </button>
      </div>
    );
  }

  function renderRow(title, items, renderItem) {
    if (!items.length) return null;
    return (
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>{title}</h2>
        <div style={styles.rowScroll}>
          {items.map(renderItem)}
        </div>
      </section>
    );
  }

  return (
    <div style={styles.wrap}>
      <h1 style={styles.title}>Mini Games</h1>
      <input
        type="text"
        placeholder="Search games…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={styles.search}
      />

      {loading ? (
        <p style={styles.hint}>Loading…</p>
      ) : (
        <>
          {renderRow(
            "Recently Played",
            uniqueRecent,
            (r) => {
              const game = games.find((g) => g.id === r.game_id);
              return game ? renderCard(game, { recentSessionId: r.session_id }) : null;
            }
          )}
          {uniqueRecent.length === 0 && <section style={styles.section}><p style={styles.placeholder}>No recent games yet.</p></section>}

          {renderRow("Single Player", filterGames(singlePlayer), (g) => renderCard(g, { showBest: true }))}
          {filterGames(singlePlayer).length === 0 && <section style={styles.section}><p style={styles.hint}>No single player games yet.</p></section>}

          {renderRow("Multiplayer", filterGames(multiplayer), (g) => renderCard(g))}
          {filterGames(multiplayer).length === 0 && <section style={styles.section}><p style={styles.hint}>No multiplayer games yet.</p></section>}
        </>
      )}

      <MiniGameShareOverlay open={!!sendGame} onClose={() => setSendGame(null)} game={sendGame} onSent={() => setSendGame(null)} />
    </div>
  );
}

const styles = {
  wrap: { padding: "16px 16px 90px", maxWidth: "100%", margin: "0 auto" },
  title: { fontSize: 22, fontWeight: 900, margin: "0 0 16px", color: "var(--text)" },
  search: {
    width: "100%",
    maxWidth: 400,
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--card-2)",
    color: "var(--text)",
    fontSize: 14,
    marginBottom: 20,
    boxSizing: "border-box",
  },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: 800, margin: "0 0 12px", color: "var(--text)" },
  placeholder: { color: "var(--text-dim)", fontSize: 14, margin: 0 },
  hint: { color: "var(--text-dim)", fontSize: 14, margin: 0 },
  rowScroll: {
    display: "flex",
    gap: 12,
    overflowX: "auto",
    paddingBottom: 8,
    WebkitOverflowScrolling: "touch",
  },
  cardWrap: { flexShrink: 0, width: 180 },
  card: {
    display: "block",
    width: "100%",
    textAlign: "left",
    background: "var(--card-2)",
    borderRadius: 14,
    border: "1px solid var(--border)",
    padding: 14,
    cursor: "pointer",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
  },
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
  sendLabel: { display: "block", marginTop: 8, fontSize: 12, color: "var(--accent)", fontWeight: 700 },
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
};
