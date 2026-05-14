import { getAchievement } from "./definitions";
import { buildAchievementSnapshot } from "./snapshot";
import { computeNewAchievementIds } from "./compute";
import { loadUnlockedMap, persistAchievementUnlock } from "./persistence";
import { playAchievementFeedback } from "./feedback";

const EVENT = "armpal-achievement-unlocked";

function dispatchUnlock(detail) {
  try {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(EVENT, { detail }));
  } catch {
    /* ignore */
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
      const snapshot = await buildAchievementSnapshot(userId, hints || {});
      const unlocked = await loadUnlockedMap(userId);
      const candidates = computeNewAchievementIds(snapshot, unlocked);

      for (const id of candidates) {
        const again = await loadUnlockedMap(userId);
        if (again.has(id)) continue;

        const at = new Date().toISOString();
        await persistAchievementUnlock(userId, id, at);
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

export { EVENT as ACHIEVEMENT_UNLOCK_EVENT };
