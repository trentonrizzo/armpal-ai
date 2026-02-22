/**
 * FlappyArm — gravity, flap impulse, collision, obstacles. No rendering.
 */

import {
  GRAVITY,
  JUMP_FORCE,
  VELOCITY_CLAMP,
  FLAP_BOUNCE_DELAY_MS,
  FLAP_BOUNCE_EXTRA,
  PIPE_SPEED,
  PIPE_SPACING,
  PIPE_GAP,
  GRACE_MS,
  PLAYER,
  OBSTACLE_WIDTH,
  CANVAS_W,
  CANVAS_H,
  GROUND_Y,
} from "./constants";

/**
 * Create initial game state.
 */
export function createState() {
  const centerY = (GROUND_Y - PLAYER.size) / 2;
  return {
    y: centerY,
    vy: 0,
    rotation: 0,
    graceUntil: 0,
    started: false,
    obstacles: [],
    lastSpawnX: CANVAS_W + OBSTACLE_WIDTH,
    totalScroll: 0,
    prevY: centerY,
    prevRot: 0,
  };
}

/**
 * Spawn one obstacle at x. Returns { x, top: { y, h }, bottom: { y, h }, passed }.
 */
export function spawnObstacle(x) {
  const gapCenter = 120 + Math.random() * (GROUND_Y - 240);
  return {
    x,
    top: { y: 0, h: gapCenter - PIPE_GAP / 2 },
    bottom: { y: gapCenter + PIPE_GAP / 2, h: CANVAS_H - (gapCenter + PIPE_GAP / 2) },
    passed: false,
  };
}

/**
 * Apply one frame of physics. Mutates state. Returns { scored, hitObstacle, hitGround }.
 */
export function stepPhysics(state, now, flapPressed) {
  const inGrace = now < state.graceUntil;
  let scored = false;
  let hitObstacle = false;
  let hitGround = false;

  if (state.started && !inGrace) {
    if (state.bounceAt != null && now >= state.bounceAt) {
      state.vy += FLAP_BOUNCE_EXTRA;
      state.bounceAt = null;
    }
    state.vy += GRAVITY;
    state.vy = Math.max(VELOCITY_CLAMP[0], Math.min(VELOCITY_CLAMP[1], state.vy));
    state.y += state.vy;
    state.rotation =
      state.vy < 0 ? PLAYER.rotationOnJump : Math.min(PLAYER.rotationFallMax, state.rotation + 4);
  }

  state.y = Math.max(20, Math.min(GROUND_Y - PLAYER.size - 4, state.y));

  if (state.started) {
    state.totalScroll = (state.totalScroll || 0) + PIPE_SPEED;
    const playerCenterX = CANVAS_W / 2;
    const playerHalf = PLAYER.size / 2;
    const px = playerCenterX;
    const py = state.y + playerHalf;

    state.obstacles.forEach((ob) => {
      ob.x -= PIPE_SPEED;
      if (!ob.passed && ob.x + OBSTACLE_WIDTH < px - playerHalf) {
        ob.passed = true;
        scored = true;
      }
    });

    state.obstacles = state.obstacles.filter((o) => o.x > -OBSTACLE_WIDTH);
    if (
      state.lastSpawnX - (state.obstacles[state.obstacles.length - 1]?.x ?? 0) > PIPE_SPACING
    ) {
      state.obstacles.push(spawnObstacle(CANVAS_W + OBSTACLE_WIDTH));
      state.lastSpawnX = CANVAS_W + OBSTACLE_WIDTH;
    }

    hitObstacle = state.obstacles.some(
      (ob) =>
        ob.x < px + playerHalf + PLAYER.hitboxPadX &&
        ob.x + OBSTACLE_WIDTH > px - playerHalf - PLAYER.hitboxPadX &&
        (py < ob.top.h - PLAYER.hitboxPadY || py > ob.bottom.y + PLAYER.hitboxPadY)
    );
  }

  hitGround = state.y + PLAYER.size >= GROUND_Y - 4;

  return { scored, hitObstacle, hitGround };
}

/**
 * Apply flap input. Call when user taps.
 */
export function applyFlap(state) {
  state.started = true;
  state.vy = JUMP_FORCE;
  state.rotation = PLAYER.rotationOnJump;
  state.bounceAt = Date.now() + FLAP_BOUNCE_DELAY_MS;
}

/**
 * Start game (reset state).
 */
export function startGame(state) {
  const centerY = (GROUND_Y - PLAYER.size) / 2;
  state.y = centerY;
  state.vy = 0;
  state.rotation = 0;
  state.graceUntil = Date.now() + GRACE_MS;
  state.started = false;
  state.obstacles = [];
  state.lastSpawnX = CANVAS_W + OBSTACLE_WIDTH;
  state.totalScroll = 0;
  state.prevY = centerY;
  state.prevRot = 0;
  state.bounceAt = null;
}

/**
 * Visual rotation from physics (for renderer): flap tilt vs fall tilt.
 */
export function getVisualRotation(vy, rotation) {
  if (vy < 0) return PLAYER.rotationOnJump;
  return Math.min(PLAYER.rotationFallMax, rotation);
}

export { PLAYER, OBSTACLE_WIDTH, PIPE_SPEED, GROUND_Y, CANVAS_W, CANVAS_H };
