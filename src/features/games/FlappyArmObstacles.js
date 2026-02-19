/**
 * Flappy Arm — vertical barbell obstacles. Structure: top sleeve → 45lb → 25lb → 10lb plates → exposed bar end (no clip).
 * Metal gradient + subtle shadow.
 */

const BARBELL_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="140" height="520" viewBox="0 0 140 520">
  <defs>
    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#E8E8E8"/>
      <stop offset="0.25" stop-color="#B0B0B0"/>
      <stop offset="0.5" stop-color="#808080"/>
      <stop offset="0.75" stop-color="#A8A8A8"/>
      <stop offset="1" stop-color="#D8D8D8"/>
    </linearGradient>
    <linearGradient id="plate45" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4A4A4A"/>
      <stop offset="0.5" stop-color="#2A2A2A"/>
      <stop offset="1" stop-color="#151515"/>
    </linearGradient>
    <linearGradient id="plate25" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#404040"/>
      <stop offset="0.5" stop-color="#222222"/>
      <stop offset="1" stop-color="#0E0E0E"/>
    </linearGradient>
    <linearGradient id="plate10" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#505050"/>
      <stop offset="0.5" stop-color="#282828"/>
      <stop offset="1" stop-color="#1a1a1a"/>
    </linearGradient>
    <filter id="barShadow" x="-10%" y="-5%" width="120%" height="110%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- Bar shaft (full length) -->
  <rect x="64" y="0" width="12" height="520" rx="6" fill="url(#metal)" filter="url(#barShadow)"/>

  <!-- Top sleeve -->
  <rect x="58" y="0" width="24" height="28" rx="8" fill="url(#metal)"/>
  <rect x="60" y="4" width="20" height="20" rx="4" fill="#1a1a1a" opacity="0.5"/>

  <!-- 45lb plate (largest) -->
  <ellipse cx="70" cy="72" rx="58" ry="18" fill="url(#plate45)"/>
  <ellipse cx="70" cy="72" rx="12" ry="4" fill="#0A0A0A"/>

  <!-- 25lb plate -->
  <ellipse cx="70" cy="108" rx="44" ry="14" fill="url(#plate25)"/>
  <ellipse cx="70" cy="108" rx="10" ry="3.5" fill="#0A0A0A"/>

  <!-- 10lb plate -->
  <ellipse cx="70" cy="138" rx="34" ry="11" fill="url(#plate10)"/>
  <ellipse cx="70" cy="138" rx="8" ry="3" fill="#0A0A0A"/>

  <!-- Exposed bar end (no clip) -->
  <rect x="64" y="158" width="12" height="362" rx="6" fill="url(#metal)" opacity="0.95"/>
  <rect x="62" y="508" width="16" height="12" rx="4" fill="url(#metal)"/>
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
 * Structure: top sleeve → 45/25/10 plates → exposed bar end.
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
