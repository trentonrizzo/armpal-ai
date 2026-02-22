/**
 * FlappyArm — screen shake, particles, flashes, tween easing. No linear movement for UI.
 */

// ---------- Easing (ease out = quick start, ease in = quick end) ----------
export function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}
export function easeInQuad(t) {
  return t * t;
}
export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}
export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Screen shake: returns { x, y } offset for this frame. Decrement remaining each frame.
 */
export function getShakeOffset(remaining, intensity = 6) {
  if (remaining <= 0) return { x: 0, y: 0 };
  return {
    x: (Math.random() - 0.5) * 2 * intensity,
    y: (Math.random() - 0.5) * 2 * intensity,
  };
}

/**
 * Flap camera bounce: 1–2px up then settle. progress 0..1, ease out.
 */
export function getFlapBounceOffset(progress) {
  if (progress >= 1) return 0;
  return 2 * (1 - easeOutQuad(progress));
}

/**
 * Score pop scale: scale up then settle. progress 0..1.
 */
export function getScorePopScale(progress, maxScale = 1.2) {
  if (progress >= 1) return 1;
  if (progress < 0.5) return 1 + (maxScale - 1) * easeOutQuad(progress * 2);
  return maxScale - (maxScale - 1) * easeInQuad((progress - 0.5) * 2);
}

/**
 * Whoosh particle for flap: short trail, fast fade.
 */
export function createWhooshParticles(count, originX, originY) {
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({
      x: originX,
      y: originY,
      vx: -2 - Math.random() * 2,
      vy: (Math.random() - 0.5) * 2,
      life: 0.3 + Math.random() * 0.25,
      size: 2 + Math.random() * 2,
    });
  }
  return out;
}

/**
 * Score burst particles at (x, y).
 */
export function createScoreBurstParticles(x, y, count = 6) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random();
    const v = 1.5 + Math.random() * 2;
    out.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 1,
      life: 0.4 + Math.random() * 0.3,
      size: 3,
    });
  }
  return out;
}

/**
 * Step particles: move, age, return still-alive list.
 */
export function stepParticles(particles, dt = 0.016) {
  const next = [];
  particles.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.life -= dt;
    if (p.life > 0) next.push(p);
  });
  return next;
}
