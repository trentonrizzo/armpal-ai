// Client-side cumulative workout-share count (no DB migration).
// Used for "first share" and Social Lifter.

function key(userId) {
  return `armpal_stat_workout_shares_${userId}`;
}

export function bumpWorkoutShareCount(userId, delta) {
  if (!userId || !delta || delta < 1) return null;
  try {
    const k = key(userId);
    const prev = Math.max(0, parseInt(localStorage.getItem(k) || "0", 10) || 0);
    const next = prev + delta;
    localStorage.setItem(k, String(next));
    return next;
  } catch {
    return null;
  }
}

export function getWorkoutShareCount(userId) {
  if (!userId) return 0;
  try {
    return Math.max(0, parseInt(localStorage.getItem(key(userId)) || "0", 10) || 0);
  } catch {
    return 0;
  }
}
