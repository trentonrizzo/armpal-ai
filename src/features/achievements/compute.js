import { ACHIEVEMENT_IDS, ACHIEVEMENTS } from "./definitions";

/** @param {Record<string, any>} snapshot @param {Set<string>} unlocked */
export function computeNewAchievementIds(snapshot, unlocked) {
  const pl = snapshot.powerlifting || {};
  const bench = pl.bench?.wLbs ?? null;
  const squat = pl.squat?.wLbs ?? null;
  const deadlift = pl.deadlift?.wLbs ?? null;
  const totalLbs = pl.totalLbs ?? null;
  const totalPrRows = snapshot.totalPrRows ?? 0;
  const bw = snapshot.bodyweightCount ?? 0;
  const photos = snapshot.progressPhotoCount ?? 0;
  const workouts = snapshot.workoutCount ?? 0;
  const friends = snapshot.friendCount ?? 0;
  const streak = snapshot.streakDays ?? 0;
  const shares = snapshot.workoutShares ?? 0;

  /** @type {string[]} */
  const next = [];

  const want = (id) => {
    if (unlocked.has(id)) return;
    if (!ACHIEVEMENTS[id]) return;
    next.push(id);
  };

  if (totalPrRows >= 1) want("first_pr_saved");

  if (bench != null && bench >= 135) want("bench_135");
  if (bench != null && bench >= 225) want("bench_225");
  if (bench != null && bench >= 315) want("bench_315");

  if (squat != null && squat >= 225) want("squat_225");
  if (squat != null && squat >= 315) want("squat_315");
  if (squat != null && squat >= 405) want("squat_405");

  if (deadlift != null && deadlift >= 315) want("deadlift_315");
  if (deadlift != null && deadlift >= 405) want("deadlift_405");
  if (deadlift != null && deadlift >= 500) want("deadlift_500");

  if (totalLbs != null && totalLbs >= 1000) want("club_1000");
  if (totalLbs != null && totalLbs >= 1500) want("club_1500");

  if (bw >= 1) want("first_bodyweight");
  if (photos >= 1) want("first_progress_photo");
  if (photos >= 10) want("progress_photos_10");

  if (workouts >= 1) want("first_workout_created");
  if (workouts >= 10) want("workouts_created_10");

  if (friends >= 1) want("first_friend");
  if (shares >= 1) want("first_workout_shared");
  if (shares >= 5) want("social_lifter");

  if (streak >= 3) want("streak_3");
  if (streak >= 7) want("streak_7");
  if (streak >= 30) want("streak_30");

  // Deterministic order for UI
  const order = new Map(ACHIEVEMENT_IDS.map((id, i) => [id, i]));
  next.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));

  return next;
}
