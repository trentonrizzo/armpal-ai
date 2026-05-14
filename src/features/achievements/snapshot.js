import { supabase } from "../../supabaseClient";
import { computePowerliftingFromGroups } from "../../utils/powerliftingTotal";
import { listProgressPhotos } from "../../services/progressPhotosLocal";
import { getWorkoutShareCount } from "./shareStats";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const STREAK_LOOKBACK_DAYS = 60;

function toLocalDayKey(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function todayKey() {
  return toLocalDayKey(new Date());
}

function yesterdayKey() {
  return toLocalDayKey(new Date(Date.now() - ONE_DAY_MS));
}

function computeStreakFromDaySet(daySet) {
  if (!(daySet instanceof Set) || daySet.size === 0) return 0;

  let cursor;
  if (daySet.has(todayKey())) {
    cursor = new Date();
  } else if (daySet.has(yesterdayKey())) {
    cursor = new Date(Date.now() - ONE_DAY_MS);
  } else {
    return 0;
  }

  let streak = 0;
  while (true) {
    const key = toLocalDayKey(cursor);
    if (!key || !daySet.has(key)) break;
    streak += 1;
    cursor = new Date(cursor.getTime() - ONE_DAY_MS);
    if (streak > STREAK_LOOKBACK_DAYS) break;
  }
  return streak;
}

async function fetchBodyweightStreak(userId) {
  const sinceIso = new Date(
    Date.now() - STREAK_LOOKBACK_DAYS * ONE_DAY_MS
  ).toISOString();
  const { data: bwRows } = await supabase
    .from("bodyweight_logs")
    .select("logged_at")
    .eq("user_id", userId)
    .gte("logged_at", sinceIso)
    .order("logged_at", { ascending: false });

  const daySet = new Set();
  for (const row of bwRows || []) {
    const key = toLocalDayKey(row?.logged_at);
    if (key) daySet.add(key);
  }
  return computeStreakFromDaySet(daySet);
}

/**
 * Build evaluation snapshot for achievement checks.
 * @param {string} userId
 * @param {{ prGroups?: any[], workoutCount?: number, friendCount?: number, bodyweightCount?: number, progressPhotoCount?: number, streakDays?: number } | undefined} hints
 */
export async function buildAchievementSnapshot(userId, hints = {}) {
  const snapshot = {
    userId,
    prGroups: hints.prGroups ?? null,
    totalPrRows: hints.totalPrRows ?? null,
    workoutCount: hints.workoutCount ?? null,
    friendCount: hints.friendCount ?? null,
    bodyweightCount: hints.bodyweightCount ?? null,
    progressPhotoCount: hints.progressPhotoCount ?? null,
    streakDays: hints.streakDays ?? null,
    workoutShares: getWorkoutShareCount(userId),
    powerlifting: null,
  };

  try {
    if (snapshot.prGroups == null) {
      const { data, error } = await supabase
        .from("prs")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false });
      if (!error && data) {
        snapshot.totalPrRows = data.length;
        const map = {};
        for (const pr of data) {
          if (!map[pr.lift_name]) map[pr.lift_name] = [];
          map[pr.lift_name].push(pr);
        }
        snapshot.prGroups = Object.keys(map).map((lift) => ({
          lift_name: lift,
          entries: map[lift].sort((a, b) => new Date(b.date) - new Date(a.date)),
        }));
      }
    } else if (snapshot.totalPrRows == null) {
      let n = 0;
      for (const g of snapshot.prGroups) {
        n += g.entries?.length || 0;
      }
      snapshot.totalPrRows = n;
    }

    if (snapshot.prGroups?.length) {
      snapshot.powerlifting = computePowerliftingFromGroups(snapshot.prGroups);
    } else {
      snapshot.powerlifting = computePowerliftingFromGroups([]);
    }

    if (snapshot.bodyweightCount == null) {
      const { count, error } = await supabase
        .from("bodyweight_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      if (!error && count != null) snapshot.bodyweightCount = count;
      else snapshot.bodyweightCount = 0;
    }

    if (snapshot.progressPhotoCount == null) {
      try {
        const photos = await listProgressPhotos();
        snapshot.progressPhotoCount = (photos || []).length;
      } catch {
        snapshot.progressPhotoCount = 0;
      }
    }

    if (snapshot.workoutCount == null) {
      const { count, error } = await supabase
        .from("workouts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      if (!error && count != null) snapshot.workoutCount = count;
      else snapshot.workoutCount = 0;
    }

    if (snapshot.friendCount == null) {
      const { data: frRows } = await supabase
        .from("friends")
        .select("id")
        .eq("status", "accepted")
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
      snapshot.friendCount = (frRows || []).length;
    }

    if (snapshot.streakDays == null) {
      snapshot.streakDays = await fetchBodyweightStreak(userId);
    }
  } catch {
    /* snapshot fields best-effort */
  }

  return snapshot;
}
