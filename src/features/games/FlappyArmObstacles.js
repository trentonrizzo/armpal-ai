/**
 * Flappy Arm — obstacles from exact BARBELL_SVG. Vertical Olympic barbell, side-view, plates 45/25/10.
 * Collision boxes unchanged; only art swapped. Top and bottom segments each draw scaled barbell.
 */

const BARBELL_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="140" height="520" viewBox="0 0 140 520">
  <defs>
    <linearGradient id="steel" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#E6E6E6"/>
      <stop offset="0.5" stop-color="#AFAFAF"/>
      <stop offset="1" stop-color="#F2F2F2"/>
    </linearGradient>
    <linearGradient id="plate45" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3A3A3A"/>
      <stop offset="1" stop-color="#151515"/>
    </linearGradient>
    <linearGradient id="plate25" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2E2E2E"/>
      <stop offset="1" stop-color="#0E0E0E"/>
    </linearGradient>
    <linearGradient id="plate10" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4A4A4A"/>
      <stop offset="1" stop-color="#1B1B1B"/>
    </linearGradient>
  </defs>

  <!-- Bar shaft -->
  <rect x="64" y="0" width="12" height="520" rx="6" fill="url(#steel)"/>

  <!-- Top stub -->
  <rect x="60" y="0" width="20" height="24" rx="6" fill="url(#steel)"/>

  <!-- Plates stack near top: 45,25,10 (side-view) -->
  <ellipse cx="70" cy="74" rx="56" ry="16" fill="url(#plate45)"/>
  <ellipse cx="70" cy="106" rx="44" ry="13" fill="url(#plate25)"/>
  <ellipse cx="70" cy="134" rx="34" ry="11" fill="url(#plate10)"/>

  <!-- Plate center holes -->
  <ellipse cx="70" cy="74" rx="10" ry="4" fill="#0A0A0A"/>
  <ellipse cx="70" cy="106" rx="9" ry="3.5" fill="#0A0A0A"/>
  <ellipse cx="70" cy="134" rx="8" ry="3" fill="#0A0A0A"/>

  <!-- Bottom stub -->
  <rect x="60" y="496" width="20" height="24" rx="6" fill="url(#steel)"/>
</svg>
`;

let barbellImage = null;
let barbellImageReady = false;

function loadBarbellImage(cb) {
  if (barbellImageReady && barbellImage) {
    cb();
    return;
  }
  if (barbellImage) {
    barbellImage.onload = cb;
    return;
  }
  const img = new Image();
  img.onload = () => {
    barbellImage = img;
    barbellImageReady = true;
    cb();
  };
  img.onerror = () => cb();
  img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(BARBELL_SVG.trim())));
}

const BARBELL_SVG_H = 520;
const BARBELL_SVG_W = 140;

/**
 * Draw vertical barbell segment. Fills rect (x, y, w, h). isTop = segment hangs from top.
 * Source: top or bottom portion of SVG so plates 45/25/10 are visible.
 */
export function drawVerticalBarbell(ctx, x, y, w, h, isTop) {
  const draw = () => {
    if (!barbellImage || !barbellImageReady) {
      ctx.fillStyle = "#2a2a2a";
      ctx.fillRect(x, y, w, h);
      return;
    }
    const srcH = Math.min(BARBELL_SVG_H, (h / w) * BARBELL_SVG_W);
    const sy = isTop ? 0 : BARBELL_SVG_H - srcH;
    ctx.drawImage(
      barbellImage,
      0, sy, BARBELL_SVG_W, srcH,
      x, y, w, h
    );
  };
  if (barbellImageReady) {
    draw();
    return;
  }
  loadBarbellImage(() => draw());
}
