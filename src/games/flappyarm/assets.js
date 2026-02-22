/**
 * FlappyArm — load and cache images. Safe loading: catch errors, retry once, resolve even if some fail.
 */

import {
  ARM_IDLE_SVG,
  ARM_FLAP_SVG,
  ARM_SHADOW_SVG,
  GYM_BG_FAR_SVG,
  GYM_BG_MID_SVG,
  GYM_BG_NEAR_SVG,
  BARBELL_SVG,
  BARBELL_GLOW_SVG,
  SPARK_PARTICLE_SVG,
  VIGNETTE_SVG,
} from "./assets/svgContent.js";

function dataUrl(svg) {
  try {
    return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent((svg || "").trim())));
  } catch (_) {
    return "";
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error("empty src"));
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("load failed"));
    img.src = src;
  });
}

const cache = {};
const keys = [
  "arm_idle",
  "arm_flap",
  "arm_shadow",
  "gym_bg_far",
  "gym_bg_mid",
  "gym_bg_near",
  "barbell",
  "barbell_glow",
  "spark_particle",
  "vignette",
];

const svgMap = {
  arm_idle: ARM_IDLE_SVG,
  arm_flap: ARM_FLAP_SVG,
  arm_shadow: ARM_SHADOW_SVG,
  gym_bg_far: GYM_BG_FAR_SVG,
  gym_bg_mid: GYM_BG_MID_SVG,
  gym_bg_near: GYM_BG_NEAR_SVG,
  barbell: BARBELL_SVG,
  barbell_glow: BARBELL_GLOW_SVG,
  spark_particle: SPARK_PARTICLE_SVG,
  vignette: VIGNETTE_SVG,
};

/**
 * Load one asset with optional retry. Returns img or null.
 */
async function loadOne(key, retry = true) {
  const svg = svgMap[key];
  const src = dataUrl(svg);
  try {
    const img = await loadImage(src);
    cache[key] = img;
    return img;
  } catch (e) {
    if (retry) {
      try {
        const img = await loadImage(src);
        cache[key] = img;
        return img;
      } catch (_) {
        return null;
      }
    }
    return null;
  }
}

/**
 * Load all assets. Never rejects. Returns { ready: true, assets: {...}, failed: [...] }.
 * ready is true so the game can always start (fallbacks used for failed assets).
 */
export function loadAllAssets() {
  const failed = [];
  const promises = keys.map(async (key) => {
    const img = await loadOne(key);
    if (!img) failed.push(key);
    return [key, img];
  });
  return Promise.all(promises)
    .then(() => ({
      ready: true,
      assets: { ...cache },
      failed: [...failed],
    }))
    .catch((e) => {
      console.error("FlappyArm loadAllAssets error:", e);
      return {
        ready: true,
        assets: { ...cache },
        failed: keys.filter((k) => !cache[k]),
      };
    });
}

/**
 * Get cached image by key. May be null if not loaded.
 */
export function getAsset(key) {
  return cache[key] || null;
}

/**
 * Return true if img is safe to draw (exists and complete).
 */
export function isAssetReady(img) {
  return img != null && img.complete && typeof img.naturalWidth === "number" && img.naturalWidth > 0;
}

/**
 * Check if all assets are loaded.
 */
export function allLoaded() {
  return keys.every((k) => isAssetReady(cache[k]));
}

/**
 * Get load status for debug overlay.
 */
export function getLoadStatus() {
  return keys.reduce((acc, k) => ({ ...acc, [k]: isAssetReady(cache[k]) }), {});
}
