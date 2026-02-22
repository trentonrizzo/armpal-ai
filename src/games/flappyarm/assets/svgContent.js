/**
 * FlappyArm — crisp SVG assets (light from top-left, readable silhouettes).
 * Used as data URLs until real WebP assets exist.
 */

// Muscular arm: bicep peak, tricep, wrist wrap, hand. Top-left light.
export const ARM_IDLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="140" viewBox="0 0 220 140">
<defs>
  <linearGradient id="skin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8c4a8"/><stop offset="0.5" stop-color="#d4a574"/><stop offset="1" stop-color="#b8855a"/></linearGradient>
  <linearGradient id="shadow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.2"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
  <linearGradient id="highlight" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0.25"/><stop offset="0.4" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs>
<path d="M35 85 C20 75 20 55 38 45 C62 33 96 40 118 56 C135 68 143 90 127 102 C107 118 62 112 35 85 Z" fill="url(#skin)"/>
<path d="M92 38 C92 18 116 10 140 18 C165 26 176 50 168 70 C160 92 136 96 121 86 C103 74 92 56 92 38 Z" fill="url(#skin)"/>
<path d="M55 78 C46 69 50 58 63 54 C82 48 104 57 114 70 C122 80 118 92 104 96 Z" fill="url(#shadow)"/>
<path d="M100 42 L128 52 L122 72 L94 62 Z" fill="url(#highlight)"/>
<path d="M150 74 C150 62 160 54 172 54 C186 54 196 64 196 76 C196 88 187 98 174 98 C161 98 150 88 150 74 Z" fill="url(#skin)"/>
<rect x="138" y="68" width="24" height="8" rx="2" fill="#2d1f14"/>
<rect x="140" y="70" width="8" height="4" rx="1" fill="#4a3528"/>
<path d="M35 85 C20 75 20 55 38 45 M92 38 C92 18 116 10 140 18 M150 74 L172 54 M174 98 L196 76" fill="none" stroke="#2d1f14" stroke-width="2" stroke-opacity="0.9"/>
</svg>`;

export const ARM_FLAP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="140" viewBox="0 0 220 140">
<defs>
  <linearGradient id="skin2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8c4a8"/><stop offset="0.5" stop-color="#d4a574"/><stop offset="1" stop-color="#b8855a"/></linearGradient>
  <linearGradient id="shadow2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.2"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
  <linearGradient id="hl2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0.3"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs>
<path d="M38 82 C22 72 24 50 42 42 C66 30 98 38 118 54 C132 66 138 88 124 98 C106 112 62 108 38 82 Z" fill="url(#skin2)"/>
<path d="M94 35 C92 16 118 8 142 16 C166 24 176 48 168 68 C160 88 136 94 122 84 C104 72 94 52 94 35 Z" fill="url(#skin2)"/>
<path d="M58 76 C48 68 52 56 64 52 C82 46 102 54 112 68 Z" fill="url(#shadow2)"/>
<path d="M102 40 L128 48 L122 68 L96 60 Z" fill="url(#hl2)"/>
<path d="M152 72 C150 60 162 52 174 52 C188 52 198 62 198 74 C198 86 188 96 174 96 C160 96 152 84 152 72 Z" fill="url(#skin2)"/>
<rect x="140" y="66" width="24" height="8" rx="2" fill="#2d1f14"/>
<path d="M38 82 C22 72 24 50 42 42 M94 35 C92 16 118 8 142 16 M152 72 L174 52" fill="none" stroke="#2d1f14" stroke-width="2" stroke-opacity="0.9"/>
</svg>`;

export const ARM_SHADOW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40">
<ellipse cx="60" cy="20" rx="52" ry="14" fill="#000" opacity="0.5"/>
</svg>`;

// Gym layers: far = silhouettes, mid = detail, near = streaks
export const GYM_BG_FAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="520" viewBox="0 0 400 520">
<defs><linearGradient id="far" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1c22"/><stop offset="1" stop-color="#0f1115"/></linearGradient></defs>
<rect width="400" height="520" fill="url(#far)"/>
<rect x="20" y="80" width="35" height="120" fill="#15181e" opacity="0.9"/>
<rect x="70" y="60" width="25" height="140" fill="#15181e" opacity="0.85"/>
<rect x="280" y="70" width="40" height="130" fill="#15181e" opacity="0.9"/>
<rect x="330" y="90" width="30" height="110" fill="#15181e" opacity="0.85"/>
<ellipse cx="200" cy="100" rx="80" ry="20" fill="#1c1f26" opacity="0.6"/>
</svg>`;

