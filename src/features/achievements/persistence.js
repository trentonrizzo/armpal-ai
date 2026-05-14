import localforage from "localforage";
import { supabase } from "../../supabaseClient";

const localAchievementsStore = localforage.createInstance({
  name: "armpal_app",
  storeName: "achievements",
});

function localKey(userId) {
  return `unlocks_${userId}`;
}

/**
 * @returns {Promise<Map<string, string>>} id -> ISO unlocked_at
 */
export async function loadUnlockedMap(userId) {
  const map = new Map();
  if (!userId) return map;

  try {
    const { data, error } = await supabase
      .from("user_achievements")
      .select("achievement_id, unlocked_at")
      .eq("user_id", userId);

    if (!error && Array.isArray(data)) {
      for (const row of data) {
        if (row?.achievement_id) {
          map.set(row.achievement_id, row.unlocked_at || new Date().toISOString());
        }
      }
    }
  } catch {
    /* table may not exist */
  }

  try {
    const raw = await localAchievementsStore.getItem(localKey(userId));
    if (Array.isArray(raw)) {
      for (const row of raw) {
        if (row?.id && !map.has(row.id)) {
          map.set(row.id, row.unlocked_at || new Date().toISOString());
        }
      }
    }
  } catch {
    /* ignore */
  }

  return map;
}

async function saveLocalUnlock(userId, id, unlockedAt) {
  try {
    const key = localKey(userId);
    const raw = (await localAchievementsStore.getItem(key)) || [];
    const list = Array.isArray(raw) ? [...raw] : [];
    if (!list.some((r) => r.id === id)) {
      list.push({ id, unlocked_at: unlockedAt });
      await localAchievementsStore.setItem(key, list);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Persist one unlock. Remote first; always mirror to local for offline consistency.
 * @returns {Promise<boolean>} true if newly persisted (not duplicate)
 */
export async function persistAchievementUnlock(userId, achievementId, unlockedAt) {
  if (!userId || !achievementId) return false;

  const existing = await loadUnlockedMap(userId);
  if (existing.has(achievementId)) return false;

  const at = unlockedAt || new Date().toISOString();
  let remoteOk = false;

  try {
    const { error } = await supabase.from("user_achievements").insert({
      user_id: userId,
      achievement_id: achievementId,
      unlocked_at: at,
    });
    remoteOk = !error;
  } catch {
    remoteOk = false;
  }

  await saveLocalUnlock(userId, achievementId, at);
  return true;
}

/**
 * @returns {Promise<{ id: string, unlocked_at: string }[]>}
 */
export async function listAchievementUnlocks(userId) {
  const map = await loadUnlockedMap(userId);
  return Array.from(map.entries())
    .map(([id, unlocked_at]) => ({ id, unlocked_at }))
    .sort((a, b) => (a.unlocked_at < b.unlocked_at ? 1 : -1));
}
