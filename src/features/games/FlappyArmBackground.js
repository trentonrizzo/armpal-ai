/**
 * Flappy Arm — gym environment background.
 * Back: squat rack silhouettes, mounted barbells, depth.
 * Mid: dumbbell racks, benches, darker gym lighting.
 * Front: dust particles, soft spotlight glow.
 * Parallax: back 0.2x, mid 0.5x. No flat gradient only.
 */

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w - CANVAS_W
 * @param {number} h - CANVAS_H
 * @param {number} groundY
 * @param {number} totalScroll
 * @param {number} scrollSpeed
 * @param {number} time - seconds for subtle animation
 */
export function drawGymBackground(ctx, w, h, groundY, totalScroll, scrollSpeed, time) {
  const backOffset = (totalScroll * 0.2) % (w + 280);
  const midOffset = (totalScroll * 0.5) % (w + 200);
  const t = time * 0.4;

  // —— Back layer: squat rack silhouettes + mounted barbells ——
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = "#0a0a0c";
  ctx.fillRect(0, 0, w, groundY);
  const wallGrad = ctx.createLinearGradient(0, 0, 0, groundY);
  wallGrad.addColorStop(0, "#0f0f12");
  wallGrad.addColorStop(0.6, "#14141a");
  wallGrad.addColorStop(1, "#0c0c0f");
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, 0, w, groundY);

  for (let i = -1; i < 4; i++) {
    const bx = -backOffset + i * (w * 0.38) + 30;
    // Squat rack silhouette (uprights + crossbar)
    ctx.fillStyle = "#1a1a1e";
    ctx.fillRect(bx, 20, 6, groundY - 20);
    ctx.fillRect(bx + 52, 20, 6, groundY - 20);
    ctx.fillRect(bx, 24, 58, 5);
    ctx.fillRect(bx, groundY - 95, 58, 5);
    // Mounted barbell (horizontal bar on rack)
    ctx.fillStyle = "#2a2a2e";
    ctx.fillRect(bx + 8, 50, 42, 4);
    ctx.beginPath();
    ctx.arc(bx + 12, 52, 6, 0, Math.PI * 2);
    ctx.arc(bx + 46, 52, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // —— Mid layer: dumbbell racks, benches ——
  ctx.save();
  ctx.globalAlpha = 0.78;
  for (let i = -1; i < 4; i++) {
    const mx = -midOffset + i * (w * 0.42) + 15;
    // Dumbbell rack (tiered shelves)
    ctx.fillStyle = "#1e1e22";
    ctx.fillRect(mx, groundY - 70, 50, 6);
    ctx.fillRect(mx + 2, groundY - 55, 46, 5);
    ctx.fillRect(mx + 4, groundY - 40, 42, 5);
    ctx.fillStyle = "#252530";
    ctx.fillRect(mx + 8, groundY - 68, 8, 18);
    ctx.fillRect(mx + 22, groundY - 68, 8, 18);
    ctx.fillRect(mx + 34, groundY - 68, 8, 18);
    // Bench silhouette
    ctx.fillStyle = "#1a1a1f";
    ctx.fillRect(mx + 55, groundY - 35, 45, 10);
    ctx.fillRect(mx + 58, groundY - 80, 6, 50);
    ctx.fillRect(mx + 92, groundY - 80, 6, 50);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // —— Front: dust particles + soft spotlight ——
  ctx.save();
  ctx.fillStyle = "#fff";
  for (let i = 0; i < 12; i++) {
    const px = (i * 97 + totalScroll * 0.15) % (w + 60) - 20;
    const py = (groundY - 150 + (i * 41) % 180) + Math.sin(t + i * 0.7) * 4;
    ctx.globalAlpha = 0.08 + Math.sin(t + i) * 0.04;
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Soft spotlight (radial from top-center)
  const spotGrad = ctx.createRadialGradient(w / 2, 80, 0, w / 2, 200, 220);
  spotGrad.addColorStop(0, "rgba(255,248,240,0.06)");
  spotGrad.addColorStop(0.5, "rgba(255,248,240,0.02)");
  spotGrad.addColorStop(1, "rgba(255,248,240,0)");
  ctx.fillStyle = spotGrad;
  ctx.fillRect(0, 0, w, groundY);
  ctx.restore();
}
