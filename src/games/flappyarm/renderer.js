/**
 * FlappyArm — safe rendering. Never drawImage unless asset exists and complete; use drawFallback* otherwise.
 */

import { getAsset, isAssetReady } from "./assets.js";
import {
  CANVAS_W,
  CANVAS_H,
  GROUND_Y,
  PLAYER,
  OBSTACLE_WIDTH,
  PARALLAX_FAR,
  PARALLAX_MID,
  PARALLAX_NEAR,
  PALETTE,
} from "./constants.js";
import { getVisualRotation } from "./physics.js";
import { stepParticles } from "./juice.js";

const ARM_SIZE = 36;
const ARM_SOURCE_H = 140;

/**
 * Fallback arm: readable rounded-rect silhouette (no blob). Rotates only.
 */
export function drawFallbackArm(ctx, centerX, drawY, rotationDeg) {
  const w = 28;
  const h = ARM_SIZE;
  ctx.save();
  ctx.translate(centerX, drawY);
  ctx.rotate((rotationDeg * Math.PI) / 180);
  const r = 6;
  ctx.fillStyle = "#c9a87c";
  ctx.strokeStyle = "#2d1f14";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, r);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Fallback shadow under arm.
 */
export function drawFallbackArmShadow(ctx, centerX, drawY, shadowScaleY) {
  const sw = 50;
  const sh = 18 * Math.max(0.5, Math.min(1.5, 1 + (shadowScaleY || 0) * 0.15));
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(centerX, drawY + 10, sw / 2, sh / 2, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Fallback obstacle: bright bar with clear edge (readable).
 */
export function drawFallbackObstacle(ctx, x, y, w, h) {
  ctx.fillStyle = "#5c5f66";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#8b8f98";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(x + 2, y + 2, Math.max(0, w - 4), Math.min(8, h - 4));
}

/**
 * Draw parallax background. Fallback: gradient + simple gym silhouettes (racks, plates).
 */
export function drawBackground(ctx, totalScroll, timeSec) {
  const w = CANVAS_W;
  const h = CANVAS_H;
  const topGradient = ctx.createLinearGradient(0, 0, 0, h);
  topGradient.addColorStop(0, PALETTE.bgTop);
  topGradient.addColorStop(1, PALETTE.bgBottom);
  ctx.fillStyle = topGradient;
  ctx.fillRect(0, 0, w, h);

  const far = getAsset("gym_bg_far");
  if (isAssetReady(far)) {
    const sx = (totalScroll * PARALLAX_FAR) % (far.width || 400);
    ctx.drawImage(far, -sx, 0, far.width || 400, far.height || 520, 0, 0, w, h);
    ctx.drawImage(far, -sx + (far.width || 400), 0, far.width || 400, far.height || 520, 0, 0, w, h);
  } else {
    ctx.fillStyle = "rgba(15,17,20,0.85)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#15181e";
    [20, 80, 300, 340].forEach((x) => ctx.fillRect((x + (totalScroll * PARALLAX_FAR) % 400) % (w + 60) - 30, 80, 28, 100));
  }

  const mid = getAsset("gym_bg_mid");
  if (isAssetReady(mid)) {
    const sx = (totalScroll * PARALLAX_MID) % (mid.width || 400);
    ctx.drawImage(mid, -sx, 0, mid.width || 400, mid.height || 520, 0, 0, w, h);
    ctx.drawImage(mid, -sx + (mid.width || 400), 0, mid.width || 400, mid.height || 520, 0, 0, w, h);
  } else {
    ctx.fillStyle = "#1a1d24";
    [50, 120, 250, 310].forEach((x) => ctx.fillRect((x + (totalScroll * PARALLAX_MID) % 400) % (w + 80) - 20, 180, 24, 90));
  }

  const near = getAsset("gym_bg_near");
  if (isAssetReady(near)) {
    const sx = (totalScroll * PARALLAX_NEAR) % (near.width || 400);
    ctx.globalAlpha = 0.7;
    ctx.drawImage(near, -sx, 0, near.width || 400, near.height || 520, 0, 0, w, h);
    ctx.drawImage(near, -sx + (near.width || 400), 0, near.width || 400, near.height || 520, 0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(0, GROUND_Y, w, h - GROUND_Y);

  const cx = CANVAS_W / 2;
  const radial = ctx.createRadialGradient(cx, 260, 0, cx, 260, 200);
  radial.addColorStop(0, "rgba(255,255,255,0.03)");
  radial.addColorStop(1, "transparent");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, w, GROUND_Y);
}

/**
 * Draw obstacles. Fallback: bright bars with edge.
 */
export function drawObstacles(ctx, obstacles) {
  const barbell = getAsset("barbell");
  const glow = getAsset("barbell_glow");
  const useAssets = isAssetReady(barbell);
  obstacles.forEach((ob) => {
    if (useAssets && isAssetReady(glow)) {
      ctx.globalAlpha = 0.6;
      ctx.drawImage(glow, ob.x - 4, ob.top.y, OBSTACLE_WIDTH + 8, ob.top.h + 4, ob.x - 4, ob.top.y, OBSTACLE_WIDTH + 8, ob.top.h + 4);
      ctx.drawImage(glow, ob.x - 4, ob.bottom.y - 4, OBSTACLE_WIDTH + 8, ob.bottom.h + 4, ob.x - 4, ob.bottom.y - 4, OBSTACLE_WIDTH + 8, ob.bottom.h + 4);
      ctx.globalAlpha = 1;
    }
    if (useAssets) {
      const bw = 140;
      const bh = 520;
      const srcHTop = Math.min(bh, (ob.top.h / OBSTACLE_WIDTH) * bw);
      const srcHBot = Math.min(bh, (ob.bottom.h / OBSTACLE_WIDTH) * bw);
      ctx.drawImage(barbell, 0, 0, bw, srcHTop, ob.x, ob.top.y, OBSTACLE_WIDTH, ob.top.h);
      ctx.drawImage(barbell, 0, bh - srcHBot, bw, srcHBot, ob.x, ob.bottom.y, OBSTACLE_WIDTH, ob.bottom.h);
    } else {
      drawFallbackObstacle(ctx, ob.x, ob.top.y, OBSTACLE_WIDTH, ob.top.h);
      drawFallbackObstacle(ctx, ob.x, ob.bottom.y, OBSTACLE_WIDTH, ob.bottom.h);
    }
  });
}

/**
 * Draw arm (asset or fallback). Arm rotates only, no scale/stretch.
 */
export function drawArm(ctx, centerX, drawY, rotationDeg, isFlapFrame, shadowScaleY) {
  const shadowImg = getAsset("arm_shadow");
  if (isAssetReady(shadowImg) && shadowScaleY != null) {
    const sw = 60;
    const sh = 20 * Math.max(0.5, Math.min(1.5, 1 + shadowScaleY * 0.15));
    ctx.globalAlpha = 0.5;
    ctx.drawImage(shadowImg, centerX - sw / 2, drawY + 8, sw, sh);
    ctx.globalAlpha = 1;
  } else {
    drawFallbackArmShadow(ctx, centerX, drawY, shadowScaleY);
  }

  const armImg = getAsset(isFlapFrame ? "arm_flap" : "arm_idle");
  if (isAssetReady(armImg)) {
    const scale = ARM_SIZE / ARM_SOURCE_H;
    const w = 220 * scale;
    const h = ARM_SIZE;
    ctx.save();
    ctx.translate(centerX, drawY);
    ctx.rotate((rotationDeg * Math.PI) / 180);
    ctx.drawImage(armImg, -w / 2, -h / 2, w, h);
    ctx.restore();
  } else {
    drawFallbackArm(ctx, centerX, drawY, rotationDeg);
  }
}

/**
 * Draw particles. Fallback: circle if spark asset missing.
 */
export function drawParticles(ctx, particles) {
  const spark = getAsset("spark_particle");
  const useSpark = isAssetReady(spark);
  particles.forEach((p) => {
    ctx.globalAlpha = Math.max(0, p.life);
    if (useSpark) {
      const sz = (p.size || 4) * 2;
      ctx.drawImage(spark, p.x - sz / 2, p.y - sz / 2, sz, sz);
    } else {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size || 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
}

/**
 * Draw vignette. Fallback: radial gradient.
 */
export function drawVignette(ctx) {
  const vig = getAsset("vignette");
  if (isAssetReady(vig)) {
    ctx.drawImage(vig, 0, 0, CANVAS_W, CANVAS_H);
  } else {
    const g = ctx.createRadialGradient(CANVAS_W / 2, CANVAS_H / 2, 0, CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.7);
    g.addColorStop(0, "transparent");
    g.addColorStop(1, PALETTE.vignette);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }
}

/**
 * Draw in-game score: bold, shadow, high contrast.
 */
export function drawScore(ctx, score, popScale = 1) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "900 28px system-ui, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.95)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.setTransform(popScale, 0, 0, popScale, CANVAS_W / 2, 24);
  ctx.fillText(String(score), 0, 0);
  ctx.restore();
}

/**
 * Full frame. Never throws; uses fallbacks for any missing asset.
 */
export function drawFrame(ctx, state, particles, shakeX, shakeY, scoreVal, scorePopScale) {
  const timeSec = Date.now() / 1000;
  ctx.save();
  if (shakeX || shakeY) ctx.translate(shakeX, shakeY);

  drawBackground(ctx, state.totalScroll || 0, timeSec);
  drawObstacles(ctx, state.obstacles || []);
  drawParticles(ctx, particles || []);

  const playerHalf = PLAYER.size / 2;
  const centerX = CANVAS_W / 2;
  const drawY = (state.prevY ?? state.y) + playerHalf;
  const bobbing = Math.sin(timeSec * 2) * 1.5;
  const visualRot = getVisualRotation(state.vy, state.prevRot ?? state.rotation);
  const isFlap = (state.vy ?? 0) < 0;
  const shadowScale = state.vy != null ? state.vy * 0.1 : 0;
  drawArm(ctx, centerX, drawY + bobbing, visualRot, isFlap, shadowScale);

  if (scoreVal != null) drawScore(ctx, scoreVal, scorePopScale ?? 1);
  drawVignette(ctx);
  ctx.restore();
}

/**
 * Debug: hitboxes, FPS, asset status (D key).
 */
export function drawDebugOverlay(ctx, state) {
  const px = CANVAS_W / 2;
  const padX = PLAYER.hitboxPadX ?? 8;
  const padY = PLAYER.hitboxPadY ?? 12;
  ctx.strokeStyle = "lime";
  ctx.lineWidth = 1;
  ctx.strokeRect(px - PLAYER.size / 2 - padX, state.y - padY, PLAYER.size + padX * 2, PLAYER.size + padY * 2);
  (state.obstacles || []).forEach((ob) => {
    ctx.strokeStyle = "red";
    ctx.strokeRect(ob.x, ob.top.y, OBSTACLE_WIDTH, ob.top.h);
    ctx.strokeRect(ob.x, ob.bottom.y, OBSTACLE_WIDTH, ob.bottom.h);
  });
}
