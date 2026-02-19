/**
 * Flappy Arm — gym background from BG_BACK_SVG and BG_MID_SVG.
 * Parallax: back 0.20 * obstacle speed, mid 0.45 * obstacle speed. Faint dust particles.
 */

const BG_BACK_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1600" viewBox="0 0 900 1600">
  <rect width="900" height="1600" fill="#0A0A0A"/>
  <g opacity="0.35" fill="#1B1B1B">
    <rect x="80" y="240" width="80" height="980" rx="24"/>
    <rect x="740" y="240" width="80" height="980" rx="24"/>
    <rect x="140" y="300" width="620" height="18" rx="9"/>
    <rect x="140" y="1080" width="620" height="18" rx="9"/>
    <rect x="220" y="320" width="20" height="760" rx="10"/>
    <rect x="660" y="320" width="20" height="760" rx="10"/>
  </g>
</svg>
`;

const BG_MID_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1600" viewBox="0 0 900 1600">
  <rect width="900" height="1600" fill="none"/>
  <g opacity="0.50" fill="#141414">
    <rect x="120" y="1160" width="660" height="26" rx="13"/>
    <rect x="160" y="1200" width="580" height="18" rx="9"/>
    <g>
      <rect x="200" y="1090" width="40" height="12" rx="6"/>
      <rect x="260" y="1090" width="40" height="12" rx="6"/>
      <rect x="320" y="1090" width="40" height="12" rx="6"/>
      <rect x="380" y="1090" width="40" height="12" rx="6"/>
      <rect x="440" y="1090" width="40" height="12" rx="6"/>
      <rect x="500" y="1090" width="40" height="12" rx="6"/>
      <rect x="560" y="1090" width="40" height="12" rx="6"/>
      <rect x="620" y="1090" width="40" height="12" rx="6"/>
    </g>
  </g>
</svg>
`;

let bgBackImage = null;
let bgMidImage = null;
let bgBackReady = false;
let bgMidReady = false;

function loadBgBack(cb) {
  if (bgBackReady && bgBackImage) {
    cb();
    return;
  }
  if (bgBackImage) {
    bgBackImage.onload = cb;
    return;
  }
  const img = new Image();
  img.onload = () => {
    bgBackImage = img;
    bgBackReady = true;
    cb();
  };
  img.onerror = () => cb();
  img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(BG_BACK_SVG.trim())));
}

function loadBgMid(cb) {
  if (bgMidReady && bgMidImage) {
    cb();
    return;
  }
  if (bgMidImage) {
    bgMidImage.onload = cb;
    return;
  }
  const img = new Image();
  img.onload = () => {
    bgMidImage = img;
    bgMidReady = true;
    cb();
  };
  img.onerror = () => cb();
  img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(BG_MID_SVG.trim())));
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w - CANVAS_W
 * @param {number} h - CANVAS_H
 * @param {number} groundY
 * @param {number} totalScroll
 * @param {number} scrollSpeed
 * @param {number} time - seconds
 */
export function drawGymBackground(ctx, w, h, groundY, totalScroll, scrollSpeed, time) {
  const backOffset = (totalScroll * 0.2) % 900;
  const midOffset = (totalScroll * 0.45) % 900;

  ctx.save();

  ctx.fillStyle = "#0A0A0A";
  ctx.fillRect(0, 0, w, groundY);

  loadBgBack(() => {});
  loadBgMid(() => {});

  if (bgBackImage && bgBackReady) {
    const scale = (groundY + 100) / 1600;
    const drawW = 900 * scale;
    const drawH = 1600 * scale;
    ctx.globalAlpha = 0.95;
    ctx.drawImage(bgBackImage, -backOffset * scale, 0, drawW, drawH);
    ctx.drawImage(bgBackImage, -backOffset * scale + drawW, 0, drawW, drawH);
    ctx.globalAlpha = 1;
  }
  if (bgMidImage && bgMidReady) {
    const scale = (groundY + 100) / 1600;
    const drawW = 900 * scale;
    ctx.globalAlpha = 0.85;
    ctx.drawImage(bgMidImage, -midOffset * scale, 0, drawW, 1600 * scale);
    ctx.drawImage(bgMidImage, -midOffset * scale + drawW, 0, drawW, 1600 * scale);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = "#fff";
  for (let i = 0; i < 10; i++) {
    const px = (i * 89 + totalScroll * 0.12) % (w + 40) - 20;
    const py = (groundY - 100 + (i * 37) % 200) + Math.sin(time + i * 0.5) * 3;
    ctx.globalAlpha = 0.06 + Math.sin(time * 0.4 + i) * 0.02;
    ctx.beginPath();
    ctx.arc(px, py, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
