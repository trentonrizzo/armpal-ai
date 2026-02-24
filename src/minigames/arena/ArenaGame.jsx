/**
 * ArmPal Arena — mega upgrade: pointer lock, LMB/RMB, ESC pause, weapons, hitboxes, boundaries,
 * leave flow, camera toggle, HUD back/settings, damage numbers, kill feed, scope, enemy health bar.
 */
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Engine,
  Scene,
  FreeCamera,
  HemisphericLight,
  Vector3,
  Matrix,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Ray,
  DirectionalLight,
} from "@babylonjs/core";
import { getDefaultArenaSettings } from "./arenaDb";
import {
  setKeyDown,
  setMouseButton,
  getMoveVectorFromKeys,
  getSprintFromKeys,
  getJumpFromKeys,
  getFireFromInput,
  getAimFromInput,
  getReloadFromKeys,
  getWeaponSlotFromKeys,
  getPauseFromKeys,
  getCameraToggleFromKeys,
  getGamepadState,
  applyBindsKeyboard,
} from "./input/InputManager";
import {
  WEAPONS,
  createWeaponState,
  getCurrentWeapon,
  canFire,
  consumeAmmo,
  startReload,
  tickReload,
  swapWeapon,
  switchToSlot,
  computeDamage,
} from "./weapons/WeaponSystem";
import { createWeaponMesh } from "./weapons/WeaponModels";
import { createPlayerModel, getHitPartFromMesh } from "./player/PlayerModel";
import { updateLegWalk, getWeaponSwapProgress } from "./animations/PlayerAnimations";
import { createHealthBar, updateHealthBarScale } from "./ui/HealthBar";
import Joystick from "./controls/Joystick";
import LookTouch from "./controls/LookTouch";
import HUD from "./ui/HUD";
import Scoreboard from "./ui/Scoreboard";
import EndScreen from "./ui/EndScreen";
import Crosshair from "./ui/Crosshair";
import HitMarker from "./ui/HitMarker";
import PauseMenu from "./ui/PauseMenu";
import ScopeOverlay from "./ui/ScopeOverlay";
import KillFeed from "./ui/KillFeed";
import DamageNumbers from "./ui/DamageNumbers";
import EnemyHealthBar from "./ui/EnemyHealthBar";
import { subscribeArena, broadcastSnapshot, broadcastHit, broadcastWeaponFire, broadcastDeath } from "./arenaNet";
import { endMatch, updateMatchPlayerKillsDeaths, persistMatchResult, leaveMatch } from "./arenaDb";
import ArenaSettingsOverlay from "../../features/games/ArenaSettingsOverlay";

