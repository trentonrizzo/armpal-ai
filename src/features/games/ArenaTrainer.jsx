/**
 * Arena Aim Trainer — single-player. Same movement + shooting as Arena, no matchmaking.
 * Targets (boxes) respawn when hit. Stats: hits, shots, accuracy %, session time.
 * Uses unified arena look settings (arenaSettingsService); in-game overlay for Sensitivity X/Y, Invert Y.
 */
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
import {
  getDefaultLookSettings,
  getArenaLookSettings,
  saveArenaLookSettings,
  toSensMultiplier,
} from "./arenaSettingsService";
import ArenaSettingsOverlay from "./ArenaSettingsOverlay";
import { supabase } from "../../supabaseClient";

const TRAINER_HALF = 10;
const WALL_H = 4;
const HEAD_HEIGHT = 1.6;
const PITCH_MIN = (-80 * Math.PI) / 180;
const PITCH_MAX = (80 * Math.PI) / 180;
const MOVE_SPEED = 10;
const JUMP_FORCE = 8;
const GRAVITY = -24;
const RAY_LENGTH = 80;
const TARGET_COUNT = 6;
const TARGET_MIN_X = -TRAINER_HALF + 2;
const TARGET_MAX_X = TRAINER_HALF - 2;
const TARGET_MIN_Z = -TRAINER_HALF + 2;
const TARGET_MAX_Z = TRAINER_HALF - 2;
const TARGET_Y = 1.2;
const TARGET_SIZE = 0.5;

function randomTargetPosition() {
  return new Vector3(
    TARGET_MIN_X + Math.random() * (TARGET_MAX_X - TARGET_MIN_X),
    TARGET_Y,
    TARGET_MIN_Z + Math.random() * (TARGET_MAX_Z - TARGET_MIN_Z)
  );
}