export const GYM_BG_MID_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="520" viewBox="0 0 400 520">
<defs><linearGradient id="mid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c1e24"/><stop offset="1" stop-color="#121419"/></linearGradient></defs>
<rect width="400" height="520" fill="url(#mid)"/>
<rect x="50" y="200" width="30" height="80" rx="4" fill="#2a2d34"/>
<rect x="90" y="180" width="25" height="100" rx="4" fill="#252830"/>
<rect x="300" y="190" width="28" height="90" rx="4" fill="#2a2d34"/>
<rect x="250" y="210" width="22" height="70" rx="4" fill="#252830"/>
</svg>`;

export const GYM_BG_NEAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="520" viewBox="0 0 400 520">
<rect width="400" height="520" fill="transparent"/>
<line x1="0" y1="150" x2="80" y2="520" stroke="#2a2d34" stroke-width="1" opacity="0.2"/>
<line x1="360" y1="200" x2="400" y2="520" stroke="#2a2d34" stroke-width="1" opacity="0.2"/>
</svg>`;

// Barbell: brighter metallic gradient, outer glow edge for readability
export const BARBELL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="520" viewBox="0 0 140 520">
<defs>
  <linearGradient id="metal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a7d85"/><stop offset="0.25" stop-color="#6b6e76"/><stop offset="0.5" stop-color="#5c5f66"/><stop offset="0.75" stop-color="#6b6e76"/><stop offset="1" stop-color="#7a7d85"/></linearGradient>
  <linearGradient id="plate" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a5a5a"/><stop offset="1" stop-color="#2a2a2a"/></linearGradient>
  <linearGradient id="spec" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="0.4" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <linearGradient id="edge" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0.15"/><stop offset="0.15" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs>
<rect x="56" y="-1" width="28" height="30" rx="6" fill="url(#metal)" stroke="#8b8f98" stroke-width="1" opacity="0.9"/>
<rect x="64" y="0" width="12" height="520" rx="6" fill="url(#metal)"/>
<rect x="56" y="0" width="3" height="520" fill="url(#edge)"/>
<ellipse cx="70" cy="72" rx="58" ry="18" fill="url(#plate)" stroke="#6b6e76" stroke-width="0.8"/>
<ellipse cx="70" cy="72" rx="12" ry="4" fill="#0a0a0a"/>
<ellipse cx="70" cy="108" rx="44" ry="14" fill="url(#plate)" stroke="#6b6e76" stroke-width="0.8"/>
<ellipse cx="70" cy="108" rx="10" ry="3.5" fill="#0a0a0a"/>
<ellipse cx="70" cy="138" rx="34" ry="11" fill="url(#plate)" stroke="#6b6e76" stroke-width="0.8"/>
<ellipse cx="70" cy="138" rx="8" ry="3" fill="#0a0a0a"/>
<rect x="62" y="508" width="16" height="12" rx="4" fill="url(#metal)"/>
<rect x="64" y="0" width="4" height="80" fill="url(#spec)"/>
</svg>`;

export const BARBELL_GLOW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="540" viewBox="0 0 160 540">
<defs><filter id="glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
<rect x="52" y="-10" width="56" height="540" rx="8" fill="#fff" opacity="0.08" filter="url(#glow)"/>
<rect x="54" y="-10" width="52" height="540" rx="8" fill="#8b8f98" opacity="0.15" filter="url(#glow)"/>
</svg>`;

export const SPARK_PARTICLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8">
<circle cx="4" cy="4" r="3" fill="#fff"/>
<circle cx="4" cy="4" r="1.5" fill="#ffe066"/>
</svg>`;

export const VIGNETTE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="520" viewBox="0 0 360 520">
<defs>
  <radialGradient id="vig" cx="0.5" cy="0.5" r="0.8"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.4"/></radialGradient>
</defs>
<rect width="360" height="520" fill="url(#vig)"/>
</svg>`;
