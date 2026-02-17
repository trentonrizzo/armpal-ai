import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { updateGameStats } from "./utils/updateGameStats";
import { useToast } from "../../components/ToastProvider";

export default function ReactionSpeed({ game }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [phase, setPhase] = useState("idle"); // idle | wait | go | result
  const [lastTime, setLastTime] = useState(null);
  const [bestTime, setBestTime] = useState(null);
  const [currentTime, setCurrentTime] = useState(null);
  const [user, setUser] = useState(null);
  const [loadingBest, setLoadingBest] = useState(true);
  const readyAtRef = useRef(null);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (alive) setUser(u ?? null);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!user?.id || !game?.id) {
      setLoadingBest(false);
      return;
    }
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("user_game_best")
        .select("best_score")
        .eq("user_id", user.id)
        .eq("game_id", game.id)
        .maybeSingle();
      if (alive && data?.best_score != null) setBestTime(Number(data.best_score));
      if (alive) setLoadingBest(false);
    })();
    return () => { alive = false; };
  }, [user?.id, game?.id]);

  const startRound = useCallback(() => {
    setPhase("wait");
    setCurrentTime(null);
    setLastTime(null);
  }, []);

  useEffect(() => {
    if (phase !== "wait") return;
    const delay = 1500 + Math.random() * 2500;
    const t = setTimeout(() => {
      readyAtRef.current = performance.now();
      setPhase("go");
    }, delay);
    return () => clearTimeout(t);
  }, [phase]);

  async function handleTap() {
    if (phase === "go" && readyAtRef.current != null) {
      const ms = Math.round(performance.now() - readyAtRef.current);
      setCurrentTime(ms);
      setLastTime(ms);
      setPhase("result");

      if (user?.id && game?.id) {
        const shouldSave = bestTime == null || ms < bestTime;
        if (shouldSave) {
          await supabase.from("user_game_best").upsert(
            { user_id: user.id, game_id: game.id, best_score: ms, updated_at: new Date().toISOString() },
            { onConflict: "user_id,game_id" }
          );
          await supabase.from("game_leaderboard").insert({
            game_id: game.id,
            user_id: user.id,
            score: ms,
          });
          setBestTime(ms);
        }
        const { newPersonalRecord } = await updateGameStats({ userId: user.id, gameType: game.game_type || "reaction_speed", reactionTime: ms });
        if (newPersonalRecord && toast?.success) toast.success("🔥 NEW PERSONAL RECORD");
      }
    }
  }

  const isRed = phase === "wait";
  const isGreen = phase === "go";

  return (
    <div style={styles.wrap}>
      <button type="button" onClick={() => navigate("/games")} style={styles.backBtn}>
        ← Games
      </button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={styles.title}>{game?.title ?? "Reaction Speed"}</h2>
        <button type="button" onClick={() => navigate(`/games/leaderboard?game_id=${game?.id}`)} style={styles.leaderboardBtn}>
          Leaderboard
        </button>
      </div>

      {(phase === "idle" || phase === "result") && (
        <div style={styles.stats}>
          {currentTime != null && (
            <div style={styles.stat}>
              <span style={styles.statLabel}>Current</span>
              <span style={styles.statValue}>{currentTime} ms</span>
            </div>
          )}
          {lastTime != null && (
            <div style={styles.stat}>
              <span style={styles.statLabel}>Last</span>
              <span style={styles.statValue}>{lastTime} ms</span>
            </div>
          )}
          <div style={styles.stat}>
            <span style={styles.statLabel}>Best</span>
            <span style={styles.statValue}>
              {loadingBest ? "…" : bestTime != null ? `${bestTime} ms` : "—"}
            </span>
          </div>
        </div>
      )}

      {phase === "idle" && (
        <div style={styles.section}>
          <p style={styles.instruction}>
            Wait for the screen to turn green, then tap as fast as you can. Random delay each round.
          </p>
          <button type="button" onClick={startRound} style={styles.primaryBtn}>
            Start
          </button>
        </div>
      )}

      {(phase === "wait" || phase === "go") && (
        <button
          type="button"
          onClick={handleTap}
          style={{
            ...styles.tapZone,
            background: isGreen
              ? "linear-gradient(180deg, #0d6b0d 0%, #0a8c0a 100%)"
              : "linear-gradient(180deg, #8b0000 0%, #b00 100%)",
            cursor: isGreen ? "pointer" : "default",
            transition: "background 0.15s ease",
          }}
        >
          {isRed ? "Wait for green…" : "TAP NOW"}
        </button>
      )}

      {phase === "result" && (
        <div style={styles.section}>
          <p style={styles.resultValue}>{currentTime} ms</p>
          {bestTime != null && currentTime <= bestTime && currentTime === bestTime && (
            <p style={styles.newBest}>New best!</p>
          )}
          <button type="button" onClick={startRound} style={styles.primaryBtn}>
            Play again
          </button>
          <button type="button" onClick={() => navigate("/games")} style={styles.secondaryBtn}>
            Back to Games
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: {
    padding: "16px 16px 90px",
    maxWidth: "400px",
    margin: "0 auto",
  },
  backBtn: {
    marginBottom: 16,
    padding: "8px 0",
    background: "none",
    border: "none",
    color: "var(--text-dim)",
    fontSize: 14,
    cursor: "pointer",
  },
  title: {
    fontSize: 20,
    fontWeight: 800,
    margin: "0 0 16px",
    color: "var(--text)",
  },
  stats: {
    display: "flex",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 24,
    padding: 14,
    background: "var(--card-2)",
    borderRadius: 14,
    border: "1px solid var(--border)",
  },
  stat: { display: "flex", flexDirection: "column", gap: 2 },
  statLabel: { fontSize: 12, color: "var(--text-dim)", fontWeight: 600 },
  statValue: { fontSize: 18, fontWeight: 800, color: "var(--text)" },
  section: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
  },
  instruction: {
    color: "var(--text-dim)",
    fontSize: 14,
    textAlign: "center",
    margin: 0,
  },
  primaryBtn: {
    padding: "14px 28px",
    borderRadius: 12,
    border: "none",
    background: "var(--accent)",
    color: "var(--text)",
    fontWeight: 700,
    fontSize: 16,
    cursor: "pointer",
  },
  secondaryBtn: {
    padding: "12px 20px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text)",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
  tapZone: {
    display: "block",
    width: "100%",
    minHeight: 280,
    borderRadius: 20,
    border: "none",
    color: "#fff",
    fontSize: 20,
    fontWeight: 800,
    textShadow: "0 1px 2px rgba(0,0,0,0.3)",
  },
  resultValue: {
    margin: 0,
    fontSize: 32,
    fontWeight: 900,
    color: "var(--text)",
  },
  newBest: {
    margin: 0,
    fontSize: 14,
    color: "var(--accent)",
    fontWeight: 700,
  },
  leaderboardBtn: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--card-2)",
    color: "var(--text)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
};
