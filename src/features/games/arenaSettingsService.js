/**
 * Unified arena look settings: used by both Multiplayer Arena and Arena Trainer.
 * Prefers arena_settings table when userId is present; falls back to localStorage.
 * Slider scale: 0.1–3.0 (default 0.9). Stored in DB as look_sensitivity_x/y = value * 0.001.
 */
import { getArenaSettings, saveArenaSettings } from "../../minigames/arena/arenaDb";

const STORAGE_KEY = "arena_look_settings";
const SENS_SCALE = 0.001;

export function getDefaultLookSettings() {
  return {
    mouseSensitivityX: 0.9,
    mouseSensitivityY: 0.9,
    invertY: false,
    fov: 75,
    showCrosshair: true,
  };
}

/**
 * Map DB row to overlay shape. DB stores raw multiplier (e.g. 0.0009); we show 0.9.
 */
function fromDb(settings) {
  if (!settings) return getDefaultLookSettings();
  const rawX = Number(settings.look_sensitivity_x);
  const rawY = Number(settings.look_sensitivity_y);
  return {
    mouseSensitivityX: rawX ? rawX / SENS_SCALE : 0.9,
    mouseSensitivityY: rawY ? rawY / SENS_SCALE : 0.9,
    invertY: !!settings.invert_y_axis,
    fov: Math.max(60, Math.min(110, Number(settings.fov) ?? 75)),
    showCrosshair: true,
  };
}

/**
 * Map overlay shape to DB fields (merge with existing).
 */
function toDb(look) {
  return {
    look_sensitivity_x: Number(look.mouseSensitivityX) * SENS_SCALE || 0.0009,
    look_sensitivity_y: Number(look.mouseSensitivityY) * SENS_SCALE || 0.0009,
    invert_y_axis: !!look.invertY,
    fov: Math.max(60, Math.min(110, Number(look.fov) ?? 75)),
  };
}

/**
 * Load look settings. If userId is set, use arena_settings; otherwise localStorage.
 */
export async function getArenaLookSettings(userId) {
  const defaults = getDefaultLookSettings();
  if (userId) {
    try {
      const s = await getArenaSettings(userId);
      return { ...defaults, ...fromDb(s) };
    } catch (_) {
      // fall through to localStorage
    }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...defaults,
        mouseSensitivityX: Number(parsed.mouseSensitivityX) || defaults.mouseSensitivityX,
        mouseSensitivityY: Number(parsed.mouseSensitivityY) || defaults.mouseSensitivityY,
        invertY: !!parsed.invertY,
        fov: Math.max(60, Math.min(110, Number(parsed.fov) ?? defaults.fov)),
        showCrosshair: parsed.showCrosshair !== false,
      };
    }
  } catch (_) {}
  return defaults;
}

/**
 * Save look settings. If userId is set, merge into arena_settings and save; always write localStorage.
 */
export async function saveArenaLookSettings(userId, lookSettings) {
  const next = {
    ...getDefaultLookSettings(),
    ...lookSettings,
    mouseSensitivityX: Math.max(0.1, Math.min(3, Number(lookSettings.mouseSensitivityX) || 0.9)),
    mouseSensitivityY: Math.max(0.1, Math.min(3, Number(lookSettings.mouseSensitivityY) || 0.9)),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (_) {}
  if (userId) {
    try {
      const current = await getArenaSettings(userId);
      const merged = { ...current, ...toDb(next) };
      await saveArenaSettings(userId, merged);
    } catch (_) {}
  }
  return next;
}

/**
 * Raw sensitivity multiplier for game loop (from overlay value).
 */
export function toSensMultiplier(sliderValue) {
  return (Number(sliderValue) || 0.9) * SENS_SCALE;
}
