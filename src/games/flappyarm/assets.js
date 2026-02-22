/**
 * FlappyArm — load and cache images. Uses SVG data URLs until WebP assets exist.
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
  return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg.trim())));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
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
 * Load all assets. Returns { [key]: HTMLImageElement }.
 */
export function loadAllAssets() {
  const entries = keys.map((key) =>
    loadImage(dataUrl(svgMap[key])).then((img) => {
      cache[key] = img;
      return [key, img];
    })
  );
  return Promise.all(entries).then(() => ({ ...cache }));
}

/**
 * Get cached image by key. May be null if not loaded yet.
 */
export function getAsset(key) {
  return cache[key] || null;
}

/**
 * Check if all assets are loaded.
 */
export function allLoaded() {
  return keys.every((k) => cache[k] != null);
}

/**
 * Get load status for debug overlay.
 */
export function getLoadStatus() {
  return keys.reduce((acc, k) => ({ ...acc, [k]: !!cache[k] }), {});
}
