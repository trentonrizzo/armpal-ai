import localforage from "localforage";
import { supabase } from "../../supabaseClient";

const localAchievementsStore = localforage.createInstance({
  name: "armpal_app",
  storeName: "achievements",
});

function localKey(userId) {
  return `unlocks_${userId}`;
}

function isDuplicateKeyError(error) {
  const code = error?.code || error?.status;
  return code === "23505" || code === 409 || /duplicate/i.test(error?.message || "");
}

/**
 * Use the authenticated session user id so RLS and local keys stay aligned.
 * @returns {Promise<string | null>}
 */
export async function resolveAchievementUserId(requestedUserId) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const sessionId = session?.user?.id;
    if (sessionId) return sessionId;
  } catch {
    /* ignore */
  }
  return requestedUserId || null;
}

function mergeUnlock(map, id, unlockedAt) {
  if (!id) return;
  const at = unlockedAt || new Date().toISOString();
  const prev = map.get(id);
  if (!prev || at < prev) map.set(id, at);
}

/**
 * Accept array rows ({ id } or { achievement_id }) or legacy object map.
 */
function applyLocalPayloadToMap(map, raw) {
  if (!raw) return;

  if (Array.isArray(raw)) {
    for (const row of raw) {
      const id = row?.id || row?.achievement_id;
      if (id) mergeUnlock(map, id, row.unlocked_at);
    }
    return;
  }

  if (typeof raw === "object") {
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === "string") mergeUnlock(map, key, value);
      else if (value && typeof value === "object") {
        const id = value.id || value.achievement_id || key;
        mergeUnlock(map, id, value.unlocked_at || value.unlockedAt);
      }
    }
  }
}

async function fetchRemoteUnlockedMap(userId) {
  const map = new Map();
  if (!userId) return map;

  const effectiveUserId = await resolveAchievementUserId(userId);
  if (!effectiveUserId) return map;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return map;
    }

    const { data, error } = await supabase
      .from("user_achievements")
      .select("achievement_id, unlocked_at")
      .eq("user_id", effectiveUserId);

    if (error) {
      console.warn("[achievements] remote load failed:", error.message);
      return map;
    }

    if (Array.isArray(data)) {
      for (const row of data) {
        if (row?.achievement_id) {
          mergeUnlock(map, row.achievement_id, row.unlocked_at);
        }
      }
    }
  } catch (e) {
    console.warn("[achievements] remote load error:", e?.message || e);
  }

  return map;
}

async function fetchLocalUnlockedMap(userId) {
  const map = new Map();
  const effectiveUserId = await resolveAchievementUserId(userId);
  if (!effectiveUserId) return map;

  try {
    const raw = await localAchievementsStore.getItem(localKey(effectiveUserId));
    applyLocalPayloadToMap(map, raw);
  } catch {
    /* ignore */
  }

  return map;
}

/**
 * @returns {Promise<Map<string, string>>} id -> ISO unlocked_at
 */
export async function loadUnlockedMap(userId) {
  const map = new Map();
  if (!userId) return map;

  const remote = await fetchRemoteUnlockedMap(userId);
  const local = await fetchLocalUnlockedMap(userId);

  for (const [id, at] of remote) mergeUnlock(map, id, at);
  for (const [id, at] of local) mergeUnlock(map, id, at);

  return map;
}

async function saveLocalUnlock(userId, id, unlockedAt) {
  const effectiveUserId = await resolveAchievementUserId(userId);
  if (!effectiveUserId || !id) return;

  try {
    const key = localKey(effectiveUserId);
    const raw = (await localAchievementsStore.getItem(key)) || [];
    const list = Array.isArray(raw) ? [...raw] : [];
    const idx = list.findIndex((r) => (r?.id || r?.achievement_id) === id);
    if (idx >= 0) {
      const prev = list[idx]?.unlocked_at;
      if (!prev || unlockedAt < prev) {
        list[idx] = { id, unlocked_at: unlockedAt };
      }
    } else {
      list.push({ id, unlocked_at: unlockedAt });
    }
    await localAchievementsStore.setItem(key, list);
  } catch {
    /* ignore */
  }
}

/**
 * Persist one unlock. Remote first; always mirror to local for offline consistency.
 * @returns {Promise<boolean>} true if newly persisted (not duplicate)
 */
export async function persistAchievementUnlock(userId, achievementId, unlockedAt) {
  if (!achievementId) return false;

  const effectiveUserId = await resolveAchievementUserId(userId);
  if (!effectiveUserId) return false;

  const existing = await loadUnlockedMap(effectiveUserId);
  if (existing.has(achievementId)) return false;

  const at = unlockedAt || new Date().toISOString();

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      const { error } = await supabase.from("user_achievements").insert({
        user_id: effectiveUserId,
        achievement_id: achievementId,
        unlocked_at: at,
      });

      if (error && !isDuplicateKeyError(error)) {
        console.warn("[achievements] remote insert failed:", error.message);
      }
    }
  } catch (e) {
    console.warn("[achievements] remote insert error:", e?.message || e);
  }

  await saveLocalUnlock(effectiveUserId, achievementId, at);
  return true;
}

/**
 * @returns {Promise<{ id: string, unlocked_at: string }[]>}
 */
export async function listAchievementUnlocks(userId) {
  const effectiveUserId = await resolveAchievementUserId(userId);
  if (!effectiveUserId) return [];

  const map = await loadUnlockedMap(effectiveUserId);
  return Array.from(map.entries())
    .map(([id, unlocked_at]) => ({ id, unlocked_at }))
    .sort((a, b) => (a.unlocked_at < b.unlocked_at ? 1 : -1));
}
