/**
 * FlappyArm — main entry. Jetpack Joyride–level clarity. Physics + Renderer + Juice.
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { useToast } from "../../components/ToastProvider";
import { loadAllAssets, getLoadStatus } from "./assets.js";
import { createState, stepPhysics, applyFlap, startGame, getVisualRotation } from "./physics.js";
import { drawFrame, drawDebugOverlay } from "./renderer.js";
import {
  getShakeOffset,
  getFlapBounceOffset,
  getScorePopScale,
  createWhooshParticles,
  createScoreBurstParticles,
  stepParticles,
} from "./juice.js";
import { CANVAS_W, CANVAS_H, PLAYER, SHAKE_ON_HIT_PX, FREEZE_FRAME_MS, FLAP_CAMERA_BOUNCE_PX, SCORE_POP_MS, PALETTE } from "./constants.js";
import {
  ScoreBar,
  GameOverOverlay,
  IdleScreen,
  DebugOverlay,
  styles,
} from "./uiOverlay.jsx";

export default function FlappyArmGame({ game }) {
  const navigate = useNavigate();
  const toast = useToast();
  const canvasRef = useRef(null);
  const [user, setUser] = useState(null);
  const [arcadeStats, setArcadeStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [assetsReady, setAssetsReady] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [score, setScore] = useState(0);
  const [showPrInOverlay, setShowPrInOverlay] = useState(false);
  const [debug, setDebug] = useState(false);
  const [fps, setFps] = useState(0);
  const [scorePopStart, setScorePopStart] = useState(null);
  const [flapBounceStart, setFlapBounceStart] = useState(null);
  const [redFlashEnd, setRedFlashEnd] = useState(null);
  const [freezeEnd, setFreezeEnd] = useState(null);

  const stateRef = useRef(createState());
  const particlesRef = useRef([]);
  const shakeRemainingRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const fpsFrameCountRef = useRef(0);
  const fpsLastTimeRef = useRef(0);
  const scoreRef = useRef(0);
  scoreRef.current = score;

  const loadArcadeStats = useCallback(async (userId) => {
    if (!userId) return;
    const { data } = await supabase
      .from("arcade_user_stats")
      .select("flappy_best_score, flappy_total_games, flappy_last_score")
      .eq("user_id", userId)
      .single();
    setArcadeStats(data || null);
    setLoadingStats(false);
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (alive) setUser(u ?? null);
    });
    loadAllAssets()
      .then((result) => {
        if (alive) setAssetsReady(result.ready !== false);
      })
      .catch(() => {
        if (alive) setAssetsReady(true);
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setLoadingStats(false);
      return;
    }
    loadArcadeStats(user.id);
  }, [user?.id, loadArcadeStats]);

  const startGameClick = useCallback(() => {
    const state = stateRef.current;
    startGame(state);
    setPhase("playing");
    setScore(0);
    setShowPrInOverlay(false);
    particlesRef.current = [];
    shakeRemainingRef.current = 0;
    setScorePopStart(null);
    setFlapBounceStart(null);
    setRedFlashEnd(null);
    setFreezeEnd(null);
  }, []);

  const onTap = useCallback(() => {
    if (phase !== "playing") return;
    const state = stateRef.current;
    applyFlap(state);
    setFlapBounceStart(Date.now());
    const cx = CANVAS_W / 2;
    const py = state.y + PLAYER.size / 2;
    particlesRef.current = particlesRef.current.concat(
      createWhooshParticles(4, cx, py)
    );
  }, [phase]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === "KeyD" && !e.repeat) setDebug((d) => !d);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (phase !== "playing" || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const state = stateRef.current;
    const smoothFactor = 0.35;

    let rafId;
    function frame(now) {
      try {
        const dt = Math.min(0.05, (now - lastFrameTimeRef.current) / 1000);
        lastFrameTimeRef.current = now;

        if (fpsLastTimeRef.current === 0) fpsLastTimeRef.current = now;
        fpsFrameCountRef.current++;
        if (now - fpsLastTimeRef.current >= 500) {
          setFps(Math.round((fpsFrameCountRef.current * 1000) / (now - fpsLastTimeRef.current)));
          fpsFrameCountRef.current = 0;
          fpsLastTimeRef.current = now;
        }

        const freeze = freezeEnd && now < freezeEnd;
        if (freeze) {
          rafId = requestAnimationFrame(frame);
          return;
        }

        const result = stepPhysics(state, now, false);
        state.prevY = state.prevY !== undefined ? state.prevY + (state.y - state.prevY) * smoothFactor : state.y;
        state.prevRot = state.prevRot !== undefined
          ? state.prevRot + (getVisualRotation(state.vy, state.rotation) - state.prevRot) * smoothFactor
          : state.rotation;

        if (result.scored) {
          setScore((s) => s + 1);
          const cx = CANVAS_W / 2;
          const py = state.y + PLAYER.size / 2;
          particlesRef.current = particlesRef.current.concat(
            createScoreBurstParticles(cx, py, 6)
          );
          setScorePopStart(Date.now());
        }

        if (result.hitObstacle || result.hitGround) {
          setPhase("over");
          shakeRemainingRef.current = 12;
          const flashEnd = Date.now() + 200;
          setRedFlashEnd(flashEnd);
          setFreezeEnd(Date.now() + FREEZE_FRAME_MS);
          setTimeout(() => setRedFlashEnd(null), 220);
          const finalScore = scoreRef.current;
          if (user?.id) {
            (async () => {
              const { data } = await supabase.rpc("record_flappy_arm_score", {
                user_id: user.id,
                score: finalScore,
              });
              if (data?.is_pr === true) {
                setShowPrInOverlay(true);
                if (toast?.success) toast.success("🔥 NEW PERSONAL RECORD");
              }
              if (game?.id) {
                await supabase.from("user_game_scores").insert({
                  user_id: user.id,
                  game_id: game.id,
                  score: finalScore,
                });
                const { data: existingBest } = await supabase
                  .from("user_game_best")
                  .select("*")
                  .eq("user_id", user.id)
                  .eq("game_id", game.id)
                  .maybeSingle();
                if (!existingBest || finalScore > (existingBest.best_score ?? 0)) {
                  await supabase.from("user_game_best").upsert(
                    { user_id: user.id, game_id: game.id, best_score: finalScore, updated_at: new Date().toISOString() },
                    { onConflict: "user_id,game_id" }
                  );
                }
              }
              await supabase.rpc("increment_arcade_stats", {
                p_user_id: user.id,
                p_game_id: "flappy_arm",
                p_score: finalScore,
              });
              await loadArcadeStats(user.id);
            })();
          }
          rafId = requestAnimationFrame(frame);
          return;
        }

        particlesRef.current = stepParticles(particlesRef.current, 0.016);

        let shakeX = 0,
          shakeY = 0;
        if (shakeRemainingRef.current > 0) {
          const s = getShakeOffset(shakeRemainingRef.current, SHAKE_ON_HIT_PX);
          shakeX = s.x;
          shakeY = s.y;
          shakeRemainingRef.current--;
        } else if (flapBounceStart && now - flapBounceStart < 120) {
          const prog = (now - flapBounceStart) / 120;
          const up = 1 - Math.min(1, prog * 4);
          shakeY = -FLAP_CAMERA_BOUNCE_PX * up;
        }

        const scorePopProgress = scorePopStart ? Math.min(1, (now - scorePopStart) / SCORE_POP_MS) : 1;
        const scorePopScale = scorePopProgress < 1 ? getScorePopScale(scorePopProgress) : 1;

        drawFrame(ctx, state, particlesRef.current, shakeX, shakeY, scoreRef.current, scorePopScale);
        if (debug) drawDebugOverlay(ctx, state);
      } catch (e) {
        console.error("FlappyArm frame error:", e);
      }
      rafId = requestAnimationFrame(frame);
    }
    lastFrameTimeRef.current = performance.now();
    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [phase, score, user?.id, game?.id, toast, loadArcadeStats, debug, freezeEnd, flapBounceStart, scorePopStart]);

  const bestScore = arcadeStats?.flappy_best_score ?? 0;

  return (
    <div style={styles.wrap}>
      <button type="button" onClick={() => navigate("/games")} style={styles.backBtn}>
        ← Games
      </button>
      <div style={styles.header}>
        <h2 style={styles.title}>{game?.title ?? "Flappy Arm"}</h2>
        <button
          type="button"
          onClick={() => navigate(`/games/leaderboard?game_type=flappy_arm`)}
          style={styles.leaderboardBtn}
        >
          Leaderboard
        </button>
      </div>

      {phase === "idle" && (
        <>
          {!assetsReady && <p style={{ textAlign: "center", color: "var(--text-dim)", fontSize: 14 }}>Loading assets…</p>}
          <IdleScreen onStart={startGameClick} disabled={!assetsReady} />
        </>
      )}

      {(phase === "playing" || phase === "over") && (
        <>
          <ScoreBar score={score} bestScore={bestScore} loadingStats={loadingStats} />
          <div style={styles.canvasWrap}>
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              style={{
                display: "block",
                width: "100%",
                maxWidth: CANVAS_W,
                borderRadius: 16,
                border: "1px solid var(--border)",
                background: PALETTE.bgBottom,
              }}
              onClick={onTap}
              onTouchStart={(e) => {
                e.preventDefault();
                onTap();
              }}
            />
            {redFlashEnd != null && Date.now() < redFlashEnd && (
              <div
                key="flash"
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(230,57,70,0.25)",
                  pointerEvents: "none",
                  borderRadius: 16,
                }}
              />
            )}
            <DebugOverlay fps={fps} assetStatus={getLoadStatus()} show={debug} />
          </div>
        </>
      )}

      {phase === "over" && (
        <GameOverOverlay
          score={score}
          bestScore={bestScore}
          isNewRecord={showPrInOverlay}
          onPlayAgain={startGameClick}
          onBack={() => navigate("/games")}
        />
      )}
    </div>
  );
}
