/**
 * ArmPal Arena — gameplay rebuild: settings-driven input, first-person camera,
 * hand-built arena, hitscan shooting, health/respawn, crosshair/hit marker, sync + interpolation.
 */
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Engine,
  Scene,
  FreeCamera,
  HemisphericLight,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Ray,
  DirectionalLight,
} from "@babylonjs/core";
import { getDefaultArenaSettings } from "./arenaDb";
import Joystick from "./controls/Joystick";
import LookTouch from "./controls/LookTouch";
import HUD from "./ui/HUD";
import Scoreboard from "./ui/Scoreboard";
import EndScreen from "./ui/EndScreen";
import Crosshair from "./ui/Crosshair";
import HitMarker from "./ui/HitMarker";
import { subscribeArena, broadcastSnapshot, broadcastHit } from "./arenaNet";
import { endMatch, updateMatchPlayerKillsDeaths, persistMatchResult } from "./arenaDb";

const ARENA_HALF = 12;
const WALL_H = 4;
const HEAD_HEIGHT = 1.6;
const SPAWN1 = new Vector3(-6, 0, -6);
const SPAWN2 = new Vector3(6, 0, 6);
const HIT_DAMAGE = 20;
const FIRE_COOLDOWN_MS = 200;
const MATCH_DURATION_S = 90;
const KILLS_TO_WIN = 7;
const RESPAWN_DELAY_MS = 2000;
const MOVE_SPEED = 10;
const SPRINT_MULT = 1.5;
const JUMP_FORCE = 8;
const GRAVITY = -24;
const REMOTE_LERP = 0.2;

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
  settings: settingsProp,
  onExit,
  onMatchEnd,
}) {
  const settings = { ...getDefaultArenaSettings(), ...settingsProp };
  const sensX = Number(settings.look_sensitivity_x) || 0.002;
  const sensY = Number(settings.look_sensitivity_y) || 0.002;
  const invertY = !!settings.invert_y_axis;
  const touchSens = Number(settings.touch_sensitivity) || 1;
  const fov = Math.max(60, Math.min(110, Number(settings.fov) || 85));
  const crosshairStyle = settings.crosshair_style || "cross";
  const sprintToggle = !!settings.sprint_toggle;
  const deadzone = Math.max(0.05, Math.min(0.4, Number(settings.controller_deadzone) || 0.15));
  const gamepadSens = Number(settings.controller_sensitivity) || 1;

  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const localMeshRef = useRef(null);
  const remoteMeshRef = useRef(null);
  const lastSnapshotRef = useRef(0);
  const lastShotRef = useRef(0);
  const moveInputRef = useRef({ x: 0, z: 0 });
  const keysRef = useRef({ w: false, a: false, s: false, d: false, shift: false, space: false });
  const lookRef = useRef({ yaw: 0, pitch: 0 });
  const velocityYRef = useRef(0);
  const groundedRef = useRef(false);
  const remoteTargetRef = useRef({ x: 0, y: 0, z: 0, rotY: 0 });
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
  const [showHitMarker, setShowHitMarker] = useState(false);

  killsRef.current = kills;
  enemyKillsRef.current = enemyKills;

  const onMove = useCallback((x, z) => {
    moveInputRef.current = { x, z };
  }, []);

  const onLookDelta = useCallback(
    (dx, dy) => {
      const mul = touchSens * 0.003;
      lookRef.current.yaw -= dx * mul * (sensX / 0.002);
      const pitchDelta = dy * mul * (sensY / 0.002);
      lookRef.current.pitch = Math.max(
        -0.85,
        Math.min(0.85, lookRef.current.pitch + (invertY ? pitchDelta : -pitchDelta))
      );
    },
    [touchSens, sensX, sensY, invertY]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !matchId || !myUserId) return;

    try {
      const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
      engineRef.current = engine;
      const scene = new Scene(engine);
      sceneRef.current = scene;
      scene.gravity = new Vector3(0, GRAVITY, 0);
      scene.collisionsEnabled = true;

      const camera = new FreeCamera("cam", new Vector3(0, HEAD_HEIGHT, 0), scene);
      camera.attachControl(canvas, false);
      camera.inputs.clear();
      camera.fov = (fov * Math.PI) / 180;
      cameraRef.current = camera;

      const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
      hemi.intensity = 0.55;
      const dir = new DirectionalLight("dir", new Vector3(-1, -2, -1), scene);
      dir.position = new Vector3(ARENA_HALF, 20, ARENA_HALF);
      dir.intensity = 0.85;

      const ground = MeshBuilder.CreateGround(
        "ground",
        { width: ARENA_HALF * 4, height: ARENA_HALF * 4 },
        scene
      );
      ground.position.y = 0;
      const groundMat = new StandardMaterial("groundMat", scene);
      groundMat.diffuseColor = new Color3(0.1, 0.1, 0.12);
      ground.material = groundMat;
      ground.checkCollisions = true;

      const wallMat = new StandardMaterial("wallMat", scene);
      wallMat.diffuseColor = new Color3(0.15, 0.07, 0.07);
      const w = ARENA_HALF;
      [
        { p: [w, WALL_H / 2, 0], s: [2, WALL_H, w * 2] },
        { p: [-w, WALL_H / 2, 0], s: [2, WALL_H, w * 2] },
        { p: [0, WALL_H / 2, w], s: [w * 2, WALL_H, 2] },
        { p: [0, WALL_H / 2, -w], s: [w * 2, WALL_H, 2] },
      ].forEach(({ p, s }, i) => {
        const box = MeshBuilder.CreateBox(`wall_${i}`, { width: s[0], height: s[1], depth: s[2] }, scene);
        box.position.set(p[0], p[1], p[2]);
        box.material = wallMat;
        box.checkCollisions = true;
      });

      const coverMat = new StandardMaterial("coverMat", scene);
      coverMat.diffuseColor = new Color3(0.18, 0.14, 0.14);
      [
        [4, 0, 4],
        [-5, 0, 5],
        [0, 0, -4],
      ].forEach(([x, y, z], i) => {
        const box = MeshBuilder.CreateBox(`cover_${i}`, { width: 2.5, height: 1.4, depth: 2 }, scene);
        box.position.set(x, y + 0.7, z);
        box.material = coverMat;
        box.checkCollisions = true;
      });

      const platformMat = new StandardMaterial("platformMat", scene);
      platformMat.diffuseColor = new Color3(0.12, 0.1, 0.12);
      const platform = MeshBuilder.CreateBox("platform", { width: 6, height: 0.5, depth: 6 }, scene);
      platform.position.set(0, 0.25, 0);
      platform.material = platformMat;
      platform.checkCollisions = true;

      const capsuleOpts = { height: 1.8, radius: 0.35 };
      const localCapsule = MeshBuilder.CreateCapsule("localPlayer", capsuleOpts, scene);
      localCapsule.position.copyFrom(mySlot === 1 ? SPAWN1 : SPAWN2);
      localCapsule.isVisible = false;
      localCapsule.checkCollisions = true;
      localCapsule.ellipsoid = new Vector3(0.35, 0.9, 0.35);
      localCapsule.ellipsoidOffset = new Vector3(0, 0.9, 0);
      localMeshRef.current = localCapsule;

      const remoteCapsule = MeshBuilder.CreateCapsule("remotePlayer", capsuleOpts, scene);
      remoteCapsule.position.copyFrom(mySlot === 1 ? SPAWN2 : SPAWN1);
      const remoteMat = new StandardMaterial("remoteMat", scene);
      remoteMat.diffuseColor = new Color3(0.5, 0.12, 0.12);
      remoteMat.emissiveColor = new Color3(0.12, 0, 0);
      remoteCapsule.material = remoteMat;
      remoteMeshRef.current = remoteCapsule;

      const moveSpeed = MOVE_SPEED;
      scene.onBeforeRenderObservable.add(() => {
        const dt = engine.getDeltaTime() / 1000;
        const local = localMeshRef.current;
        const cam = cameraRef.current;
        if (!local || !cam) return;

        if (!dead) {
          const k = keysRef.current;
          let vx = moveInputRef.current.x;
          let vz = moveInputRef.current.z;
          if (k.w) vz += 1;
          if (k.s) vz -= 1;
          if (k.d) vx += 1;
          if (k.a) vx -= 1;
          const len = Math.sqrt(vx * vx + vz * vz);
          if (len > 1) {
            vx /= len;
            vz /= len;
          }
          const sprint = (sprintToggle ? k.shift : true) ? (k.shift ? SPRINT_MULT : 1) : 1;
          const speed = moveSpeed * sprint * dt;
          const yaw = lookRef.current.yaw;
          const fwd = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
          const right = new Vector3(fwd.z, 0, -fwd.x);
          const move = right.scale(vx * speed).add(fwd.scale(vz * speed));
          local.position.addInPlace(move);
          velocityYRef.current += GRAVITY * dt;
          if (groundedRef.current && k.space) {
            velocityYRef.current = JUMP_FORCE;
            groundedRef.current = false;
          }
          local.position.y += velocityYRef.current * dt;
          if (local.position.y < 0) {
            local.position.y = 0;
            velocityYRef.current = 0;
            groundedRef.current = true;
          }
        }

        const headPos = local.position.clone().add(new Vector3(0, HEAD_HEIGHT, 0));
        cam.position.copyFrom(headPos);
        const yaw = lookRef.current.yaw;
        const pitch = lookRef.current.pitch;
        const fwd = new Vector3(
          Math.sin(yaw) * Math.cos(pitch),
          -Math.sin(pitch),
          Math.cos(yaw) * Math.cos(pitch)
        );
        cam.setTarget(headPos.add(fwd));

        const remote = remoteMeshRef.current;
        const rt = remoteTargetRef.current;
        if (remote) {
          remote.position.x += (rt.x - remote.position.x) * REMOTE_LERP;
          remote.position.y += (rt.y - remote.position.y) * REMOTE_LERP;
          remote.position.z += (rt.z - remote.position.z) * REMOTE_LERP;
          remote.rotation.y += (rt.rotY - remote.rotation.y) * REMOTE_LERP;
        }
      });

      engine.runRenderLoop(() => scene.render());
      window.addEventListener("resize", () => engine.resize());
      return () => {
        window.removeEventListener("resize", () => engine.resize());
        scene.dispose();
        engine.dispose();
      };
    } catch (e) {
      console.error("ARENA GAME CRASH:", e);
      setGameError(e);
    }
  }, [matchId, myUserId, mySlot, fov, sprintToggle]);

  useEffect(() => {
    const onKey = (down) => (e) => {
      const k = keysRef.current;
      switch (e.code) {
        case "KeyW": k.w = down; break;
        case "KeyS": k.s = down; break;
        case "KeyA": k.a = down; break;
        case "KeyD": k.d = down; break;
        case "ShiftLeft": case "ShiftRight": k.shift = down; break;
        case "Space": e.preventDefault(); k.space = down; break;
        default: break;
      }
    };
    window.addEventListener("keydown", onKey(true));
    window.addEventListener("keyup", onKey(false));
    return () => {
      window.removeEventListener("keydown", onKey(true));
      window.removeEventListener("keyup", onKey(false));
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const poll = () => {
      const pads = navigator.getGamepads?.();
      if (!pads) return;
      for (let i = 0; i < pads.length; i++) {
        const p = pads[i];
        if (!p || !p.connected) continue;
        const dead = (v) => (v === undefined || Math.abs(v) < deadzone ? 0 : v);
        moveInputRef.current = {
          x: dead(p.axes[0]) * gamepadSens,
          z: -dead(p.axes[1]) * gamepadSens,
        };
        lookRef.current.yaw -= dead(p.axes[2]) * 0.02 * gamepadSens;
        lookRef.current.pitch = Math.max(
          -0.85,
          Math.min(0.85, lookRef.current.pitch + (invertY ? -1 : 1) * dead(p.axes[3]) * 0.02 * gamepadSens)
        );
        if (p.buttons[7]?.pressed) {
          const now = Date.now();
          if (now - lastShotRef.current >= FIRE_COOLDOWN_MS) {
            lastShotRef.current = now;
            fireRef.current?.();
          }
        }
        break;
      }
    };
    const iv = setInterval(poll, 50);
    return () => clearInterval(iv);
  }, [deadzone, gamepadSens, invertY]);

  const fireRef = useRef(null);
  const fire = useCallback(() => {
    if (dead || gameEnded) return;
    const now = Date.now();
    if (now - lastShotRef.current < FIRE_COOLDOWN_MS) return;
    lastShotRef.current = now;
    const scene = sceneRef.current;
    const cam = cameraRef.current;
    const remote = remoteMeshRef.current;
    if (!scene || !cam || !remote) return;
    const origin = cam.position.clone();
    const target = cam.getTarget();
    const fwd = target.subtract(origin).normalize();
    const ray = new Ray(origin, fwd, 80);
    const hit = scene.pickWithRay(ray);
    const hitEnemy = hit?.hit && hit.pickedMesh === remote;
    if (hitEnemy) {
      setShowHitMarker(true);
      setTimeout(() => setShowHitMarker(false), 200);
      broadcastHit(matchId, { shooterId: myUserId, victimId: opponentUserId, damage: HIT_DAMAGE });
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
  fireRef.current = fire;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onMouseMove = (e) => {
      if (document.pointerLockElement !== canvas) return;
      const dx = e.movementX ?? 0;
      const dy = e.movementY ?? 0;
      lookRef.current.yaw -= dx * sensX;
      lookRef.current.pitch = Math.max(
        -0.85,
        Math.min(0.85, lookRef.current.pitch + (invertY ? dy : -dy) * sensY)
      );
    };
    const onClick = () => {
      if (canvas.requestPointerLock) canvas.requestPointerLock();
    };
    document.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("click", onClick);
      if (document.pointerLockElement === canvas) document.exitPointerLock?.();
    };
  }, [sensX, sensY, invertY]);

  useEffect(() => {
    if (!matchId || !opponentUserId) return;
    const unsub = subscribeArena(matchId, (payload) => {
      if (payload.type === "snapshot" && payload.userId === opponentUserId) {
        if (payload.pos) {
          remoteTargetRef.current = {
            x: payload.pos[0],
            y: payload.pos[1],
            z: payload.pos[2],
            rotY: payload.rotY ?? 0,
          };
        }
        setEnemyKills(payload.kills ?? 0);
      }
      if (payload.type === "hit" && payload.victimId === myUserId) {
        setHealth((h) => {
          const next = Math.max(0, h - (payload.damage ?? HIT_DAMAGE));
          if (next <= 0) {
            setDead(true);
            setDeaths((d) => d + 1);
            setTimeout(() => {
              setHealth(100);
              setDead(false);
              const local = localMeshRef.current;
              if (local) local.position.copyFrom(mySlot === 1 ? SPAWN1 : SPAWN2);
              velocityYRef.current = 0;
              groundedRef.current = true;
            }, RESPAWN_DELAY_MS);
          }
          return next;
        });
      }
    });
    return () => unsub?.();
  }, [matchId, myUserId, opponentUserId, mySlot]);

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
          <div style={{ fontSize: 14, marginTop: 8 }}>{String(gameError.message || gameError)}</div>
          {onExit && (
            <button type="button" onClick={onExit} style={{ marginTop: 16, padding: "10px 20px" }}>
              Back to Lobby
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", background: "#0a0a0a" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      <HUD health={health} kills={kills} deaths={deaths} timeLeft={timeLeft} />
      <Scoreboard slot1Kills={kills} slot2Kills={enemyKills} />
      <Crosshair style={crosshairStyle} />
      <HitMarker show={showHitMarker} />
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
        onTouchStart={(e) => { e.preventDefault(); fire(); }}
        onMouseDown={(e) => { e.preventDefault(); fire(); }}
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
        onTouchStart={(e) => { e.preventDefault(); keysRef.current.space = true; }}
        onTouchEnd={() => { keysRef.current.space = false; }}
        onMouseDown={() => { keysRef.current.space = true; }}
        onMouseUp={() => { keysRef.current.space = false; }}
        onMouseLeave={() => { keysRef.current.space = false; }}
      >
        JUMP
      </button>
      {gameEnded && <EndScreen won={won} kills={kills} deaths={deaths} onExit={onExit} />}
    </div>
  );
}
