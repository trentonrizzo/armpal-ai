/**
 * FlappyArm — single-file canvas game. No external assets. Stable, mobile-safe.
 *
 * Score saving: On game over we ONLY insert into public.arcade_flappy_arm_scores
 * (user_id, score, is_pr). Leaderboard is a view — we never write to it.
 * After insert success we refetch best from arcade_flappy_arm_leaderboard and set UI.
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { useToast } from "../../components/ToastProvider";

// ——— Constants ———
const CANVAS_W = 360;
const CANVAS_H = 520;
const GROUND_Y = 440;
const GRAVITY = 0.25;
const JUMP_FORCE = -6;
const VEL_CLAMP = 6;
const SCROLL_SPEED = 1.8;
const SPAWN_INTERVAL_MS = 1650;
const PIPE_GAP_MIN = 200;
const PIPE_GAP_MAX = 240;
const GRACE_MS = 400;
const OBSTACLE_WIDTH = 56;
const PLAYER_SIZE = 36;
const ROT_JUMP = -18;
const ROT_FALL_MAX = 65;
const SCORE_POP_MS = 150;
const SCORE_POP_MAX = 1.15;
const DT_MAX = 0.033;
const CEILING_Y = 0;
const PLAYER_WIDTH = PLAYER_SIZE;
const PLAYER_HEIGHT = PLAYER_SIZE;

function rectOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

// ——— Canvas drawing (no assets) ———

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawGameCardBackground(ctx, totalScroll, timeSec) {
  const w = CANVAS_W;
  const h = CANVAS_H;
  const rad = 16;
  roundRect(ctx, 0, 0, w, h, rad);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#1e2228");
  g.addColorStop(0.4, "#181b21");
  g.addColorStop(1, "#0f1115");
  ctx.fillStyle = g;
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  roundRect(ctx, 0, 0, w, h, rad);
  ctx.stroke();

  ctx.fillStyle = "rgba(0,0,0,0.2)";
  roundRect(ctx, 2, 2, w - 4, h - 4, rad - 2);
  ctx.fill();

  const far = (totalScroll * 0.2) % 400;
  ctx.fillStyle = "rgba(30,34,42,0.5)";
  [0, 80, 200, 300].forEach((i) => ctx.fillRect((i + far) % (w + 60) - 20, 100, 22, 70));
  const mid = (totalScroll * 0.45) % 380;
  ctx.fillStyle = "rgba(24,28,35,0.45)";
  [40, 160, 260].forEach((i) => ctx.fillRect((i + mid) % (w + 50) - 15, 220, 18, 55));

  ctx.fillStyle = "#15171c";
  ctx.fillRect(0, GROUND_Y, w, h - GROUND_Y);

  const vig = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.75);
  vig.addColorStop(0, "transparent");
  vig.addColorStop(1, "rgba(0,0,0,0.4)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

function drawObstacle(ctx, x, topY, topH, bottomY, bottomH) {
  const r = 8;
  const metal = ctx.createLinearGradient(x, 0, x + OBSTACLE_WIDTH, 0);
  metal.addColorStop(0, "#8a8d95");
  metal.addColorStop(0.2, "#6e7179");
  metal.addColorStop(0.5, "#5a5d65");
  metal.addColorStop(0.8, "#6e7179");
  metal.addColorStop(1, "#8a8d95");
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = metal;
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 1;
  roundRect(ctx, x, topY, OBSTACLE_WIDTH, topH, r);
  ctx.fill();
  ctx.stroke();
  roundRect(ctx, x, bottomY, OBSTACLE_WIDTH, bottomH, r);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

function drawArm(ctx, centerX, drawY, rotationDeg, shadowScaleY) {
  const rad = (rotationDeg * Math.PI) / 180;
  ctx.save();
  ctx.translate(centerX, drawY);
  ctx.rotate(rad);

  const sy = 16 * Math.max(0.5, Math.min(1.5, 1 + (shadowScaleY || 0) * 0.12));
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(0, 12, 24, sy, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#2d1f14";
  ctx.lineWidth = 2;
  ctx.fillStyle = "#d4a574";
  ctx.beginPath();
  ctx.ellipse(-16, 0, 12, 16, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(6, -4, 9, 14, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#c4956a";
  ctx.fillRect(18, -7, 10, 12);
  ctx.strokeRect(18, -7, 10, 12);
  ctx.fillStyle = "#4a3528";
  ctx.fillRect(12, -5, 3, 8);
  ctx.fillRect(17, -4, 3, 6);
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath();
  ctx.moveTo(-20, -10);
  ctx.lineTo(-6, -12);
  ctx.lineTo(2, -14);
  ctx.lineTo(4, -12);
  ctx.lineTo(-8, -8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(-2, 8, 6, 5, 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawScore(ctx, score, popScale) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "900 28px system-ui, sans-serif";
  ctx.fillStyle = "#fff";
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.setTransform(popScale, 0, 0, popScale, CANVAS_W / 2, 24);
  ctx.fillText(String(score), 0, 0);
  ctx.restore();
}

function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}
function easeInQuad(t) {
  return t * t;
}
function scorePopScale(progress) {
  if (progress >= 1) return 1;
  if (progress < 0.5) return 1 + (SCORE_POP_MAX - 1) * easeOutQuad(progress * 2);
  return SCORE_POP_MAX - (SCORE_POP_MAX - 1) * easeInQuad((progress - 0.5) * 2);
}

// ——— Component ———

export default function FlappyArmGame({ game }) {
  const navigate = useNavigate();
  const toast = useToast();
  const canvasRef = useRef(null);
  const [bestScore, setBestScore] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);
  const [phase, setPhase] = useState("idle");
  const [score, setScore] = useState(0);
  const [scorePopStart, setScorePopStart] = useState(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  /** Overlay message: "login_required" | "score_sync_failed" | null */
  const [overlayError, setOverlayError] = useState(null);

  const stateRef = useRef(null);
  const lastTimeRef = useRef(0);
  const lastSpawnTimeRef = useRef(0);
  const scoreRef = useRef(0);
  const rafIdRef = useRef(null);
  const pausedRef = useRef(false);
  const phaseRef = useRef(phase);
  const submittedRef = useRef(false);
  scoreRef.current = score;
  phaseRef.current = phase;
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Load best score on mount from view (read-only)
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!alive || !u?.id) {
        if (alive) setLoadingStats(false);
        return;
      }
      const { data: row, error } = await supabase
        .from("arcade_flappy_arm_leaderboard")
        .select("best_score")
        .eq("user_id", u.id)
        .maybeSingle();
      if (error) {
        console.error("[FlappyArm] load best_score error:", error);
      }
      if (alive) setBestScore(row?.best_score ?? 0);
      if (alive) setLoadingStats(false);
    })();
    return () => { alive = false; };
  }, []);

  const handleGameOver = useCallback(async (finalScore) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setOverlayError(null);

    const { data: { user: userData } } = await supabase.auth.getUser();
    if (!userData?.user) {
      setOverlayError("login_required");
      setIsNewRecord(false);
      return;
    }

    const user = userData.user;
    const userId = user.id;

    // Insert ONE row into public.arcade_flappy_arm_scores only. Schema: user_id (uuid), score (int), is_pr (bool).
    const { error: insertError } = await supabase
      .from("arcade_flappy_arm_scores")
      .insert({
        user_id: userId,
        score: finalScore,
        is_pr: false,
      });

    if (insertError) {
      console.error("[FlappyArm] arcade_flappy_arm_scores insert error:", insertError);
      setOverlayError("score_sync_failed");
      setIsNewRecord(false);
      return;
    }

    // After insert success: refetch best from view and set UI (DB is source of truth)
    const { data: leaderboardRow, error: fetchError } = await supabase
      .from("arcade_flappy_arm_leaderboard")
      .select("best_score")
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchError) {
      console.error("[FlappyArm] arcade_flappy_arm_leaderboard fetch error:", fetchError);
    }

    const bestFromDb = leaderboardRow?.best_score != null ? Number(leaderboardRow.best_score) : finalScore;
    setBestScore(bestFromDb);
    const newRecord = finalScore >= bestFromDb;
    setIsNewRecord(newRecord);

    if (newRecord && toast?.success) {
      toast.success("🔥 NEW PERSONAL RECORD");
    }
  }, [toast]);

  const triggerGameOver = useCallback(() => {
    if (phaseRef.current === "over") return;
    const finalScore = scoreRef.current;
    phaseRef.current = "over";
    const s = stateRef.current;
    if (s) s.over = true;
    setPhase("over");
    setOverlayError(null);
    setIsNewRecord(false);
    handleGameOver(finalScore);
  }, [handleGameOver]);

  const startGame = useCallback(() => {
    submittedRef.current = false;
    const centerY = (GROUND_Y - PLAYER_SIZE) / 2;
    stateRef.current = {
      y: centerY,
      vy: 0,
      rotation: ROT_JUMP,
      graceUntil: Date.now() + GRACE_MS,
      obstacles: [],
      totalScroll: 0,
      passed: new Set(),
    };
    lastSpawnTimeRef.current = performance.now();
    lastTimeRef.current = performance.now();
    setPhase("playing");
    setScore(0);
    setScorePopStart(null);
    setIsNewRecord(false);
    setOverlayError(null);
  }, []);

  const playAgain = useCallback(() => {
    stateRef.current = null;
    lastSpawnTimeRef.current = performance.now();
    setScore(0);
    setPhase("idle");
    setScorePopStart(null);
    submittedRef.current = false;
    setIsNewRecord(false);
    setOverlayError(null);
  }, []);

  const onTap = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    const s = stateRef.current;
    if (!s) return;
    s.vy = JUMP_FORCE;
    s.rotation = ROT_JUMP;
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      pausedRef.current = document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let ctx;
    try {
      ctx = canvas.getContext("2d");
    } catch (e) {
      console.error(e);
      return;
    }
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;

    const triggerOver = triggerGameOver;

    function frame(now) {
      rafIdRef.current = requestAnimationFrame(frame);
      try {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

        const s = stateRef.current;
        const currentPhase = phaseRef.current;

        if (currentPhase === "idle") {
          drawGameCardBackground(ctx, 0, now / 1000);
          drawScore(ctx, 0, 1);
          return;
        }

        if (currentPhase === "over") {
          drawGameCardBackground(ctx, s?.totalScroll ?? 0, now / 1000);
          (s?.obstacles ?? []).forEach((ob) =>
            drawObstacle(ctx, ob.x, 0, ob.topH, ob.bottomY, ob.bottomH)
          );
          if (s) {
            const drawY = s.y + PLAYER_SIZE / 2;
            drawArm(ctx, CANVAS_W / 2, drawY, s.rotation, s.vy * 0.1);
          }
          drawScore(ctx, scoreRef.current, 1);
          return;
        }

        if (currentPhase !== "playing" || !s) {
          drawGameCardBackground(ctx, s?.totalScroll ?? 0, now / 1000);
          drawScore(ctx, scoreRef.current, 1);
          return;
        }

        const dt = Math.min(DT_MAX, (now - lastTimeRef.current) / 1000);
        lastTimeRef.current = now;

        if (pausedRef.current) {
          drawGameCardBackground(ctx, s.totalScroll, now / 1000);
          s.obstacles.forEach((ob) =>
            drawObstacle(ctx, ob.x, 0, ob.topH, ob.bottomY, ob.bottomH)
          );
          const drawY = s.y + PLAYER_SIZE / 2;
          drawArm(ctx, CANVAS_W / 2, drawY, s.rotation, s.vy * 0.1);
          const popProg = scorePopStart ? Math.min(1, (now - scorePopStart) / SCORE_POP_MS) : 1;
          drawScore(ctx, scoreRef.current, popProg < 1 ? scorePopScale(popProg) : 1);
          return;
        }

        s.vy += GRAVITY;
        s.vy = Math.max(-VEL_CLAMP, Math.min(VEL_CLAMP, s.vy));
        s.y += s.vy;
        s.rotation = s.vy < 0 ? ROT_JUMP : Math.min(ROT_FALL_MAX, s.rotation + 3.5);

        s.totalScroll += SCROLL_SPEED;
        if (now - lastSpawnTimeRef.current >= SPAWN_INTERVAL_MS) {
          lastSpawnTimeRef.current = now;
          const gap = PIPE_GAP_MIN + Math.random() * (PIPE_GAP_MAX - PIPE_GAP_MIN);
          const gapCenter = 140 + Math.random() * (GROUND_Y - 280 - gap);
          s.obstacles.push({
            x: CANVAS_W + OBSTACLE_WIDTH,
            topH: gapCenter - gap / 2,
            bottomY: gapCenter + gap / 2,
            bottomH: CANVAS_H - (gapCenter + gap / 2),
            id: now + Math.random(),
          });
        }
        s.obstacles.forEach((ob) => {
          ob.x -= SCROLL_SPEED;
        });
        s.obstacles = s.obstacles.filter((ob) => ob.x + OBSTACLE_WIDTH > 0);

        const playerX = CANVAS_W / 2;
        const playerY = s.y;
        const dateNow = Date.now();
        const inGrace = dateNow < s.graceUntil;

        if (!inGrace) {
          if (playerY + PLAYER_HEIGHT > GROUND_Y || playerY < CEILING_Y) {
            triggerOver();
            return;
          }
          const playerBox = {
            x: playerX - PLAYER_WIDTH / 2,
            y: playerY,
            w: PLAYER_WIDTH,
            h: PLAYER_HEIGHT,
          };
          for (const ob of s.obstacles) {
            const topPipeBox = { x: ob.x, y: 0, w: OBSTACLE_WIDTH, h: ob.topH };
            const bottomPipeBox = { x: ob.x, y: ob.bottomY, w: OBSTACLE_WIDTH, h: ob.bottomH };
            if (rectOverlap(playerBox, topPipeBox) || rectOverlap(playerBox, bottomPipeBox)) {
              triggerOver();
              break;
            }
          }
        }

        if (phaseRef.current === "over") {
          drawGameCardBackground(ctx, s.totalScroll, now / 1000);
          s.obstacles.forEach((ob) =>
            drawObstacle(ctx, ob.x, 0, ob.topH, ob.bottomY, ob.bottomH)
          );
          const drawY = s.y + PLAYER_SIZE / 2;
          drawArm(ctx, CANVAS_W / 2, drawY, s.rotation, s.vy * 0.1);
          drawScore(ctx, scoreRef.current, 1);
          return;
        }

        s.obstacles.forEach((ob) => {
          const obstacleCenterX = ob.x + OBSTACLE_WIDTH / 2;
          if (!s.passed.has(ob.id) && playerX > obstacleCenterX) {
            s.passed.add(ob.id);
            setScore((n) => n + 1);
            setScorePopStart(now);
          }
        });

        drawGameCardBackground(ctx, s.totalScroll, now / 1000);
        s.obstacles.forEach((ob) =>
          drawObstacle(ctx, ob.x, 0, ob.topH, ob.bottomY, ob.bottomH)
        );
        const drawY = s.y + PLAYER_SIZE / 2;
        drawArm(ctx, CANVAS_W / 2, drawY, s.rotation, s.vy * 0.1);
        const popProg = scorePopStart ? Math.min(1, (now - scorePopStart) / SCORE_POP_MS) : 1;
        drawScore(ctx, scoreRef.current, popProg < 1 ? scorePopScale(popProg) : 1);
      } catch (e) {
        console.error("FlappyArm frame:", e);
      }
    }

    lastTimeRef.current = performance.now();
    lastSpawnTimeRef.current = lastTimeRef.current;
    rafIdRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [phase, triggerGameOver, scorePopStart]);

  return (
    <div style={styles.wrap}>
      <style>{`@keyframes newRecordPulse { from { transform: scale(1); } to { transform: scale(1.08); } }`}</style>
      <button type="button" onClick={() => navigate("/games")} style={styles.backBtn}>
        ← Games
      </button>
      <div style={styles.header}>
        <h2 style={styles.title}>{game?.title ?? "Flappy Arm"}</h2>
        <button
          type="button"
          onClick={() => navigate("/games/leaderboard?game_type=flappy_arm")}
          style={styles.leaderboardBtn}
        >
          Leaderboard
        </button>
      </div>

      {phase === "idle" && (
        <div style={styles.section}>
          <p style={styles.instruction}>Tap to raise your arm. Avoid the obstacles!</p>
          <p style={styles.difficulty}>400ms grace after start</p>
          <button type="button" style={styles.primaryBtn} onClick={startGame}>
            Start
          </button>
        </div>
      )}

      {(phase === "playing" || phase === "over") && (
        <div style={styles.scoreBar}>
          <span>Score: {score}</span>
          {!loadingStats && <span>Best: {bestScore}</span>}
        </div>
      )}

      <div style={styles.canvasWrap}>
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
      </div>

      {phase === "over" && (
        <div style={styles.overlay}>
          <div style={styles.overlayCard}>
            <h3 style={styles.overlayTitle}>Game Over</h3>
            <p style={styles.overlayScore}>Score: {score}</p>
            <p style={styles.overlayBest}>Best: {bestScore}</p>
            {overlayError === "login_required" && (
              <p style={styles.overlayError}>Login required to save scores</p>
            )}
            {overlayError === "score_sync_failed" && (
              <p style={styles.overlayError}>Score sync failed</p>
            )}
            {isNewRecord && !overlayError && (
              <p
                style={{
                  ...styles.newRecordBadge,
                  animation: "newRecordPulse 0.6s ease-in-out infinite alternate",
                }}
              >
                NEW RECORD!
              </p>
            )}
            <button type="button" style={styles.primaryBtn} onClick={playAgain}>
              Play Again
            </button>
            <button type="button" style={styles.secondaryBtn} onClick={() => navigate("/games")}>
              Back to Games
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: {
    position: "relative",
    padding: "20px 16px 90px",
    maxWidth: "400px",
    margin: "0 auto",
  },
  backBtn: {
    marginBottom: 12,
    padding: "8px 0",
    background: "none",
    border: "none",
    color: "var(--text-dim)",
    fontSize: 14,
    cursor: "pointer",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
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
  scoreBar: {
    display: "flex",
    justifyContent: "space-between",
    padding: "10px 0",
    fontSize: 15,
    fontWeight: 700,
    color: "var(--text)",
  },
  canvasWrap: {
    position: "relative",
    display: "inline-block",
    margin: "0 auto",
    maxWidth: CANVAS_W,
  },
  canvas: {
    display: "block",
    width: "100%",
    maxWidth: CANVAS_W,
    borderRadius: 16,
    border: "1px solid var(--border)",
    background: "#0f1115",
  },
  section: { textAlign: "center", marginTop: 24 },
  instruction: { color: "var(--text-dim)", fontSize: 14, margin: "0 0 8px" },
  difficulty: { color: "var(--text-dim)", fontSize: 12, margin: "0 0 20px" },
  primaryBtn: {
    padding: "14px 28px",
    borderRadius: 12,
    border: "none",
    background: "var(--accent)",
    color: "#fff",
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
    background: "linear-gradient(165deg, var(--card) 0%, var(--card-2) 100%)",
    borderRadius: 20,
    padding: 28,
    border: "1px solid var(--border)",
    textAlign: "center",
    maxWidth: 320,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.4)",
  },
  overlayTitle: { fontSize: 22, fontWeight: 900, margin: "0 0 16px", color: "var(--text)" },
  overlayScore: { fontSize: 18, fontWeight: 700, margin: "0 0 4px", color: "var(--text)" },
  overlayBest: { fontSize: 14, color: "var(--text-dim)", margin: "0 0 12px" },
  overlayError: {
    fontSize: 13,
    fontWeight: 700,
    color: "#c00",
    margin: "0 0 12px",
  },
  newRecordBadge: {
    fontSize: 18,
    fontWeight: 800,
    color: "#c00",
    margin: "0 0 16px",
  },
};
