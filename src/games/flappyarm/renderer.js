/**
 * FlappyArm — draws sprites, parallax, effects. No physics. Uses assets only (no primitive shapes for main art).
 */

import { getAsset } from "./assets.js";
import { CANVAS_W, CANVAS_H, GROUND_Y, PLAYER, OBSTACLE_WIDTH, PARALLAX_FAR, PARALLAX_MID, PARALLAX_NEAR, PALETTE } from "./constants.js";
import { getVisualRotation } from "./physics.js";
import { stepParticles } from "./juice.js";

const ARM_SIZE = 36;
const ARM_SOURCE_H = 140;

/**
 * Draw parallax background (3 layers). Uses asset images.
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
  const mid = getAsset("gym_bg_mid");
  const near = getAsset("gym_bg_near");
  if (far) {
    const sx = (totalScroll * PARALLAX_FAR) % (far.width || 400);
    ctx.drawImage(far, -sx, 0, far.width || 400, far.height || 520, 0, 0, w, h);
    ctx.drawImage(far, -sx + (far.width || 400), 0, far.width || 400, far.height || 520, 0, 0, w, h);
  }
  if (mid) {
    const sx = (totalScroll * PARALLAX_MID) % (mid.width || 400);
    ctx.drawImage(mid, -sx, 0, mid.width || 400, mid.height || 520, 0, 0, w, h);
    ctx.drawImage(mid, -sx + (mid.width || 400), 0, mid.width || 400, mid.height || 520, 0, 0, w, h);
  }
  if (near) {
    const sx = (totalScroll * PARALLAX_NEAR) % (near.width || 400);
    ctx.globalAlpha = 0.7;
    ctx.drawImage(near, -sx, 0, near.width || 400, near.height || 520, 0, 0, w, h);
    ctx.drawImage(near, -sx + (near.width || 400), 0, near.width || 400, near.height || 520, 0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(0, GROUND_Y, w, h - GROUND_Y);
}

/**
 * Draw obstacles (barbell segments). Uses barbell + barbell_glow assets.
 */
export function drawObstacles(ctx, obstacles) {
  const barbell = getAsset("barbell");
  const glow = getAsset("barbell_glow");
  obstacles.forEach((ob) => {
    if (glow) {
      ctx.globalAlpha = 0.6;
      ctx.drawImage(glow, ob.x - 4, ob.top.y, OBSTACLE_WIDTH + 8, ob.top.h + 4, ob.x - 4, ob.top.y, OBSTACLE_WIDTH + 8, ob.top.h + 4);
      ctx.drawImage(glow, ob.x - 4, ob.bottom.y - 4, OBSTACLE_WIDTH + 8, ob.bottom.h + 4, ob.x - 4, ob.bottom.y - 4, OBSTACLE_WIDTH + 8, ob.bottom.h + 4);
      ctx.globalAlpha = 1;
    }
    if (barbell) {
      const bw = 140;
      const bh = 520;
      const srcHTop = Math.min(bh, (ob.top.h / OBSTACLE_WIDTH) * bw);
      ctx.drawImage(barbell, 0, 0, bw, srcHTop, ob.x, ob.top.y, OBSTACLE_WIDTH, ob.top.h);
      const srcHBot = Math.min(bh, (ob.bottom.h / OBSTACLE_WIDTH) * bw);
      ctx.drawImage(barbell, 0, bh - srcHBot, bw, srcHBot, ob.x, ob.bottom.y, OBSTACLE_WIDTH, ob.bottom.h);
    }
  });
}

/**
 * Draw arm (idle or flap frame), shadow, rotation. Uses arm_idle / arm_flap and arm_shadow assets.
 */
export function drawArm(ctx, centerX, drawY, rotationDeg, isFlapFrame, shadowScaleY) {
  const shadowImg = getAsset("arm_shadow");
  if (shadowImg && shadowScaleY != null) {
    const sw = 60;
    const sh = 20 * Math.max(0.5, Math.min(1.5, 1 + shadowScaleY * 0.15));
    ctx.globalAlpha = 0.4;
    ctx.drawImage(shadowImg, centerX - sw / 2, drawY + 8, sw, sh);
    ctx.globalAlpha = 1;
  }
  const armImg = getAsset(isFlapFrame ? "arm_flap" : "arm_idle");
  if (!armImg) return;
  const scale = ARM_SIZE / ARM_SOURCE_H;
  const w = 220 * scale;
  const h = ARM_SIZE;
  ctx.save();
  ctx.translate(centerX, drawY);
  ctx.rotate((rotationDeg * Math.PI) / 180);
  ctx.drawImage(armImg, -w / 2, -h / 2, w, h);
  ctx.restore();
}

/**
 * Draw particles (spark image or fallback small circle only for juice — spec allows for effects).
 */
export function drawParticles(ctx, particles) {
  const spark = getAsset("spark_particle");
  particles.forEach((p) => {
    ctx.globalAlpha = Math.max(0, p.life);
    if (spark) {
      const sz = (p.size || 4) * 2;
      ctx.drawImage(spark, p.x - sz / 2, p.y - sz / 2, sz, sz);
    } else {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, (p.size || 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
}

/**
 * Draw vignette overlay.
 */
export function drawVignette(ctx) {
  const vig = getAsset("vignette");
  if (vig) ctx.drawImage(vig, 0, 0, CANVAS_W, CANVAS_H);
  else {
    const g = ctx.createRadialGradient(CANVAS_W / 2, CANVAS_H / 2, 0, CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.7);
    g.addColorStop(0, "transparent");
    g.addColorStop(1, PALETTE.vignette);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }
}

/**
 * Draw in-game score at top center with optional pop scale.
 */
export function drawScore(ctx, score, popScale = 1) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "900 28px system-ui, sans-serif";
  ctx.fillStyle = "#fff";
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 4;
  ctx.setTransform(popScale, 0, 0, popScale, CANVAS_W / 2, 24);
  ctx.fillText(String(score), 0, 0);
  ctx.restore();
}

/**
 * Full frame: background, obstacles, particles, arm, score, vignette. Optional shake offset.
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
 * Debug: hitbox outlines and collision boxes only.
 */
export function drawDebugOverlay(ctx, state) {
  const px = CANVAS_W / 2;
  const py = state.y + PLAYER.size / 2;
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
