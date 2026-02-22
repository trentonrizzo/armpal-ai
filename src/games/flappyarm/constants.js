/**
 * FlappyArm — sizes, speeds, palette. Jetpack Joyride–level clarity.
 */

export const CANVAS_W = 360;
export const CANVAS_H = 520;
export const GROUND_Y = 440;

// Physics (used by physics.js)
export const GRAVITY = 0.25;
export const JUMP_FORCE = -6;
export const VELOCITY_CLAMP = [-6, 6];
export const FLAP_BOUNCE_DELAY_MS = 80;
export const FLAP_BOUNCE_EXTRA = -1.8;

export const BASE_SCROLL_SPEED = 1.6;
export const SCROLL_SPEED_MULTIPLIER = 1.12;
export const PIPE_SPEED = BASE_SCROLL_SPEED * SCROLL_SPEED_MULTIPLIER;
export const PIPE_SPACING = 260;
export const PIPE_GAP = 220;
export const GRACE_MS = 800;

export const PLAYER = {
  size: 36,
  rotationOnJump: -15,
  rotationFallMax: 60,
  hitboxPadX: 8,
  hitboxPadY: 12,
};

export const OBSTACLE_WIDTH = 56;

// Parallax (0.25, 0.55, 0.85)
export const PARALLAX_FAR = 0.25;
export const PARALLAX_MID = 0.55;
export const PARALLAX_NEAR = 0.85;

// Palette — dark gym, top-left light, ArmPal accent
export const PALETTE = {
  bgTop: "#1a1c22",
  bgBottom: "#0f1115",
  ground: "#15171c",
  accent: "#e63946",
  accentDim: "#c22d3a",
  text: "#f1f1f1",
  textDim: "#9ca3af",
  barbellMetal: "#4a4d52",
  barbellHighlight: "#6b7280",
  armShadow: "rgba(0,0,0,0.4)",
  vignette: "rgba(0,0,0,0.35)",
};

// Juice
export const SHAKE_ON_HIT_PX = 6;
export const FREEZE_FRAME_MS = 80;
export const FLAP_CAMERA_BOUNCE_PX = 2;
export const SCORE_POP_SCALE = 1.2;
export const SCORE_POP_MS = 150;
