/**
 * Flappy Arm — obstacles: VERTICAL BARBELL only.
 * Olympic barbell, side profile: chrome shaft + plates (45, 25, 10).
 * Spawn/gap/collision unchanged. No clips/collars.
 */

const BAR_WIDTH = 6; // chrome shaft thickness (vertical bar)
const PLATE_45_R = 14;
const PLATE_25_R = 11;
const PLATE_10_R = 8;

/**
 * Draw one plate (side view = circle/ellipse) with metal shading.
 */
function drawPlate(ctx, cx, cy, radius, thickness) {
  const g = ctx.createRadialGradient(cx - radius * 0.3, cy, 0, cx, cy, radius * 1.1);
  g.addColorStop(0, "#6a6a6a");
  g.addColorStop(0.25, "#9a9a9a");
  g.addColorStop(0.5, "#c0c0c0");
  g.addColorStop(0.75, "#7a7a7a");
  g.addColorStop(1, "#3a3a3a");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, cy, radius, thickness, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

/**
 * Draw vertical Olympic barbell segment (side profile).
 * Bar runs vertically; plates 45, 25, 10 stacked. Bar extends past plates.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - rect left
 * @param {number} y - rect top
 * @param {number} w - OBSTACLE_WIDTH
 * @param {number} h - segment height
 * @param {boolean} isTop - true = segment hangs from top (bar goes down from y)
 */
export function drawVerticalBarbell(ctx, x, y, w, h, isTop) {
  const cx = x + w / 2;
  const barLeft = cx - BAR_WIDTH / 2;
  const barRight = cx + BAR_WIDTH / 2;

  // Shadow under segment
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(cx, y + h - 6, w * 0.55, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();

  // Chrome shaft (vertical bar) — full height of segment
  const shaftGrad = ctx.createLinearGradient(barLeft, y, barRight, y);
  shaftGrad.addColorStop(0, "#1a1a1a");
  shaftGrad.addColorStop(0.2, "#4a4a4a");
  shaftGrad.addColorStop(0.5, "#8a8a8a");
  shaftGrad.addColorStop(0.8, "#5a5a5a");
  shaftGrad.addColorStop(1, "#2a2a2a");
  ctx.fillStyle = shaftGrad;
  ctx.fillRect(barLeft, y, BAR_WIDTH, h);
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 1;
  ctx.strokeRect(barLeft, y, BAR_WIDTH, h);

  // Plates stacked along bar (side view = one side of bar). Order: 45, 25, 10.
  const plateX = cx + BAR_WIDTH / 2 + 2;
  const plateThick = 5;
  const spacing = 4;

  if (isTop) {
    let runY = y + Math.min(14, h * 0.15);
    if (runY + PLATE_45_R < y + h - 6) drawPlate(ctx, plateX, runY, PLATE_45_R, plateThick);
    runY += PLATE_45_R + spacing;
    if (runY + PLATE_25_R < y + h - 6) drawPlate(ctx, plateX, runY, PLATE_25_R, plateThick);
    runY += PLATE_25_R + spacing;
    if (runY + PLATE_10_R < y + h - 6) drawPlate(ctx, plateX, runY, PLATE_10_R, plateThick);
  } else {
    let runY = y + h - Math.min(14, h * 0.15);
    if (runY - PLATE_45_R > y + 6) drawPlate(ctx, plateX, runY, PLATE_45_R, plateThick);
    runY -= PLATE_45_R + spacing;
    if (runY - PLATE_25_R > y + 6) drawPlate(ctx, plateX, runY, PLATE_25_R, plateThick);
    runY -= PLATE_25_R + spacing;
    if (runY - PLATE_10_R > y + 6) drawPlate(ctx, plateX, runY, PLATE_10_R, plateThick);
  }

  // Small bar section extending past plates (visible end of shaft)
  ctx.fillStyle = shaftGrad;
  if (isTop) {
    ctx.fillRect(barLeft, y, BAR_WIDTH, 10);
  } else {
    ctx.fillRect(barLeft, y + h - 10, BAR_WIDTH, 10);
  }

  ctx.restore();
}
