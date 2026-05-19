import { getAchievement } from "./definitions";
import { buildAchievementSnapshot } from "./snapshot";
import { computeNewAchievementIds } from "./compute";
import {
  loadUnlockedMap,
  persistAchievementUnlock,
  resolveAchievementUserId,
} from "./persistence";
import { playAchievementFeedback } from "./feedback";

const EVENT = "armpal-achievement-unlocked";

let reconcileInFlight = null;

function dispatchUnlock(detail) {
  try {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(EVENT, { detail }));
  } catch {
    /* ignore */
  }
}

/**
 * Backfill unlock rows from current stats without celebration UI (profile load / refresh).
 * @param {string} userId
 * @param {Record<string, unknown>} [hints]
 */
export async function reconcileAchievementUnlocks(userId, hints = {}) {
  const effectiveUserId = await resolveAchievementUserId(userId);
  if (!effectiveUserId) return;

  const snapshot = await buildAchievementSnapshot(effectiveUserId, hints || {});
  const unlocked = await loadUnlockedMap(effectiveUserId);
  const missing = computeNewAchievementIds(snapshot, unlocked);

  for (const id of missing) {
    const again = await loadUnlockedMap(effectiveUserId);
    if (again.has(id)) continue;
    await persistAchievementUnlock(effectiveUserId, id, new Date().toISOString());
  }
}

/**
 * Run achievement evaluation off the critical path.
 * @param {string} userId
 * @param {Record<string, unknown>} [hints] forwarded to snapshot builder
 */
export function safeRunAchievementEvaluation(userId, hints) {
  if (!userId) return;

  queueMicrotask(async () => {
    try {
      const effectiveUserId = await resolveAchievementUserId(userId);
      if (!effectiveUserId) return;

      const snapshot = await buildAchievementSnapshot(effectiveUserId, hints || {});
      const unlocked = await loadUnlockedMap(effectiveUserId);
      const candidates = computeNewAchievementIds(snapshot, unlocked);

      for (const id of candidates) {
        const again = await loadUnlockedMap(effectiveUserId);
        if (again.has(id)) continue;

        const at = new Date().toISOString();
        const isNew = await persistAchievementUnlock(effectiveUserId, id, at);
        if (!isNew) continue;

        const def = getAchievement(id);
        if (def) {
          dispatchUnlock({
            achievement: { ...def, unlocked_at: at },
          });
          try {
            playAchievementFeedback(def);
          } catch {
            /* feedback must never throw */
          }
        }
      }
    } catch (e) {
      console.warn("[achievements] evaluation failed (non-fatal):", e?.message || e);
    }
  });
}

/**
 * Single-flight reconcile for app/profile boot (no duplicate work).
 */
export function scheduleAchievementReconcile(userId, hints) {
  if (!userId) return;
  if (reconcileInFlight) return;

  reconcileInFlight = reconcileAchievementUnlocks(userId, hints || {})
    .catch((e) => {
      console.warn("[achievements] reconcile failed (non-fatal):", e?.message || e);
    })
    .finally(() => {
      reconcileInFlight = null;
    });
}

export { EVENT as ACHIEVEMENT_UNLOCK_EVENT };
