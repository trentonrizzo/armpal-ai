import React, { useRef, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";

const GRAVITY = 0.35;
const FLAP = -8;
const OBSTACLE_GAP = 140;
const OBSTACLE_WIDTH = 48;
const OBSTACLE_SPEED_BASE = 3;
const ARM_WIDTH = 40;
const ARM_HEIGHT = 24;
const GROUND = 280;

export default function FlappyArm({ game }) {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const [user, setUser] = useState(null);
  const [bestScore, setBestScore] = useState(null);
  const [loadingBest, setLoadingBest] = useState(true);
  const [phase, setPhase] = useState("idle"); // idle | playing | over
  const [score, setScore] = useState(0);
  const [newRecord, setNewRecord] = useState(false);
  const animRef = useRef(null);
  const stateRef = useRef({
    y: GROUND - ARM_HEIGHT - 40,
    vy: 0,
    obstacles: [],
    lastSpawn: 0,
    passed: new Set(),
  });

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
    supabase
      .from("user_game_best")
      .select("best_score")
      .eq("user_id", user.id)
      .eq("game_id", game.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.best_score != null) setBestScore(Number(data.best_score));
        setLoadingBest(false);
      });
  }, [user?.id, game?.id]);

  const getSpeed = useCallback((s) => {
    if (s < 50) return OBSTACLE_SPEED_BASE;
    if (s < 100) return OBSTACLE_SPEED_BASE + 0.5;
    return OBSTACLE_SPEED_BASE + 0.8;
  }, []);

  const spawnObstacle = useCallback((x) => {
    const gapY = 80 + Math.random() * 120;
    return {
      x,
      top: { y: 0, h: gapY - OBSTACLE_GAP / 2 },
      bottom: { y: gapY + OBSTACLE_GAP / 2, h: 400 - (gapY + OBSTACLE_GAP / 2) },
      passed: false,
    };
  }, []);

  const startGame = useCallback(() => {
    setPhase("playing");
    setScore(0);
    setNewRecord(false);
    stateRef.current = {
      y: GROUND - ARM_HEIGHT - 40,
      vy: 0,
      obstacles: [spawnObstacle(320)],
      passed: new Set(),
    };
  }, [spawnObstacle]);

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    function frame() {
      const s = stateRef.current;
      s.vy += GRAVITY;
      s.y += s.vy;
      if (s.y > GROUND - ARM_HEIGHT) {
        s.y = GROUND - ARM_HEIGHT;
        s.vy = 0;
      }
      if (s.y < 0) {
        s.y = 0;
        s.vy = 0;
      }

      const spd = getSpeed(score);
      s.obstacles.forEach((ob) => {
        ob.x -= spd;
        if (!ob.passed && ob.x + OBSTACLE_WIDTH < w / 2 - ARM_WIDTH / 2) {
          ob.passed = true;
          setScore((prev) => prev + 1);
        }
      });
      s.obstacles = s.obstacles.filter((o) => o.x > -OBSTACLE_WIDTH);
      const last = s.obstacles[s.obstacles.length - 1];
      if (!last || last.x < w - 220) {
        s.obstacles.push(spawnObstacle(w + OBSTACLE_WIDTH));
      }

      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "var(--card-2)";
      ctx.fillRect(0, GROUND, w, h - GROUND);

      s.obstacles.forEach((ob) => {
        ctx.fillStyle = "var(--accent)";
        ctx.fillRect(ob.x, ob.top.y, OBSTACLE_WIDTH, ob.top.h);
        ctx.fillRect(ob.x, ob.bottom.y, OBSTACLE_WIDTH, ob.bottom.h);
        ctx.fillStyle = "#333";
        ctx.fillRect(ob.x + 8, ob.top.h - 20, 12, 20);
        ctx.fillRect(ob.x + 28, ob.top.h - 20, 12, 20);
        ctx.fillRect(ob.x + 8, ob.bottom.y, 12, 20);
        ctx.fillRect(ob.x + 28, ob.bottom.y, 12, 20);
      });

      const armX = w / 2 - ARM_WIDTH / 2;
      ctx.fillStyle = "var(--accent)";
      ctx.beginPath();
      ctx.roundRect(armX, s.y, ARM_WIDTH, ARM_HEIGHT, 8);
      ctx.fill();
      ctx.strokeStyle = "var(--border)";
      ctx.lineWidth = 2;
      ctx.stroke();

      const ax = armX + ARM_WIDTH / 2;
      const ay = s.y + ARM_HEIGHT / 2;
      const o = s.obstacles.find(
        (ob) =>
          ob.x < ax + ARM_WIDTH / 2 + 4 &&
          ob.x + OBSTACLE_WIDTH > ax - ARM_WIDTH / 2 - 4 &&
          (ay < ob.top.h || ay + ARM_HEIGHT > ob.bottom.y)
      );
      if (o || s.y + ARM_HEIGHT >= GROUND - 2) {
        setPhase("over");
        if (user?.id && game?.id) {
          const isNewBest = bestScore == null || score > bestScore;
          if (isNewBest) {
            setNewRecord(true);
            setBestScore(score);
            supabase
              .from("user_game_best")
              .upsert(
                { user_id: user.id, game_id: game.id, best_score: score, updated_at: new Date().toISOString() },
                { onConflict: "user_id,game_id" }
              )
              .then(() => {});
            supabase.from("game_leaderboard").insert({ game_id: game.id, user_id: user.id, score }).then(() => {});
          }
        }
        return;
      }

      animRef.current = requestAnimationFrame(frame);
    }

    animRef.current = requestAnimationFrame(frame);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [phase, score, user?.id, game?.id, bestScore, getSpeed, spawnObstacle]);

  return (
    <div style={styles.wrap}>
      <button type="button" onClick={() => navigate("/games")} style={styles.backBtn}>
        ← Games
      </button>
      <div style={styles.header}>
        <h2 style={styles.title}>{game?.title ?? "Flappy Arm"}</h2>
        <button type="button" onClick={() => navigate(`/games/leaderboard?game_id=${game?.id}`)} style={styles.leaderboardBtn}>
          Leaderboard
        </button>
      </div>

      {phase === "idle" && (
        <div style={styles.section}>
          <p style={styles.instruction}>Tap to raise your arm. Avoid the barbells!</p>
          <p style={styles.difficulty}>0–50 easy · 50–100 medium · 100+ moderate</p>
          <button type="button" onClick={startGame} style={styles.primaryBtn}>
            Start
          </button>
        </div>
      )}

      {(phase === "playing" || phase === "over") && (
        <>
          <div style={styles.scoreBar}>
            <span>Score: {score}</span>
            {bestScore != null && <span>Best: {bestScore}</span>}
          </div>
          <canvas
            ref={canvasRef}
            width={320}
            height={400}
            style={styles.canvas}
            onClick={() => {
              if (phase === "playing") stateRef.current.vy = FLAP;
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              if (phase === "playing") stateRef.current.vy = FLAP;
            }}
          />
        </>
      )}

      {phase === "over" && (
        <div style={styles.overlay}>
          <div style={styles.overlayCard}>
            <h3 style={styles.overlayTitle}>Game Over</h3>
            <p style={styles.overlayScore}>Score: {score}</p>
            <p style={styles.overlayBest}>Best: {bestScore ?? score}</p>
            {newRecord && <p style={styles.newRecord}>New Record!</p>}
            <button type="button" onClick={startGame} style={styles.primaryBtn}>
              Play Again
            </button>
            <button type="button" onClick={() => navigate("/games")} style={styles.secondaryBtn}>
              Back to Games
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: { padding: "16px 16px 90px", maxWidth: "400px", margin: "0 auto" },
  backBtn: {
    marginBottom: 12,
    padding: "8px 0",
    background: "none",
    border: "none",
    color: "var(--text-dim)",
    fontSize: 14,
    cursor: "pointer",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 18, fontWeight: 800, margin: 0, color: "var(--text)" },
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
  section: { textAlign: "center", marginTop: 20 },
  instruction: { color: "var(--text-dim)", fontSize: 14, margin: "0 0 8px" },
  difficulty: { color: "var(--text-dim)", fontSize: 12, margin: "0 0 20px" },
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
    marginTop: 10,
    padding: "12px 20px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text)",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
  scoreBar: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 0",
    fontSize: 14,
    fontWeight: 700,
    color: "var(--text)",
  },
  canvas: {
    display: "block",
    width: "100%",
    maxWidth: 320,
    margin: "0 auto",
    borderRadius: 14,
    border: "1px solid var(--border)",
    background: "var(--bg)",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 16,
  },
  overlayCard: {
    background: "var(--card)",
    borderRadius: 16,
    padding: 24,
    border: "1px solid var(--border)",
    textAlign: "center",
    maxWidth: 320,
  },
  overlayTitle: { fontSize: 22, fontWeight: 900, margin: "0 0 16px", color: "var(--text)" },
  overlayScore: { fontSize: 18, fontWeight: 700, margin: "0 0 4px", color: "var(--text)" },
  overlayBest: { fontSize: 14, color: "var(--text-dim)", margin: "0 0 12px" },
  newRecord: { fontSize: 16, fontWeight: 800, color: "var(--accent)", margin: "0 0 16px" },
};
