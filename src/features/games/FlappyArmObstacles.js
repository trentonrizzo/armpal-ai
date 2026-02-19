/**
 * Flappy Arm — obstacle visuals: barbell and dumbbell (chrome/steel).
 * Same gap and spawn logic; only rendering replaced.
 */

const PLATE_HEIGHT = 8;

function drawPlate(ctx, cx, cy, r, h) {
  const g = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
  g.addColorStop(0, "#1a1a1a");
  g.addColorStop(0.3, "#4a4a4a");
  g.addColorStop(0.5, "#7a7a7a");
  g.addColorStop(0.7, "#4a4a4a");
  g.addColorStop(1, "#2a2a2a");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, h, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

/**
 * Draw a barbell segment (long bar + plates) in the given rect.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w - OBSTACLE_WIDTH
 * @param {number} h - segment height
 * @param {boolean} isTop - true = top obstacle (hangs down)
 */
export function drawBarbell(ctx, x, y, w, h, isTop) {
  const cx = x + w / 2;
  const barHeight = Math.min(12, h * 0.15);
  const plateR = Math.min(w * 0.35, 20);
  const plateW = 6;

  // Shadow under equipment
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(cx, y + h - 4, w * 0.6, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();

  // Bar — long steel
  const barY = isTop ? y + barHeight : y + h - barHeight;
  const barGrad = ctx.createLinearGradient(x, barY, x + w, barY);
  barGrad.addColorStop(0, "#2a2a2a");
  barGrad.addColorStop(0.2, "#5a5a5a");
  barGrad.addColorStop(0.5, "#8a8a8a");
  barGrad.addColorStop(0.8, "#5a5a5a");
  barGrad.addColorStop(1, "#2a2a2a");
  ctx.fillStyle = barGrad;
  ctx.fillRect(x, barY - barHeight / 2, w, barHeight);

  // Plates at each end
  const plateY = barY;
  const plateLeft = x + w * 0.2;
  const plateRight = x + w * 0.8;
  drawPlate(ctx, plateLeft, plateY, plateR, PLATE_HEIGHT);
  drawPlate(ctx, plateRight, plateY, plateR, PLATE_HEIGHT);

  ctx.restore();
}

/**
 * Draw a dumbbell segment (shorter handle, thick plates).
 */
export function drawDumbbell(ctx, x, y, w, h, isTop) {
  const cx = x + w / 2;
  const handleW = w * 0.4;
  const handleH = Math.min(10, h * 0.12);
  const plateR = Math.min(w * 0.4, 22);
  const plateH = 10;

  ctx.save();

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(cx, y + h - 5, w * 0.5, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  const barY = isTop ? y + handleH : y + h - handleH;
  const hGrad = ctx.createLinearGradient(cx - handleW / 2, barY, cx + handleW / 2, barY);
  hGrad.addColorStop(0, "#1a1a1a");
  hGrad.addColorStop(0.5, "#6a6a6a");
  hGrad.addColorStop(1, "#1a1a1a");
  ctx.fillStyle = hGrad;
  ctx.fillRect(cx - handleW / 2, barY - handleH / 2, handleW, handleH);

  [cx - handleW / 2 - plateR * 0.5, cx + handleW / 2 + plateR * 0.5].forEach((px) => {
    const pg = ctx.createRadialGradient(px - 4, barY, 0, px, barY, plateR);
    pg.addColorStop(0, "#8a8a8a");
    pg.addColorStop(0.4, "#5a5a5a");
    pg.addColorStop(1, "#2a2a2a");
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.ellipse(px, barY, plateR * 0.6, plateH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.stroke();
  });

  ctx.restore();
}