const ARENA_HALF = 12;
const BOUNDARY = ARENA_HALF - 0.6;
const WALL_H = 4;
const HEAD_HEIGHT = 1.6;
const HEAD_HEIGHT_CROUCH = 1.0;
const PITCH_MIN = (-80 * Math.PI) / 180;
const PITCH_MAX = (80 * Math.PI) / 180;
const SPAWN1 = new Vector3(-6, 0, -6);
const SPAWN2 = new Vector3(6, 0, 6);
const MATCH_DURATION_S = 90;
const KILLS_TO_WIN = 7;
const RESPAWN_DELAY_MS = 2000;
const MOVE_SPEED = 10;
const SPRINT_MULT = 1.5;
const JUMP_FORCE = 8;
const GRAVITY = -24;
const REMOTE_LERP = 0.18;
const SNAPSHOT_MS = 55;
const INTERP_BUFFER_MS = 120;
const OPPONENT_LEFT_DELAY_MS = 2500;
const FP_WEAPON_SWAY = 0.012;
const FP_WEAPON_SWAY_SPEED = 4;

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
  match,
  onExit,
  onMatchEnd,
  onOpenSettings,
  onLookSettingsSave,
}) {
  const settings = { ...getDefaultArenaSettings(), ...settingsProp };
  const sensX = Number(settings.look_sensitivity_x) || 0.0009;
  const sensY = Number(settings.look_sensitivity_y) || 0.0009;
  const invertY = !!settings.invert_y_axis;
  const touchSens = Number(settings.touch_sensitivity) || 1;
  const fov = Math.max(60, Math.min(110, Number(settings.fov) || 85));
  const crosshairStyle = settings.crosshair_style || "cross";
  const sprintToggle = !!settings.sprint_toggle;
  const deadzone = Math.max(0.05, Math.min(0.4, Number(settings.controller_deadzone) || 0.15));
  const gamepadSens = Number(settings.controller_sensitivity) || 1;
  const adsSens = Math.max(0.2, Math.min(1.5, Number(settings.ads_sensitivity) || 0.5));
  const cameraMode = settings.camera_mode || "first";
  const loadoutPrimary = settings.loadout_primary || "pistol";
  const loadoutSecondary = settings.loadout_secondary || "shotgun";
  const bindsRef = useRef(settings.binds || null);
  useEffect(() => {
    if (settings.binds) {
      bindsRef.current = settings.binds;
      applyBindsKeyboard(settings.binds);
    }
  }, [settings.binds]);

  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const localMeshRef = useRef(null);
  const remoteMeshRef = useRef(null);
  const localModelRef = useRef(null);
  const remoteModelRef = useRef(null);
  const fpWeaponRef = useRef(null);
  const remoteWeaponRef = useRef(null);
  const weaponSwapStartRef = useRef(0);
  const lastDisplayedWeaponRef = useRef(loadoutPrimary);
  const remoteHealthBarRef = useRef(null);
  const lastLocalPosRef = useRef({ x: 0, z: 0 });
  const lastSnapshotRef = useRef(0);
  const moveInputRef = useRef({ x: 0, z: 0 });
  const lookRef = useRef({ yaw: 0, pitch: 0 });
  const velocityYRef = useRef(0);
  const groundedRef = useRef(true);
  const recoilPitchRef = useRef(0);
  const crouchRef = useRef(false);
  const adsRef = useRef(false);
  const remoteInterpRef = useRef([]);
  const [crosshairRecoil, setCrosshairRecoil] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [lookOverlayOpen, setLookOverlayOpen] = useState(false);
  const [cameraModeLocal, setCameraModeLocal] = useState(cameraMode);
  const [weaponState, setWeaponState] = useState(() =>
    createWeaponState(loadoutPrimary, loadoutSecondary)
  );
  const weaponStateRef = useRef(weaponState);
  weaponStateRef.current = weaponState;

  const remoteTargetRef = useRef({ x: 0, y: 0, z: 0, rotY: 0, health: 100, isCrouching: false, currentWeapon: "pistol" });
  const [gameError, setGameError] = useState(null);
  const [health, setHealth] = useState(100);
  const [kills, setKills] = useState(0);
  const [deaths, setDeaths] = useState(0);
  const [enemyKills, setEnemyKills] = useState(0);
  const [enemyHealth, setEnemyHealth] = useState(100);
  const [timeLeft, setTimeLeft] = useState(MATCH_DURATION_S);
  const [gameEnded, setGameEnded] = useState(false);
  const [won, setWon] = useState(false);
  const [dead, setDead] = useState(false);
  const [showHitMarker, setShowHitMarker] = useState(false);
  const [killFeedEntries, setKillFeedEntries] = useState([]);
  const [damageNumbers, setDamageNumbers] = useState([]);
  const [enemyBarScreen, setEnemyBarScreen] = useState({ left: null, top: null, visible: false });
  const [opponentLeft, setOpponentLeft] = useState(false);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const countdownRef = useRef(true);
  const matchStartTsRef = useRef(null);
  const deadRef = useRef(false);
  const gameEndedRef = useRef(false);
  deadRef.current = dead;
  gameEndedRef.current = gameEnded;
  const projectWorldToScreenRef = useRef(null);

  const onMove = useCallback((x, z) => {
    moveInputRef.current = { x, z };
  }, []);

  const onLookDelta = useCallback(
    (dx, dy) => {
      const mul = touchSens * 0.003;
      lookRef.current.yaw += dx * mul * (sensX / 0.0009);
      const pitchDelta = (invertY ? -dy : dy) * mul * (sensY / 0.0009);
      lookRef.current.pitch = Math.max(
        PITCH_MIN,
        Math.min(PITCH_MAX, lookRef.current.pitch + pitchDelta)
      );
    },
    [touchSens, sensX, sensY, invertY]
  );

  const handleLeaveMatch = useCallback(() => {
    if (!matchId || !myUserId) return;
    leaveMatch(matchId, myUserId).catch(() => {});
    onExit?.();
  }, [matchId, myUserId, onExit]);

  useEffect(() => {
    if (!match?.id || match.status !== "ended") return;
    const leftBy = match.left_by_user_id;
    if (leftBy && leftBy === opponentUserId) {
      setOpponentLeft(true);
      const t = setTimeout(() => {
        onExit?.();
      }, OPPONENT_LEFT_DELAY_MS);
      return () => clearTimeout(t);
    }
  }, [match?.id, match?.status, match?.left_by_user_id, opponentUserId, onExit]);

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
      [
        { p: [ARENA_HALF, WALL_H / 2, 0], s: [2, WALL_H, ARENA_HALF * 2] },
        { p: [-ARENA_HALF, WALL_H / 2, 0], s: [2, WALL_H, ARENA_HALF * 2] },
        { p: [0, WALL_H / 2, ARENA_HALF], s: [ARENA_HALF * 2, WALL_H, 2] },
        { p: [0, WALL_H / 2, -ARENA_HALF], s: [ARENA_HALF * 2, WALL_H, 2] },
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
        [-4, 0, -5],
        [5, 0, 0],
      ].forEach(([x, y, z], i) => {
        const box = MeshBuilder.CreateBox(`cover_${i}`, { width: 2.5, height: 1.4, depth: 2 }, scene);
        box.position.set(x, y + 0.7, z);
        box.material = coverMat;
        box.checkCollisions = true;
      });

      const platformMat = new StandardMaterial("platformMat", scene);
      const platform = MeshBuilder.CreateBox("platform", { width: 6, height: 0.5, depth: 6 }, scene);
      platform.position.set(0, 0.25, 0);
      platform.material = platformMat;
      platform.checkCollisions = true;

      const localModel = createPlayerModel(scene, "localPlayer", false);
      localModel.root.position.copyFrom(mySlot === 1 ? SPAWN1 : SPAWN2);
      localMeshRef.current = localModel.root;
      localModelRef.current = localModel;
      lastLocalPosRef.current = { x: localModel.root.position.x, z: localModel.root.position.z };

      const remoteModel = createPlayerModel(scene, "remotePlayer", true);
      remoteModel.root.position.copyFrom(mySlot === 1 ? SPAWN2 : SPAWN1);
      remoteMeshRef.current = remoteModel.root;
      remoteModelRef.current = remoteModel;

      const initialWeaponId = getCurrentWeapon(weaponStateRef.current).id;
      const fpWeapon = createWeaponMesh(scene, initialWeaponId, "fpWeapon");
      fpWeapon.parent = camera;
      fpWeapon.metadata = { weaponType: initialWeaponId };
      fpWeaponRef.current = fpWeapon;

      const remoteWeapon = createWeaponMesh(scene, "pistol", "remoteWeapon");
      remoteWeapon.metadata = { weaponType: "pistol" };
      remoteWeapon.parent = remoteModel.arms[1];
      remoteWeapon.position.set(0.08, 0, 0.12);
      remoteWeapon.rotation.x = Math.PI / 2;
      remoteWeaponRef.current = remoteWeapon;

      const remoteBar = createHealthBar(scene, remoteModel.root, "remoteHealthBar");
      remoteHealthBarRef.current = remoteBar;

      const timeRef = { current: 0 };
      scene.onBeforeRenderObservable.add(() => {
        const dt = engine.getDeltaTime() / 1000;
        timeRef.current += dt;
        const local = localMeshRef.current;
        const cam = cameraRef.current;
        const localModel = localModelRef.current;
        if (!local || !cam) return;

        const now = Date.now();
        let ws = weaponStateRef.current;
        ws = tickReload(ws, now);
        if (ws !== weaponStateRef.current) setWeaponState(ws);

        const yaw = lookRef.current.yaw;
        let vx = 0, vz = 0;
        if (!deadRef.current && !gameEndedRef.current) {
          const bind = bindsRef.current;
          vx = moveInputRef.current.x;
          vz = moveInputRef.current.z;
          const fromKeys = getMoveVectorFromKeys(bind);
          if (Math.abs(fromKeys.x) > 0.01 || Math.abs(fromKeys.z) > 0.01) {
            vx = fromKeys.x;
            vz = fromKeys.z;
          }
          const sprint = (sprintToggle ? getSprintFromKeys(bind) : true) ? (getSprintFromKeys(bind) ? SPRINT_MULT : 1) : 1;
          const crouchMult = crouchRef.current ? 0.8 : 1;
          const speed = MOVE_SPEED * sprint * crouchMult * dt;
          const fwd = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
          const right = new Vector3(fwd.z, 0, -fwd.x);
          const move = right.scale(vx * speed).add(fwd.scale(vz * speed));
          local.position.addInPlace(move);
          local.position.x = Math.max(-BOUNDARY, Math.min(BOUNDARY, local.position.x));
          local.position.z = Math.max(-BOUNDARY, Math.min(BOUNDARY, local.position.z));
          velocityYRef.current += GRAVITY * dt;
          if (groundedRef.current && getJumpFromKeys(bind)) {
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
        const velX = (local.position.x - lastLocalPosRef.current.x) / Math.max(dt, 0.001);
        const velZ = (local.position.z - lastLocalPosRef.current.z) / Math.max(dt, 0.001);
        lastLocalPosRef.current = { x: local.position.x, z: local.position.z };
        if (localModel) updateLegWalk(localModel, velX, velZ, timeRef.current);

        recoilPitchRef.current *= 0.92;
        const headY = crouchRef.current ? HEAD_HEIGHT_CROUCH : HEAD_HEIGHT;
        const headPos = local.position.clone().add(new Vector3(0, headY, 0));
        const isThird = cameraModeLocal === "third";
        const camOffset = isThird ? 2.5 : 0;
        const camBack = isThird ? new Vector3(Math.sin(yaw) * -camOffset, 0.2, Math.cos(yaw) * -camOffset) : Vector3.Zero();
        const camPos = headPos.add(camBack);
        cam.position.copyFrom(camPos);
        const pitch = lookRef.current.pitch - recoilPitchRef.current;
        const fwd = new Vector3(
          Math.sin(yaw) * Math.cos(pitch),
          -Math.sin(pitch),
          Math.cos(yaw) * Math.cos(pitch)
        );
        cam.setTarget(headPos.add(fwd));

        const fpWeapon = fpWeaponRef.current;
        const currentWeaponId = getCurrentWeapon(weaponStateRef.current).id;
        if (fpWeapon) {
          if (currentWeaponId !== lastDisplayedWeaponRef.current && weaponSwapStartRef.current === 0) {
            weaponSwapStartRef.current = Date.now();
          }
          const swapStart = weaponSwapStartRef.current;
          if (swapStart > 0) {
            const prog = getWeaponSwapProgress(swapStart);
            fpWeapon.position.y = prog.outOffset;
            if (prog.done) {
              weaponSwapStartRef.current = 0;
              const newWeapon = createWeaponMesh(scene, currentWeaponId, "fpWeapon");
              newWeapon.parent = camera;
              newWeapon.metadata = { weaponType: currentWeaponId };
              fpWeapon.dispose();
              fpWeaponRef.current = newWeapon;
              lastDisplayedWeaponRef.current = currentWeaponId;
            }
          } else {
            const sway = Math.sin(timeRef.current * FP_WEAPON_SWAY_SPEED) * FP_WEAPON_SWAY * (Math.abs(vx) + Math.abs(vz));
            fpWeapon.position.y = 0;
            fpWeapon.rotation.z = sway;
          }
        }

        const remote = remoteMeshRef.current;
        const rt = remoteTargetRef.current;
        const remoteModel = remoteModelRef.current;
        if (remote) {
          remote.position.x += (rt.x - remote.position.x) * REMOTE_LERP;
          remote.position.y += (rt.y - remote.position.y) * REMOTE_LERP;
          remote.position.z += (rt.z - remote.position.z) * REMOTE_LERP;
          remote.rotation.y += (rt.rotY - remote.rotation.y) * REMOTE_LERP;
          if (remoteModel?.root) {
            const crouchScale = rt.isCrouching ? 0.85 : 1;
            remoteModel.root.scaling.y = crouchScale;
          }
          const rw = remoteWeaponRef.current;
          if (rw && rt.currentWeapon && rw.metadata?.weaponType !== rt.currentWeapon) {
            rw.dispose();
            const newRemoteWeapon = createWeaponMesh(scene, rt.currentWeapon, "remoteWeapon");
            newRemoteWeapon.metadata = { weaponType: rt.currentWeapon };
            newRemoteWeapon.parent = remoteModel?.arms?.[1] || remote;
            newRemoteWeapon.position.set(0.08, 0, 0.12);
            newRemoteWeapon.rotation.x = Math.PI / 2;
            remoteWeaponRef.current = newRemoteWeapon;
          }
          const rBar = remoteHealthBarRef.current;
          if (rBar) {
            rBar.setHealth((rt.health ?? 100) / 100);
            if (rBar.mesh && cam) updateHealthBarScale(rBar.mesh, cam.position, remote.position);
          }
        }
        if (canvasRef.current && document.pointerLockElement === canvasRef.current && getFireFromInput(bindsRef.current)) {
          fireRef.current?.();
        }
      });

      engine.runRenderLoop(() => scene.render());
      window.addEventListener("resize", () => engine.resize());

      const tryPointerLock = () => {
        if (countdownRef.current || pauseOpen) return;
        if (canvasRef.current && document.pointerLockElement !== canvasRef.current) {
          canvasRef.current.requestPointerLock();
        }
      };
      setTimeout(() => {
        countdownRef.current = false;
        tryPointerLock();
      }, 500);
      canvas.addEventListener("click", tryPointerLock);

      return () => {
        canvas.removeEventListener("click", tryPointerLock);
        window.removeEventListener("resize", () => engine.resize());
        scene.dispose();
        engine.dispose();
      };
    } catch (e) {
      console.error("ARENA GAME CRASH:", e);
      setGameError(e);
    }
  }, [matchId, myUserId, mySlot, fov, sprintToggle, cameraModeLocal, pauseOpen]);

  useEffect(() => {
    const onKey = (down) => (e) => {
      setKeyDown(e.code, down);
      if (e.code === "KeyC" && down) crouchRef.current = !crouchRef.current;
      if (e.code === "Escape") {
        e.preventDefault();
        if (down) setLookOverlayOpen((o) => !o);
      }
      if (down && !e.repeat) {
        if (e.code === "KeyR") setWeaponState((s) => startReload(s, Date.now()));
        if (e.code === "Digit1") setWeaponState((s) => switchToSlot(s, 1));
        if (e.code === "Digit2") setWeaponState((s) => switchToSlot(s, 2));
        if (e.code === "KeyV") setCameraModeLocal((c) => (c === "first" ? "third" : "first"));
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
    if ((pauseOpen || lookOverlayOpen) && document.pointerLockElement === canvasRef.current) {
      document.exitPointerLock?.();
    }
  }, [pauseOpen, lookOverlayOpen]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const poll = () => {
      const gp = getGamepadState(0, deadzone, gamepadSens, invertY, bindsRef.current);
      if (gp) {
        moveInputRef.current = gp.move;
        lookRef.current.yaw += gp.look.x;
        lookRef.current.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, lookRef.current.pitch + gp.look.y));
        crouchRef.current = gp.crouch;
        adsRef.current = gp.aim;
        if (gp.pause) setPauseOpen(true);
        if (gp.cameraToggle) setCameraModeLocal((c) => (c === "first" ? "third" : "first"));
      }
    };
    const iv = setInterval(poll, 50);
    return () => clearInterval(iv);
  }, [deadzone, gamepadSens, invertY]);

  const fireRef = useRef(null);
  const fire = useCallback(() => {
    if (dead || gameEnded) return;
    const now = Date.now();
    const ws = weaponStateRef.current;
    if (!canFire(ws, now)) return;
    const scene = sceneRef.current;
    const cam = cameraRef.current;
    const remote = remoteMeshRef.current;
    if (!scene || !cam || !remote) return;
    const origin = cam.position.clone();
    const target = cam.getTarget();
    const fwd = target.subtract(origin).normalize();
    const weapon = getCurrentWeapon(ws);
    const range = weapon.range || 80;
    const ray = new Ray(origin, fwd, range);
    const hit = scene.pickWithRay(ray);
    let hitPart = "body";
    let hitPoint = origin.clone().add(fwd.scale(range));
    let distance = range;
    if (hit?.hit && hit.pickedPoint) {
      hitPoint = hit.pickedPoint.clone();
      distance = Vector3.Distance(origin, hitPoint);
      if (hit.pickedMesh === remote || hit.pickedMesh.parent === remote || hit.pickedMesh.parent?.parent === remote) {
        hitPart = getHitPartFromMesh(hit.pickedMesh);
      }
    }
    const isRemoteHit = hit?.hit && remote && (hit.pickedMesh === remote || hit.pickedMesh.parent === remote || hit.pickedMesh.parent?.parent === remote);

    setWeaponState((s) => {
      const next = consumeAmmo({ ...s });
      next.lastShotTs = now;
      return next;
    });
    recoilPitchRef.current = weapon.recoilPitch || 0.02;
    setCrosshairRecoil(true);
    setTimeout(() => setCrosshairRecoil(false), 100);

    if (weapon.tracer) {
      const tracerPoints = [origin, hitPoint];
      const tracer = MeshBuilder.CreateLines("tracer", { points: tracerPoints }, scene);
      tracer.color = new Color3(1, 0.85, 0.4);
      setTimeout(() => tracer.dispose(), 80);
    }
    const muzzlePlane = MeshBuilder.CreatePlane("muzzle", { size: 0.25 }, scene);
    muzzlePlane.position = origin.clone().add(fwd.scale(0.4));
    muzzlePlane.lookAt(origin);
    const muzzleMat = new StandardMaterial("muzzleMat", scene);
    muzzleMat.emissiveColor = new Color3(1, 0.9, 0.6);
    muzzleMat.diffuseColor = new Color3(0, 0, 0);
    muzzlePlane.material = muzzleMat;
    setTimeout(() => {
      muzzlePlane.dispose();
      muzzleMat.dispose();
    }, 50);

    if (isRemoteHit) {
      const damage = computeDamage(weapon.id, hitPart, distance);
      setShowHitMarker(true);
      setTimeout(() => setShowHitMarker(false), 200);
      setDamageNumbers((d) => [...d.slice(-5), { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z, damage, headshot: hitPart === "head" }]);
      setTimeout(() => setDamageNumbers((d) => d.slice(0, -1)), 800);
      broadcastHit(matchId, { shooterId: myUserId, victimId: opponentUserId, damage, hitPart });
    }
    broadcastWeaponFire(matchId, { userId: myUserId, weapon: weapon.id, origin: [origin.x, origin.y, origin.z], dir: [fwd.x, fwd.y, fwd.z] });
  }, [matchId, myUserId, opponentUserId, dead, gameEnded]);
  fireRef.current = fire;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onMouseMove = (e) => {
      if (document.pointerLockElement !== canvas) return;
      const dx = e.movementX ?? 0;
      const dy = e.movementY ?? 0;
      const sens = adsRef.current ? sensX * adsSens : sensX;
      const sensYVal = adsRef.current ? sensY * adsSens : sensY;
      lookRef.current.yaw += dx * sens;
      lookRef.current.pitch = Math.max(
        PITCH_MIN,
        Math.min(PITCH_MAX, lookRef.current.pitch + (invertY ? -dy : dy) * sensYVal)
      );
    };
    const onMouseDown = (e) => {
      setMouseButton(e.button, true);
      if (e.button === 1) adsRef.current = true;
    };
    const onMouseUp = (e) => {
      setMouseButton(e.button, false);
      if (e.button === 1) adsRef.current = false;
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mouseup", onMouseUp);
      if (document.pointerLockElement === canvas) document.exitPointerLock?.();
    };
  }, [sensX, sensY, invertY, adsSens]);

  useEffect(() => {
    const scene = sceneRef.current;
    const cam = cameraRef.current;
    const remote = remoteMeshRef.current;
    if (!scene || !cam || !remote) return;
    const engine = scene.getEngine();
    const viewport = { x: 0, y: 0, width: engine.getRenderWidth(), height: engine.getRenderHeight() };
    const worldMatrix = Matrix.Identity();
    projectWorldToScreenRef.current = (wx, wy, wz) => {
      const world = new Vector3(wx, wy, wz);
      const view = cam.getViewMatrix();
      const proj = cam.getProjectionMatrix(true);
      const transform = proj.multiply(view);
      const screen = Vector3.Project(world, worldMatrix, transform, viewport);
      if (screen.z < 0 || screen.z > 1) return null;
      return { x: screen.x, y: screen.y };
    };
    const iv = setInterval(() => {
      const headWorld = remote.position.clone().add(new Vector3(0, 1.15, 0));
      const view = cam.getViewMatrix();
      const proj = cam.getProjectionMatrix(true);
      const transform = proj.multiply(view);
      const scr = Vector3.Project(headWorld, worldMatrix, transform, viewport);
      if (scr.z > 0 && scr.z < 1) {
        setEnemyBarScreen({ left: scr.x, top: scr.y - 30, visible: true });
      } else {
        setEnemyBarScreen((s) => ({ ...s, visible: false }));
      }
    }, 100);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!matchId || !opponentUserId) return;
    const unsub = subscribeArena(matchId, (payload) => {
      if (payload.type === "snapshot" && payload.userId === opponentUserId) {
        if (payload.pos) {
          remoteTargetRef.current = {
            ...remoteTargetRef.current,
            x: payload.pos[0],
            y: payload.pos[1],
            z: payload.pos[2],
            rotY: payload.rotY ?? 0,
            isCrouching: payload.isCrouching ?? false,
            currentWeapon: payload.currentWeapon ?? "pistol",
          };
        }
        setEnemyKills(payload.kills ?? 0);
        setEnemyHealth(payload.health ?? 100);
        remoteHealthBarRef.current?.setHealth((payload.health ?? 100) / 100);
      }
      if (payload.type === "hit" && payload.victimId === myUserId) {
        setHealth((h) => {
          const next = Math.max(0, h - (payload.damage ?? 20));
          if (next <= 0) {
            broadcastDeath(matchId, myUserId, payload.shooterId);
            setDead(true);
            setDeaths((d) => d + 1);
            setKillFeedEntries((e) => [...e, { youKilled: false }]);
            setTimeout(() => {
              setHealth(100);
              setDead(false);
              const local = localMeshRef.current;
              if (local) {
                local.position.copyFrom(mySlot === 1 ? SPAWN1 : SPAWN2);
                local.rotation.x = 0;
                local.rotation.z = 0;
              }
              velocityYRef.current = 0;
              groundedRef.current = true;
            }, RESPAWN_DELAY_MS);
          }
          return next;
        });
      }
      if (payload.type === "death" && payload.victimId === opponentUserId && payload.killerId === myUserId) {
        setKills((k) => {
          const next = k + 1;
          if (next >= KILLS_TO_WIN) {
            setGameEnded(true);
            setWon(true);
          }
          return next;
        });
        setKillFeedEntries((e) => [...e, { youKilled: true }]);
      }
    });
    return () => unsub?.();
  }, [matchId, myUserId, opponentUserId, mySlot]);

  useEffect(() => {
    if (!matchId) return;
    const t = setInterval(() => {
      if (gameEndedRef.current || deadRef.current) return;
      const now = Date.now();
      if (now - lastSnapshotRef.current < SNAPSHOT_MS) return;
      lastSnapshotRef.current = now;
      const local = localMeshRef.current;
      if (!local) return;
      broadcastSnapshot(matchId, {
        userId: myUserId,
        pos: [local.position.x, local.position.y, local.position.z],
        rotY: lookRef.current.yaw,
        pitch: lookRef.current.pitch,
        health,
        kills,
        deaths,
        isCrouching: crouchRef.current,
        currentWeapon: getCurrentWeapon(weaponStateRef.current).id,
      });
    }, SNAPSHOT_MS);
    return () => clearInterval(t);
  }, [matchId, myUserId, health, kills, deaths, dead, gameEnded]);

  useEffect(() => {
    if (gameEnded) return;
    if (!matchStartTsRef.current) matchStartTsRef.current = Date.now();
    const iv = setInterval(() => {
      const left = Math.max(0, MATCH_DURATION_S - (Date.now() - matchStartTsRef.current) / 1000);
      setTimeLeft(left);
      if (left <= 0) {
        setGameEnded(true);
        setWon(kills > enemyKills);
      }
    }, 500);
    return () => clearInterval(iv);
  }, [gameEnded, kills, enemyKills]);

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

  const currentWeapon = getCurrentWeapon(weaponState);
  const mag = weaponState.mag[weaponState.current] ?? 0;
  const reserve = weaponState.reserve[weaponState.current] ?? 0;
  const showScope = adsRef.current && currentWeapon.scope;

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
      <HUD
        health={health}
        kills={kills}
        deaths={deaths}
        timeLeft={timeLeft}
        mag={mag}
        reserve={reserve}
        onBack={handleLeaveMatch}
        onSettings={() => onOpenSettings?.()}
        onOpenLookSettings={() => setLookOverlayOpen(true)}
      />
      <Scoreboard slot1Kills={kills} slot2Kills={enemyKills} />
      <Crosshair style={crosshairStyle} recoil={crosshairRecoil} />
      <HitMarker show={showHitMarker} />
      <ScopeOverlay show={showScope} />
      <KillFeed entries={killFeedEntries} />
      <DamageNumbers entries={damageNumbers} project={(x, y, z) => projectWorldToScreenRef.current?.(x, y, z)} />
      <EnemyHealthBar left={enemyBarScreen.left} top={enemyBarScreen.top} health={enemyHealth} visible={enemyBarScreen.visible} />
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
        onMouseDown={(e) => { e.preventDefault(); if (e.button === 0) fire(); }}
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
        onTouchStart={(e) => { e.preventDefault(); setKeyDown("Space", true); }}
        onTouchEnd={() => setKeyDown("Space", false)}
        onMouseDown={() => setKeyDown("Space", true)}
        onMouseUp={() => setKeyDown("Space", false)}
        onMouseLeave={() => setKeyDown("Space", false)}
      >
        JUMP
      </button>
      <button
        type="button"
        style={{
          position: "absolute",
          right: 84,
          bottom: 190,
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: "2px solid var(--border)",
          background: "var(--card-2)",
          color: "var(--text)",
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
          zIndex: 15,
        }}
        onTouchStart={(e) => { e.preventDefault(); crouchRef.current = !crouchRef.current; }}
        onMouseDown={(e) => { e.preventDefault(); crouchRef.current = !crouchRef.current; }}
      >
        CROUCH
      </button>
      <button
        type="button"
        style={{
          position: "absolute",
          right: 16,
          bottom: 278,
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "2px solid var(--border)",
          background: "var(--card-2)",
          color: "var(--text)",
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
          zIndex: 15,
        }}
        onTouchStart={(e) => { e.preventDefault(); setWeaponState((s) => swapWeapon(s)); }}
        onMouseDown={(e) => { e.preventDefault(); setWeaponState((s) => swapWeapon(s)); }}
      >
        SWAP
      </button>
      <button
        type="button"
        style={{
          position: "absolute",
          right: 84,
          bottom: 278,
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: "2px solid var(--border)",
          background: "var(--card-2)",
          color: "var(--text)",
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
          zIndex: 15,
        }}
        onTouchStart={(e) => { e.preventDefault(); setWeaponState((s) => startReload(s, Date.now())); }}
        onMouseDown={(e) => { e.preventDefault(); setWeaponState((s) => startReload(s, Date.now())); }}
      >
        RELOAD
      </button>
      <button
        type="button"
        style={{
          position: "absolute",
          right: 152,
          bottom: 190,
          width: 52,
          height: 52,
          borderRadius: "50%",
          border: "2px solid var(--border)",
          background: "var(--card-2)",
          color: "var(--text)",
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
          zIndex: 15,
        }}
        onTouchStart={(e) => { e.preventDefault(); adsRef.current = true; }}
        onTouchEnd={() => { adsRef.current = false; }}
        onMouseDown={(e) => { e.preventDefault(); adsRef.current = true; }}
        onMouseUp={() => { adsRef.current = false; }}
        onMouseLeave={() => { adsRef.current = false; }}
      >
        AIM
      </button>
      {pauseOpen && (
        <PauseMenu
          onResume={() => { setPauseOpen(false); setTimeout(() => canvasRef.current?.requestPointerLock(), 50); }}
          onSettings={() => { onOpenSettings?.(); }}
          onControls={() => { onOpenSettings?.(); }}
          onLeaveMatch={handleLeaveMatch}
        />
      )}
      <ArenaSettingsOverlay
        open={lookOverlayOpen}
        onClose={() => {
          setLookOverlayOpen(false);
          setTimeout(() => canvasRef.current?.requestPointerLock(), 50);
        }}
        settings={{
          mouseSensitivityX: (Number(settings.look_sensitivity_x) || 0.0009) / 0.001,
          mouseSensitivityY: (Number(settings.look_sensitivity_y) || 0.0009) / 0.001,
          invertY: !!settings.invert_y_axis,
        }}
        onSave={(next) => {
          onLookSettingsSave?.({
            mouseSensitivityX: next.mouseSensitivityX,
            mouseSensitivityY: next.mouseSensitivityY,
            invertY: next.invertY,
          });
        }}
        canvasRef={canvasRef}
      />
      {opponentLeft && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 150, color: "#fff", fontSize: 22, fontWeight: 800 }}>
          Opponent left. Returning to lobby…
        </div>
      )}
      {gameEnded && !opponentLeft && <EndScreen won={won} kills={kills} deaths={deaths} onExit={onExit} />}
    </div>
  );
}
