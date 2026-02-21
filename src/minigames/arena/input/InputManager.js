/**
 * ArmPal Arena — central input state: keyboard, mouse, gamepad, touch.
 * Supports remappable binds; defaults: WASD, Space, Shift, C/Ctrl, R, 1/2/3, LMB fire, RMB aim, ESC pause, V camera, Tab scoreboard, F interact.
 */

const DEFAULT_KB = {
  move_forward: "KeyW",
  move_back: "KeyS",
  move_left: "KeyA",
  move_right: "KeyD",
  jump: "Space",
  sprint: "ShiftLeft",
  crouch: "KeyC",
  crouch_hold: "ControlLeft",
  fire: "Mouse0",
  aim: "Mouse1",
  reload: "KeyR",
  weapon_1: "Digit1",
  weapon_2: "Digit2",
  weapon_3: "Digit3",
  interact: "KeyF",
  scoreboard: "Tab",
  pause: "Escape",
  camera_toggle: "KeyV",
};

const CODE_TO_ACTION = {};
Object.entries(DEFAULT_KB).forEach(([action, code]) => {
  CODE_TO_ACTION[code] = action;
});
["ShiftRight", "ControlRight"].forEach((c) => (CODE_TO_ACTION[c] = "sprint" in DEFAULT_KB && DEFAULT_KB.sprint === "ShiftLeft" ? "sprint" : "crouch_hold"));

export function getKeyAction(code, button = null) {
  if (button !== null) {
    const mouse = "Mouse" + button;
    return CODE_TO_ACTION[mouse] || null;
  }
  return CODE_TO_ACTION[code] || null;
}

export function applyBindsKeyboard(binds) {
  const kb = binds?.keyboard || DEFAULT_KB;
  Object.keys(CODE_TO_ACTION).forEach((k) => delete CODE_TO_ACTION[k]);
  Object.entries(kb).forEach(([action, code]) => {
    CODE_TO_ACTION[code] = action;
  });
  if (CODE_TO_ACTION["ShiftRight"] === undefined) CODE_TO_ACTION["ShiftRight"] = "sprint";
  if (CODE_TO_ACTION["ControlRight"] === undefined) CODE_TO_ACTION["ControlRight"] = "crouch_hold";
}

const keysDown = {};
export function setKeyDown(code, down) {
  keysDown[code] = down;
}
export function isKeyDown(code) {
  return !!keysDown[code];
}
export function getKeyState() {
  return { ...keysDown };
}

const mouseButtons = { 0: false, 1: false, 2: false };
export function setMouseButton(button, down) {
  mouseButtons[button] = down;
}
export function isMouseButtonDown(button) {
  return !!mouseButtons[button];
}