export default function ArenaTrainer() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const playerRef = useRef({ x: 0, y: HEAD_HEIGHT, z: 0 });
  const keysRef = useRef({ w: false, a: false, s: false, d: false, space: false });
  const lookRef = useRef({ yaw: 0, pitch: 0 });
  const velocityYRef = useRef(0);
  const groundedRef = useRef(true);
  const targetsRef = useRef([]);
  const startTimeRef = useRef(null);

  const [lookSettings, setLookSettings] = useState(getDefaultLookSettings);
  const [settingsOverlayOpen, setSettingsOverlayOpen] = useState(false);
  const [userId, setUserId] = useState(null);
  const [hits, setHits] = useState(0);
  const [shots, setShots] = useState(0);
  const [sessionTime, setSessionTime] = useState(0);
  const [error, setError] = useState(null);

  const sensXRef = useRef(toSensMultiplier(lookSettings.mouseSensitivityX));
  const sensYRef = useRef(toSensMultiplier(lookSettings.mouseSensitivityY));
  const invertYRef = useRef(lookSettings.invertY);
  sensXRef.current = toSensMultiplier(lookSettings.mouseSensitivityX);
  sensYRef.current = toSensMultiplier(lookSettings.mouseSensitivityY);
  invertYRef.current = lookSettings.invertY;

  const accuracy = shots > 0 ? Math.round((hits / shots) * 100) : 0;

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (alive) setUserId(user?.id ?? null);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    getArenaLookSettings(userId ?? null).then((s) => {
      if (alive) setLookSettings(s);
    }).catch(() => {});
    return () => { alive = false; };
  }, [userId]);

  const addTarget = useCallback((scene) => {
    const pos = randomTargetPosition();
    const box = MeshBuilder.CreateBox(
      `target_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      { size: TARGET_SIZE },
      scene
    );
    box.position = pos;
    box.isPickable = true;
    const mat = new StandardMaterial("targetMat", scene);
    mat.diffuseColor = new Color3(0.9, 0.25, 0.2);
    mat.emissiveColor = new Color3(0.2, 0.05, 0.05);
    box.material = mat;
    targetsRef.current.push(box);
    return box;
  }, []);

  const removeTarget = useCallback((mesh) => {
    const arr = targetsRef.current;
    const i = arr.indexOf(mesh);
    if (i !== -1) arr.splice(i, 1);
    mesh.dispose();
  }, []);

  const handleSaveLookSettings = useCallback((next) => {
    setLookSettings(next);
    saveArenaLookSettings(userId ?? null, next).catch(() => {});
  }, [userId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onKeyDown = (e) => {
      if (e.code === "Escape") {
        e.preventDefault();
        setSettingsOverlayOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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
      const fovDeg = lookSettings.fov ?? 75;
      camera.fov = (fovDeg * Math.PI) / 180;
      cameraRef.current = camera;

      const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
      hemi.intensity = 0.6;
      const dir = new DirectionalLight("dir", new Vector3(-1, -2, -1), scene);
      dir.position = new Vector3(TRAINER_HALF, 15, TRAINER_HALF);
      dir.intensity = 0.8;

      const ground = MeshBuilder.CreateGround(
        "ground",
        { width: TRAINER_HALF * 4, height: TRAINER_HALF * 4 },
        scene
      );
      ground.position.y = 0;
      const groundMat = new StandardMaterial("groundMat", scene);
      groundMat.diffuseColor = new Color3(0.1, 0.1, 0.12);
      ground.material = groundMat;
      ground.checkCollisions = true;

      const wallMat = new StandardMaterial("wallMat", scene);
      wallMat.diffuseColor = new Color3(0.15, 0.08, 0.08);
      const w = TRAINER_HALF;
      [
        [w, WALL_H / 2, 0], [-w, WALL_H / 2, 0], [0, WALL_H / 2, w], [0, WALL_H / 2, -w],
      ].forEach(([px, py, pz], i) => {
        const box = MeshBuilder.CreateBox(
          `wall_${i}`,
          { width: px !== 0 ? w * 2 : 2, height: WALL_H, depth: pz !== 0 ? w * 2 : 2 },
          scene
        );
        box.position.set(px, py, pz);
        box.material = wallMat;
        box.checkCollisions = true;
      });

      for (let i = 0; i < TARGET_COUNT; i++) addTarget(scene);

      startTimeRef.current = Date.now();

      scene.onBeforeRenderObservable.add(() => {
        const dt = engine.getDeltaTime() / 1000;
        const cam = cameraRef.current;
        const pos = playerRef.current;
        if (!cam) return;

        const k = keysRef.current;
        let vx = 0, vz = 0;
        if (k.w) vz += 1;
        if (k.s) vz -= 1;
        if (k.d) vx += 1;
        if (k.a) vx -= 1;
        const len = Math.sqrt(vx * vx + vz * vz);
        if (len > 1) { vx /= len; vz /= len; }
        const yaw = lookRef.current.yaw;
        const fwd = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
        const right = new Vector3(fwd.z, 0, -fwd.x);
        pos.x += (right.x * vx + fwd.x * vz) * MOVE_SPEED * dt;
        pos.z += (right.z * vx + fwd.z * vz) * MOVE_SPEED * dt;
        pos.x = Math.max(-TRAINER_HALF + 0.5, Math.min(TRAINER_HALF - 0.5, pos.x));
        pos.z = Math.max(-TRAINER_HALF + 0.5, Math.min(TRAINER_HALF - 0.5, pos.z));

        velocityYRef.current += GRAVITY * dt;
        if (groundedRef.current && k.space) {
          velocityYRef.current = JUMP_FORCE;
          groundedRef.current = false;
        }
        pos.y += velocityYRef.current * dt;
        if (pos.y < HEAD_HEIGHT) {
          pos.y = HEAD_HEIGHT;
          velocityYRef.current = 0;
          groundedRef.current = true;
        }

        cam.position.set(pos.x, pos.y, pos.z);
        const pitch = lookRef.current.pitch;
        const lookFwd = new Vector3(
          Math.sin(yaw) * Math.cos(pitch),
          -Math.sin(pitch),
          Math.cos(yaw) * Math.cos(pitch)
        );
        cam.setTarget(cam.position.clone().add(lookFwd));
      });

      engine.runRenderLoop(() => scene.render());
      window.addEventListener("resize", () => engine.resize());
      const isTouch = typeof window !== "undefined" && "ontouchstart" in window;
      if (!isTouch && canvas.requestPointerLock) {
        setTimeout(() => canvas.requestPointerLock(), 100);
      }
      return () => {
        window.removeEventListener("resize", () => engine.resize());
        if (document.pointerLockElement === canvas) document.exitPointerLock?.();
        scene.dispose();
        engine.dispose();
      };
    } catch (e) {
      console.error("ArenaTrainer", e);
      setError(e);
    }
  }, [addTarget, lookSettings.fov]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onKey = (down) => (e) => {
      const k = keysRef.current;
      switch (e.code) {
        case "KeyW": k.w = down; break;
        case "KeyS": k.s = down; break;
        case "KeyA": k.a = down; break;
        case "KeyD": k.d = down; break;
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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onMouseMove = (e) => {
      if (document.pointerLockElement !== canvas) return;
      const dx = e.movementX ?? 0;
      const dy = e.movementY ?? 0;
      const sensX = sensXRef.current;
      const sensY = sensYRef.current;
      const invertY = invertYRef.current;
      lookRef.current.yaw += dx * sensX;
      const deltaPitch = dy * sensY;
      lookRef.current.pitch = Math.max(
        PITCH_MIN,
        Math.min(PITCH_MAX, lookRef.current.pitch + (invertY ? -deltaPitch : deltaPitch))
      );
    };
    const onClick = () => {
      if (settingsOverlayOpen) return;
      const isTouch = typeof window !== "undefined" && "ontouchstart" in window;
      if (!isTouch && canvas.requestPointerLock) canvas.requestPointerLock();
    };
    document.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("click", onClick);
    };
  }, [settingsOverlayOpen]);

  const fire = useCallback(() => {
    const scene = sceneRef.current;
    const cam = cameraRef.current;
    if (!scene || !cam) return;
    const origin = cam.position.clone();
    const fwd = cam.getTarget().subtract(origin).normalize();
    const ray = new Ray(origin, fwd, RAY_LENGTH);
    const hit = scene.pickWithRay(ray);
    setShots((s) => s + 1);
    if (hit?.hit && hit.pickedMesh && targetsRef.current.includes(hit.pickedMesh)) {
      removeTarget(hit.pickedMesh);
      addTarget(scene);
      setHits((h) => h + 1);
    }
  }, [addTarget, removeTarget]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onMouseDown = (e) => {
      if (e.button === 0) {
        e.preventDefault();
        fire();
      }
    };
    canvas.addEventListener("mousedown", onMouseDown);
    return () => canvas.removeEventListener("mousedown", onMouseDown);
  }, [fire]);

  useEffect(() => {
    const iv = setInterval(() => {
      if (startTimeRef.current)
        setSessionTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  if (error) {
    return (
      <div style={{ padding: 24, color: "#f44", textAlign: "center" }}>
        <p>Failed to load trainer.</p>
        <button type="button" onClick={() => navigate("/games")} style={{ marginTop: 12, padding: "10px 20px" }}>
          Back to Games
        </button>
      </div>
    );
  }

  const showCrosshair = lookSettings.showCrosshair !== false;

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", background: "#0a0a0a" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          right: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
          pointerEvents: "none",
          zIndex: 20,
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => navigate("/games")}
            style={{
              pointerEvents: "auto",
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--card-2)",
              color: "var(--text)",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ← Back to Games
          </button>
          <button
            type="button"
            onClick={() => setSettingsOverlayOpen(true)}
            title="Look settings"
            style={{
              pointerEvents: "auto",
              width: 40,
              height: 40,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "rgba(0,0,0,0.5)",
              color: "var(--text)",
              fontSize: 18,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ⚙️
          </button>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 14, fontWeight: 700, color: "#fff" }}>
          <span>Hits: {hits}</span>
          <span>Shots: {shots}</span>
          <span>Accuracy: {accuracy}%</span>
          <span>Time: {sessionTime}s</span>
        </div>
      </div>
      {showCrosshair && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.9)",
            pointerEvents: "none",
            zIndex: 15,
          }}
        />
      )}
      <ArenaSettingsOverlay
        open={settingsOverlayOpen}
        onClose={() => setSettingsOverlayOpen(false)}
        settings={lookSettings}
        onSave={handleSaveLookSettings}
        canvasRef={canvasRef}
      />
    </div>
  );
}
