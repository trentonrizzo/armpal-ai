/**
 * Flappy Arm — player rendered from exact ARM_SVG. Canvas drawImage from loaded Image.
 * Tilt: fall +18deg, tap -10deg. Subtle bobbing while alive. Hitbox unchanged.
 */

const ARM_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="220" height="140" viewBox="0 0 220 140">
  <defs>
    <linearGradient id="skin" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#F2C6A0"/>
      <stop offset="0.5" stop-color="#D9A07A"/>
      <stop offset="1" stop-color="#B77D5E"/>
    </linearGradient>
    <linearGradient id="shadow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0.25"/>
      <stop offset="1" stop-color="#000" stop-opacity="0"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="1.2"/>
    </filter>
  </defs>

  <!-- Forearm -->
  <path d="M35 85 C20 75, 20 55, 38 45 C62 33, 96 40, 118 56
           C135 68, 143 90, 127 102 C107 118, 62 112, 35 85 Z"
        fill="url(#skin)"/>

  <!-- Bicep bulge -->
  <path d="M92 38 C92 18, 116 10, 140 18 C165 26, 176 50, 168 70
           C160 92, 136 96, 121 86 C103 74, 92 56, 92 38 Z"
        fill="url(#skin)"/>

  <!-- Inner crease/shadows -->
  <path d="M55 78 C46 69, 50 58, 63 54 C82 48, 104 57, 114 70
           C122 80, 118 92, 104 96 C86 101, 67 92, 55 78 Z"
        fill="url(#shadow)" filter="url(#soft)"/>

  <!-- Fist -->
  <path d="M150 74 C150 62, 160 54, 172 54 C186 54, 196 64, 196 76
           C196 88, 187 98, 174 98 C161 98, 150 88, 150 74 Z"
        fill="url(#skin)"/>
  <path d="M160 70 C165 66, 171 66, 178 70" stroke="#7A4E3A" stroke-opacity="0.35" stroke-width="4" stroke-linecap="round"/>

  <!-- Outline for clarity -->
  <path d="M35 85 C20 75, 20 55, 38 45 C62 33, 96 40, 118 56
           C135 68, 143 90, 127 102 C107 118, 62 112, 35 85 Z"
        fill="none" stroke="#2A1B14" stroke-opacity="0.35" stroke-width="3"/>
  <path d="M92 38 C92 18, 116 10, 140 18 C165 26, 176 50, 168 70
           C160 92, 136 96, 121 86 C103 74, 92 56, 92 38 Z"
        fill="none" stroke="#2A1B14" stroke-opacity="0.35" stroke-width="3"/>
</svg>
`;

const ARM_SIZE = 36;
let armImage = null;
let armImageReady = false;

function loadArmImage(cb) {
  if (armImageReady && armImage) {
    cb();
    return;
  }
  if (armImage) {
    armImage.onload = cb;
    return;
  }
  const img = new Image();
  img.onload = () => {
    armImage = img;
    armImageReady = true;
    cb();
  };
  img.onerror = () => cb();
  img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(ARM_SVG.trim())));
}

/**
 * Draw the arm at (x, y) with rotation in degrees. Optional hoverY for bobbing.
 */
export function drawFlappyArmCharacter(ctx, x, y, rotation, opts = {}) {
  const hoverY = opts.hoverY ?? 0;
  const drawY = y + hoverY;

  const scale = ARM_SIZE / 140;
  const w = 220 * scale;
  const h = ARM_SIZE;

  const draw = () => {
    if (!armImage || !armImageReady) return;
    ctx.save();
    ctx.translate(x, drawY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(armImage, -w / 2, -h / 2, w, h);
    ctx.restore();
  };

  if (armImageReady) {
    draw();
    return;
  }
  loadArmImage(draw);
}

/**
 * Visual rotation: tap -10°, fall +18° (spec).
 */
export function getVisualRotation(vy, physicsRotation) {
  if (vy < 0) return -10;
  return Math.min(18, physicsRotation);
}

export { ARM_SIZE };