export function getMoveVectorFromKeys(binds) {
  const kb = binds?.keyboard || DEFAULT_KB;
  const forward = keysDown[kb.move_forward] || keysDown["KeyW"];
  const back = keysDown[kb.move_back] || keysDown["KeyS"];
  const left = keysDown[kb.move_left] || keysDown["KeyA"];
  const right = keysDown[kb.move_right] || keysDown["KeyD"];
  let x = 0,
    z = 0;
  if (right) x += 1;
  if (left) x -= 1;
  if (forward) z += 1;
  if (back) z -= 1;
  const len = Math.sqrt(x * x + z * z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  return { x, z };
}

export function getSprintFromKeys(binds) {
  const kb = binds?.keyboard || DEFAULT_KB;
  return !!(keysDown[kb.sprint] || keysDown["ShiftLeft"] || keysDown["ShiftRight"]);
}

export function getJumpFromKeys(binds) {
  const kb = binds?.keyboard || DEFAULT_KB;
  return !!(keysDown[kb.jump] || keysDown["Space"]);
}

export function getCrouchFromKeys(binds) {
  const kb = binds?.keyboard || DEFAULT_KB;
  return !!(keysDown[kb.crouch] || keysDown[kb.crouch_hold] || keysDown["KeyC"] || keysDown["ControlLeft"] || keysDown["ControlRight"]);
}

export function getFireFromInput(binds) {
  const kb = binds?.keyboard || DEFAULT_KB;
  if (kb.fire === "Mouse0") return mouseButtons[0];
  if (keysDown[kb.fire]) return true;
  return false;
}

export function getAimFromInput(binds) {
  const kb = binds?.keyboard || DEFAULT_KB;
  if (kb.aim === "Mouse1") return mouseButtons[1];
  return !!(keysDown[kb.aim]);
}

export function getReloadFromKeys(binds) {
  const kb = binds?.keyboard || DEFAULT_KB;
  return !!(keysDown[kb.reload] || keysDown["KeyR"]);
}

export function getWeaponSlotFromKeys(binds) {
  const kb = binds?.keyboard || DEFAULT_KB;
  if (keysDown[kb.weapon_1] || keysDown["Digit1"]) return 1;
  if (keysDown[kb.weapon_2] || keysDown["Digit2"]) return 2;
  if (keysDown[kb.weapon_3] || keysDown["Digit3"]) return 3;
  return 0;
}

export function getPauseFromKeys(binds) {
  const kb = binds?.keyboard || DEFAULT_KB;
  return !!(keysDown[kb.pause] || keysDown["Escape"]);
}

export function getCameraToggleFromKeys(binds) {
  const kb = binds?.keyboard || DEFAULT_KB;
  return !!(keysDown[kb.camera_toggle] || keysDown["KeyV"]);
}

export function getScoreboardFromKeys(binds) {
  const kb = binds?.keyboard || DEFAULT_KB;
  return !!(keysDown[kb.scoreboard] || keysDown["Tab"]);
}

/** Gamepad: default LT=6 aim, RT=7 fire, A=0 jump, B=1 crouch, Y=3 swap, X=2 reload, Start=9 pause, R3=10 camera */
export function getGamepadState(index, deadzone, sens, invertY, binds) {
  const pads = navigator.getGamepads?.();
  const p = pads?.[index ?? 0];
  if (!p?.connected) return null;
  const dead = (v) => (v === undefined || Math.abs(v) < deadzone ? 0 : v);
  const gp = binds?.gamepad || {};
  const moveX = dead(p.axes[parseInt(gp.move_axis_x || "0", 10)]);
  const moveY = dead(p.axes[parseInt(gp.move_axis_y || "1", 10)]);
  const lookX = dead(p.axes[parseInt(gp.look_axis_x || "2", 10)]);
  const lookY = dead(p.axes[parseInt(gp.look_axis_y || "3", 10)]);
  return {
    move: { x: moveX * sens, z: -moveY * sens },
    look: { x: lookX * sens * 0.02, y: (invertY ? 1 : -1) * lookY * sens * 0.02 },
    jump: !!p.buttons[parseInt(gp.jump || "0", 10)]?.pressed,
    crouch: !!p.buttons[parseInt(gp.crouch || "1", 10)]?.pressed,
    fire: !!p.buttons[parseInt(gp.fire || "7", 10)]?.pressed,
    aim: !!p.buttons[parseInt(gp.aim || "6", 10)]?.pressed,
    reload: !!p.buttons[parseInt(gp.reload || "2", 10)]?.pressed,
    weaponSwap: !!p.buttons[parseInt(gp.weapon_swap || "3", 10)]?.pressed,
    pause: !!p.buttons[parseInt(gp.pause || "9", 10)]?.pressed,
    cameraToggle: !!p.buttons[parseInt(gp.camera_toggle || "10", 10)]?.pressed,
  };
}

export function keyCodeToBindName(code) {
  if (typeof code === "string" && code.startsWith("Mouse")) return code;
  return code || "";
}

export function mouseButtonToBindName(button) {
  return "Mouse" + (button ?? 0);
}
