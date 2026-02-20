/**
 * ArmPal Arena — 3D game scene (Babylon.js) + React HUD overlay
 */
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Engine,
  Scene,
  ArcRotateCamera,
  HemisphericLight,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Ray,
  DirectionalLight,
} from "@babylonjs/core";
import Joystick from "./controls/Joystick";
import LookTouch from "./controls/LookTouch";
import HUD from "./ui/HUD";
import Scoreboard from "./ui/Scoreboard";
import EndScreen from "./ui/EndScreen";
import { subscribeArena, broadcastSnapshot, broadcastHit } from "./arenaNet";
import { endMatch, updateMatchPlayerKillsDeaths, persistMatchResult } from "./arenaDb";

const ARENA_SIZE = 24;
const WALL_H = 4;
const COVER_COUNT = 10;
const SPAWN1 = new Vector3(-8, 0, -8);
const SPAWN2 = new Vector3(8, 0, 8);
const PISTOL_DAMAGE = 25;
const PISTOL_COOLDOWN_MS = 350;
const MATCH_DURATION_S = 90;
const KILLS_TO_WIN = 7;
const RESPAWN_DELAY_MS = 2000;
const CAMERA_RADIUS = 14;

const loadingStyle = {
  position: "relative",
  width: "100%",
  height: "100vh",
  background: "#000",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  fontWeight: 700,
};
const errorStyle = { ...loadingStyle, color: "#f44" };

