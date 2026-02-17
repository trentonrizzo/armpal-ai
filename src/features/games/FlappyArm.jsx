import React, { useRef, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";

const GRAVITY = 0.25;
const JUMP_FORCE = -6;
const VELOCITY_CLAMP = [-6, 6];
const PIPE_SPEED = 1.6;
const PIPE_SPACING = 260;
const PIPE_GAP = 220;
const GRACE_MS = 800;
const PLAYER = { emoji: "💪", size: 36, rotationOnJump: -15 };
const CANVAS_W = 360;
const CANVAS_H = 520;
const GROUND_Y = 440;
const OBSTACLE_WIDTH = 56;
const OBSTACLE_EMOJI = ["🏋️", "🏋"];

export default function FlappyArm({ game }) {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const [user, setUser] = useState(null);
  const [bestScore, setBestScore] = useState(null);
  const [loadingBest, setLoadingBest] = useState(true);
  const [phase, setPhase] = useState("idle");
  const [score, setScore] = useState(0);
  const [newRecord, setNewRecord] = useState(false);
  const animRef = useRef(null);
  const stateRef = useRef({
    y: (GROUND_Y - PLAYER.size) / 2,
    vy: 0,
    rotation: 0,
    graceUntil: 0,
    started: false,
    obstacles: [],
    lastSpawnX: 0,
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

  const spawnObstacle = useCallback((x) => {
    const gapCenter = 120 + Math.random() * (GROUND_Y - 240);
    const emoji = OBSTACLE_EMOJI[Math.random() > 0.5 ? 0 : 1];
    return {
      x,
      top: { y: 0, h: gapCenter - PIPE_GAP / 2 },
      bottom: { y: gapCenter + PIPE_GAP / 2, h: CANVAS_H - (gapCenter + PIPE_GAP / 2) },
      passed: false,
      emoji,
    };
  }, []);

  const startGame = useCallback(() => {
    setPhase("playing");
    setScore(0);
    setNewRecord(false);
    const centerY = (GROUND_Y - PLAYER.size) / 2;
    stateRef.current = {
      y: centerY,
      vy: 0,
      rotation: 0,
      graceUntil: Date.now() + GRACE_MS,
      started: false,
      obstacles: [],
      lastSpawnX: CANVAS_W + OBSTACLE_WIDTH,
    };
  }, []);

  const onTap = useCallback(() => {
    const s = stateRef.current;
    if (phase !== "playing") return;
    s.started = true;
    s.vy = JUMP_FORCE;
    s.rotation = PLAYER.rotationOnJump;
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const w = CANVAS_W;
    const h = CANVAS_H;
    const playerHalf = PLAYER.size / 2;
    const playerCenterX = w / 2;

    function frame() {
      const s = stateRef.current;
      const now = Date.now();
      const inGrace = now < s.graceUntil;

      if (s.started && !inGrace) {
        s.vy += GRAVITY;
        s.vy = Math.max(VELOCITY_CLAMP[0], Math.min(VELOCITY_CLAMP[1], s.vy));
        s.y += s.vy;
        s.rotation = s.vy < 0 ? PLAYER.rotationOnJump : Math.min(60, s.rotation + 4);
      }

      s.y = Math.max(20, Math.min(GROUND_Y - PLAYER.size - 4, s.y));

      if (s.started) {
        s.obstacles.forEach((ob) => {
          ob.x -= PIPE_SPEED;
          if (!ob.passed && ob.x + OBSTACLE_WIDTH < playerCenterX - playerHalf) {
            ob.passed = true;
            setScore((prev) => prev + 1);
          }
        });
        s.obstacles = s.obstacles.filter((o) => o.x > -OBSTACLE_WIDTH);
        if (s.lastSpawnX - (s.obstacles[s.obstacles.length - 1]?.x ?? 0) > PIPE_SPACING) {
          s.obstacles.push(spawnObstacle(w + OBSTACLE_WIDTH));
          s.lastSpawnX = w + OBSTACLE_WIDTH;
        }
      }

      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "var(--card-2)";
      ctx.fillRect(0, GROUND_Y, w, h - GROUND_Y);

      s.obstacles.forEach((ob) => {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(ob.x, ob.top.y, OBSTACLE_WIDTH, ob.top.h);
        ctx.fillRect(ob.x, ob.bottom.y, OBSTACLE_WIDTH, ob.bottom.h);
        ctx.font = "32px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(ob.emoji, ob.x + OBSTACLE_WIDTH / 2, ob.top.h - 24);
        ctx.fillText(ob.emoji, ob.x + OBSTACLE_WIDTH / 2, ob.bottom.y + 40);
      });

      ctx.save();
      ctx.translate(playerCenterX, s.y + playerHalf);
      ctx.rotate((s.rotation * Math.PI) / 180);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${PLAYER.size}px system-ui, sans-serif`;
      ctx.fillText(PLAYER.emoji, 0, 0);
      ctx.restore();

      const px = playerCenterX;
      const py = s.y + playerHalf;
      const hitOb = s.obstacles.find(
        (ob) =>
          ob.x < px + playerHalf + 8 &&
          ob.x + OBSTACLE_WIDTH > px - playerHalf - 8 &&
          (py < ob.top.h - 12 || py > ob.bottom.y + 12)
      );
      if (hitOb || s.y + PLAYER.size >= GROUND_Y - 4) {
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
  }, [phase, score, user?.id, game?.id, bestScore, spawnObstacle]);

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
          <p style={styles.instruction}>Tap to raise your arm. Avoid the obstacles!</p>
          <p style={styles.difficulty}>Wide gaps · Smooth play · 800ms grace after start</p>
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
            width={CANVAS_W}
            height={CANVAS_H}
            style={styles.canvas}
            onClick={onTap}
            onTouchStart={(e) => {
              e.preventDefault();
              onTap();
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
  wrap: { padding: "20px 16px 90px", maxWidth: "400px", margin: "0 auto" },
  backBtn: {
    marginBottom: 12,
    padding: "8px 0",
    background: "none",
    border: "none",
    color: "var(--text-dim)",
    fontSize: 14,
    cursor: "pointer",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
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
  section: { textAlign: "center", marginTop: 24 },
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
    transition: "opacity 0.2s ease",
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
    padding: "10px 0",
    fontSize: 15,
    fontWeight: 700,
    color: "var(--text)",
  },
  canvas: {
    display: "block",
    width: "100%",
    maxWidth: CANVAS_W,
    margin: "0 auto",
    borderRadius: 16,
    border: "1px solid var(--border)",
    background: "var(--bg)",
    transition: "opacity 0.15s ease",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.85)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 16,
  },
  overlayCard: {
    background: "var(--card)",
    borderRadius: 20,
    padding: 28,
    border: "1px solid var(--border)",
    textAlign: "center",
    maxWidth: 320,
  },
  overlayTitle: { fontSize: 22, fontWeight: 900, margin: "0 0 16px", color: "var(--text)" },
  overlayScore: { fontSize: 18, fontWeight: 700, margin: "0 0 4px", color: "var(--text)" },
  overlayBest: { fontSize: 14, color: "var(--text-dim)", margin: "0 0 12px" },
  newRecord: { fontSize: 16, fontWeight: 800, color: "var(--accent)", margin: "0 0 16px" },
};
