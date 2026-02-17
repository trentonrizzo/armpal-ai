import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";

export default function GamesPage() {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.from("games").select("*");
      if (!alive) return;
      if (error) setGames([]);
      else setGames(data ?? []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div style={styles.wrap}>
      <h1 style={styles.title}>Games</h1>

      {loading ? (
        <p style={styles.hint}>Loading…</p>
      ) : games.length === 0 ? (
        <p style={styles.hint}>No games yet.</p>
      ) : (
        <div style={styles.grid}>
          {games.map((game) => (
            <button
              key={game.id}
              type="button"
              onClick={() => navigate(`/games/${game.id}`)}
              style={styles.card}
            >
              <span style={styles.cardTitle}>{game.title}</span>
              {game.description && (
                <p style={styles.cardDesc}>{game.description}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: {
    padding: "16px 16px 90px",
    maxWidth: "560px",
    margin: "0 auto",
  },
  title: {
    fontSize: 22,
    fontWeight: 900,
    margin: "0 0 16px",
    color: "var(--text)",
  },
  hint: {
    color: "var(--text-dim)",
    fontSize: 14,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: 12,
  },
  card: {
    display: "block",
    textAlign: "left",
    background: "var(--card-2)",
    borderRadius: 14,
    border: "1px solid var(--border)",
    padding: 14,
    cursor: "pointer",
  },
  cardTitle: {
    color: "var(--text)",
    fontSize: 15,
    fontWeight: 800,
  },
  cardDesc: {
    margin: "8px 0 0",
    color: "var(--text-dim)",
    fontSize: 13,
    lineHeight: 1.35,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
  },
};