export default function ArenaGame({
  matchId,
  myUserId,
  mySlot,
  opponentUserId,
  onExit,
}) {
  console.log("Arena params:", { matchId, myUserId, mySlot, opponentUserId });

  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const localMeshRef = useRef(null);
  const remoteMeshRef = useRef(null);
  const lastSnapshotRef = useRef(0);
  const lastShotRef = useRef(0);
  const moveInputRef = useRef({ x: 0, z: 0 });
  const lookRef = useRef({ yaw: 0, pitch: 0 });
  const killsRef = useRef(0);
  const enemyKillsRef = useRef(0);

  const [gameError, setGameError] = useState(null);
  const [health, setHealth] = useState(100);
  const [kills, setKills] = useState(0);
  const [deaths, setDeaths] = useState(0);
  const [enemyKills, setEnemyKills] = useState(0);
  const [timeLeft, setTimeLeft] = useState(MATCH_DURATION_S);
  const [gameEnded, setGameEnded] = useState(false);
  const [won, setWon] = useState(false);
  const [dead, setDead] = useState(false);

  killsRef.current = kills;
  enemyKillsRef.current = enemyKills;

  const onMove = useCallback((x, z) => {
    moveInputRef.current = { x, z };
  }, []);
  const onLookDelta = useCallback((dx, dy) => {
    lookRef.current.yaw -= dx * 0.003;
    lookRef.current.pitch = Math.max(-0.8, Math.min(0.8, lookRef.current.pitch - dy * 0.003));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.warn("Arena: canvas not ready");
      return;
    }
    if (!matchId || !myUserId) return;

    console.log("Arena initGame running");

    try {
      const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
      engineRef.current = engine;
      const scene = new Scene(engine);
      sceneRef.current = scene;
      scene.gravity = new Vector3(0, -20, 0);
      scene.collisionsEnabled = true;

      const camera = new ArcRotateCamera(
        "cam",
        Math.PI / 2,
        Math.PI / 2.2,
        CAMERA_RADIUS,
        Vector3.Zero(),
        scene
      );
      camera.attachControl(canvas, false);
      camera.inputs.clear();
      camera.lowerRadiusLimit = 8;
      camera.upperRadiusLimit = 22;
      cameraRef.current = camera;

      const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
      hemi.intensity = 0.6;
      const dir = new DirectionalLight("dir", new Vector3(-1, -2, -1), scene);
      dir.position = new Vector3(20, 40, 20);
      dir.intensity = 0.8;

      const ground = MeshBuilder.CreateGround(
        "ground",
        { width: ARENA_SIZE * 2, height: ARENA_SIZE * 2 },
        scene
      );
      ground.position.y = 0;
      const groundMat = new StandardMaterial("groundMat", scene);
      groundMat.diffuseColor = new Color3(0.12, 0.12, 0.12);
      ground.material = groundMat;
      ground.checkCollisions = true;

      const wallMat = new StandardMaterial("wallMat", scene);
      wallMat.diffuseColor = new Color3(0.18, 0.08, 0.08);
      const w = ARENA_SIZE;
      const walls = [
        { p: [w, WALL_H / 2, 0], s: [2, WALL_H, w * 2] },
        { p: [-w, WALL_H / 2, 0], s: [2, WALL_H, w * 2] },
        { p: [0, WALL_H / 2, w], s: [w * 2, WALL_H, 2] },
        { p: [0, WALL_H / 2, -w], s: [w * 2, WALL_H, 2] },
      ];
      walls.forEach(({ p, s }, i) => {
        const box = MeshBuilder.CreateBox(`wall_${i}`, { width: s[0], height: s[1], depth: s[2] }, scene);
        box.position.set(p[0], p[1], p[2]);
        box.material = wallMat;
        box.checkCollisions = true;
      });

      for (let i = 0; i < COVER_COUNT; i++) {
        const x = (Math.random() - 0.5) * ARENA_SIZE * 1.5;
        const z = (Math.random() - 0.5) * ARENA_SIZE * 1.5;
        const box = MeshBuilder.CreateBox(`cover_${i}`, { width: 3, height: 1.5, depth: 2 }, scene);
        box.position.set(x, 0.75, z);
        const coverMat = new StandardMaterial(`coverMat_${i}`, scene);
        coverMat.diffuseColor = new Color3(0.2, 0.15, 0.15);
        box.material = coverMat;
        box.checkCollisions = true;
      }

      const capsuleOpts = { height: 1.8, radius: 0.4 };
      const localCapsule = MeshBuilder.CreateCapsule("localPlayer", capsuleOpts, scene);
      localCapsule.position.copyFrom(mySlot === 1 ? SPAWN1 : SPAWN2);
      localCapsule.checkCollisions = true;
      localCapsule.ellipsoid = new Vector3(0.4, 0.9, 0.4);
      localCapsule.ellipsoidOffset = new Vector3(0, 0.9, 0);
      const localMat = new StandardMaterial("localMat", scene);
      localMat.diffuseColor = new Color3(0.2, 0.25, 0.5);
      localCapsule.material = localMat;
      localMeshRef.current = localCapsule;

      const remoteCapsule = MeshBuilder.CreateCapsule("remotePlayer", capsuleOpts, scene);
      remoteCapsule.position.copyFrom(mySlot === 1 ? SPAWN2 : SPAWN1);
      const remoteMat = new StandardMaterial("remoteMat", scene);
      remoteMat.diffuseColor = new Color3(0.5, 0.15, 0.15);
      remoteMat.emissiveColor = new Color3(0.15, 0, 0);
      remoteCapsule.material = remoteMat;
      remoteMeshRef.current = remoteCapsule;

      const moveSpeed = 12;
      scene.onBeforeRenderObservable.add(() => {
        const dt = engine.getDeltaTime() / 1000;
        const local = localMeshRef.current;
        const cam = cameraRef.current;
        if (!local) return;
        if (!dead) {
          const { x, z } = moveInputRef.current;
          const fwd = new Vector3(Math.sin(lookRef.current.yaw), 0, Math.cos(lookRef.current.yaw));
          const right = new Vector3(fwd.z, 0, -fwd.x);
          const move = right.scale(x).add(fwd.scale(z)).normalize().scale(moveSpeed * dt);
          local.position.addInPlace(move);
          local.rotation.y = lookRef.current.yaw;
        }
        if (cam) {
          cam.target.copyFrom(local.position);
          cam.target.y += 1;
          cam.alpha = lookRef.current.yaw;
          cam.beta = Math.PI / 2 - lookRef.current.pitch;
          cam.radius = CAMERA_RADIUS;
        }
      });

      engine.runRenderLoop(() => scene.render());
      const resize = () => engine.resize();
      window.addEventListener("resize", resize);
      return () => {
        window.removeEventListener("resize", resize);
        scene.dispose();
        engine.dispose();
      };
    } catch (e) {
      console.error("ARENA GAME CRASH:", e);
      setGameError(e);
    }
  }, [matchId, myUserId, mySlot, dead]);

  useEffect(() => {
    if (!matchId || !opponentUserId) return;
    const unsub = subscribeArena(matchId, (payload) => {
      if (payload.type === "snapshot" && payload.userId === opponentUserId) {
        const remote = remoteMeshRef.current;
        if (remote && payload.pos) {
          remote.position.set(payload.pos[0], payload.pos[1], payload.pos[2]);
          remote.rotation.y = payload.rotY ?? 0;
        }
        setEnemyKills(payload.kills ?? 0);
      }
      if (payload.type === "hit" && payload.victimId === myUserId) {
        setHealth((h) => {
          const dmg = payload.damage ?? PISTOL_DAMAGE;
          const next = Math.max(0, h - dmg);
          if (next <= 0) {
            setDead(true);
            setDeaths((d) => d + 1);
            setTimeout(() => {
              setHealth(100);
              setDead(false);
              const local = localMeshRef.current;
              if (local) local.position.copyFrom(mySlot === 1 ? SPAWN1 : SPAWN2);
            }, RESPAWN_DELAY_MS);
          }
          return next;
        });
      }
    });
    return () => unsub && unsub();
  }, [matchId, myUserId, opponentUserId, mySlot]);

  const fire = useCallback(() => {
    if (dead || gameEnded) return;
    const now = Date.now();
    if (now - lastShotRef.current < PISTOL_COOLDOWN_MS) return;
    lastShotRef.current = now;
    const scene = sceneRef.current;
    const local = localMeshRef.current;
    const remote = remoteMeshRef.current;
    if (!scene || !local || !remote) return;
    const origin = local.position.clone();
    origin.y += 1;
    const fwd = new Vector3(
      Math.sin(lookRef.current.yaw),
      -lookRef.current.pitch,
      Math.cos(lookRef.current.yaw)
    ).normalize();
    const ray = new Ray(origin, fwd, 80);
    const hit = scene.pickWithRay(ray);
    const hitEnemy = hit?.hit && hit.pickedMesh === remote;
    if (hitEnemy) {
      broadcastHit(matchId, { shooterId: myUserId, victimId: opponentUserId, damage: PISTOL_DAMAGE });
      setKills((k) => {
        const next = k + 1;
        if (next >= KILLS_TO_WIN) {
          setGameEnded(true);
          setWon(true);
        }
        return next;
      });
    }
  }, [matchId, myUserId, opponentUserId, dead, gameEnded]);

  useEffect(() => {
    if (!matchId) return;
    const t = setInterval(() => {
      if (gameEnded) return;
      const now = Date.now();
      if (now - lastSnapshotRef.current < 100) return;
      lastSnapshotRef.current = now;
      const local = localMeshRef.current;
      if (!local || dead) return;
      broadcastSnapshot(matchId, {
        userId: myUserId,
        pos: [local.position.x, local.position.y, local.position.z],
        rotY: lookRef.current.yaw,
        pitch: lookRef.current.pitch,
        health,
        kills,
        deaths,
      });
    }, 100);
    return () => clearInterval(t);
  }, [matchId, myUserId, health, kills, deaths, dead, gameEnded]);

  useEffect(() => {
    if (gameEnded) return;
    const start = Date.now();
    const iv = setInterval(() => {
      const left = Math.max(0, MATCH_DURATION_S - (Date.now() - start) / 1000);
      setTimeLeft(left);
      if (left <= 0) {
        setGameEnded(true);
        setWon(killsRef.current > enemyKillsRef.current);
      }
    }, 500);
    return () => clearInterval(iv);
  }, [gameEnded]);

  useEffect(() => {
    if (!gameEnded || !matchId) return;
    (async () => {
      try {
        const winnerId = won ? myUserId : opponentUserId;
        await endMatch(matchId, winnerId);
        await updateMatchPlayerKillsDeaths(matchId, myUserId, kills, deaths);
        await updateMatchPlayerKillsDeaths(matchId, opponentUserId, enemyKills, kills);
        await persistMatchResult(matchId, myUserId);
      } catch (e) {
        console.error("Persist match result", e);
      }
    })();
  }, [gameEnded, matchId, won, myUserId, opponentUserId, kills, deaths, enemyKills]);

  if (!matchId || !myUserId || mySlot == null || !opponentUserId) {
    return <div style={loadingStyle}>Loading arena…</div>;
  }

  if (gameError) {
    return (
      <div style={errorStyle}>
        <div>
          <div>Game failed to load</div>
          <div style={{ fontSize: 14, marginTop: 8, fontWeight: 400 }}>{String(gameError.message || gameError)}</div>
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              style={{ marginTop: 16, padding: "10px 20px", cursor: "pointer" }}
            >
              Back to Lobby
            </button>
          )}
        </div>
      </div>
    );
  }

  try {
    return (
      <div style={{ position: "relative", width: "100%", height: "100vh", background: "#000" }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
        <HUD health={health} kills={kills} deaths={deaths} timeLeft={timeLeft} />
        <Scoreboard slot1Kills={kills} slot2Kills={enemyKills} />
        <LookTouch onLookDelta={onLookDelta} />
        <Joystick onMove={onMove} />
        <button
          type="button"
          style={{
            position: "absolute",
            right: 16,
            bottom: 100,
            width: 72,
            height: 72,
            borderRadius: "50%",
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 800,
            cursor: "pointer",
            zIndex: 15,
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            fire();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            fire();
          }}
        >
          FIRE
        </button>
        <button
          type="button"
          style={{
            position: "absolute",
            right: 16,
            bottom: 190,
            width: 56,
            height: 56,
            borderRadius: "50%",
            border: "2px solid var(--border)",
            background: "var(--card-2)",
            color: "var(--text)",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            zIndex: 15,
          }}
        >
          JUMP
        </button>
        {gameEnded && <EndScreen won={won} kills={kills} deaths={deaths} onExit={onExit} />}
      </div>
    );
  } catch (e) {
    console.error("ARENA GAME CRASH:", e);
    return (
      <div style={errorStyle}>
        Game failed to load
      </div>
    );
  }
}
