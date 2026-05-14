// ArmPal achievement definitions (ids stable for storage + UI).

export const RARITY = {
  common: { label: "Common", order: 0 },
  rare: { label: "Rare", order: 1 },
  epic: { label: "Epic", order: 2 },
  legendary: { label: "Legendary", order: 3 },
};

/** @typedef {{ id: string, title: string, description: string, category: string, rarity: keyof typeof RARITY }} AchievementDef */

/** @type {Record<string, AchievementDef>} */
export const ACHIEVEMENTS = {
  first_pr_saved: {
    id: "first_pr_saved",
    title: "First PR Saved",
    description: "You logged your first personal record in ArmPal.",
    category: "Strength",
    rarity: "common",
  },
  bench_135: {
    id: "bench_135",
    title: "Bench 135",
    description: "Your best competition bench is at least 135 lb.",
    category: "Strength",
    rarity: "common",
  },
  bench_225: {
    id: "bench_225",
    title: "Bench 225",
    description: "Two plates on bench — your best hit 225 lb or more.",
    category: "Strength",
    rarity: "rare",
  },
  bench_315: {
    id: "bench_315",
    title: "Bench 315",
    description: "Three plates — 315+ lb competition bench.",
    category: "Strength",
    rarity: "epic",
  },
  squat_225: {
    id: "squat_225",
    title: "Squat 225",
    description: "Your best competition squat reached 225 lb or more.",
    category: "Strength",
    rarity: "common",
  },
  squat_315: {
    id: "squat_315",
    title: "Squat 315",
    description: "Heavy squat — 315+ lb on the bar.",
    category: "Strength",
    rarity: "rare",
  },
  squat_405: {
    id: "squat_405",
    title: "Squat 405",
    description: "Four plates — 405+ lb competition squat.",
    category: "Strength",
    rarity: "epic",
  },
  deadlift_315: {
    id: "deadlift_315",
    title: "Deadlift 315",
    description: "Your best competition deadlift is 315 lb or more.",
    category: "Strength",
    rarity: "common",
  },
  deadlift_405: {
    id: "deadlift_405",
    title: "Deadlift 405",
    description: "Four plates off the floor — 405+ lb.",
    category: "Strength",
    rarity: "rare",
  },
  deadlift_500: {
    id: "deadlift_500",
    title: "Deadlift 500",
    description: "Half a ton mindset — 500+ lb deadlift.",
    category: "Strength",
    rarity: "legendary",
  },
  club_1000: {
    id: "club_1000",
    title: "1000 LB Club",
    description: "Your SBD total from best PRs crossed 1,000 lb.",
    category: "Strength",
    rarity: "epic",
  },
  club_1500: {
    id: "club_1500",
    title: "1500 LB Club",
    description: "Elite territory — SBD total over 1,500 lb.",
    category: "Strength",
    rarity: "legendary",
  },
  first_bodyweight: {
    id: "first_bodyweight",
    title: "First Bodyweight Log",
    description: "You started tracking scale weight.",
    category: "Tracking",
    rarity: "common",
  },
  first_progress_photo: {
    id: "first_progress_photo",
    title: "First Progress Photo",
    description: "You saved a photo to your progress vault.",
    category: "Tracking",
    rarity: "common",
  },
  progress_photos_10: {
    id: "progress_photos_10",
    title: "Photo Journal",
    description: "Ten progress photos logged on this device.",
    category: "Tracking",
    rarity: "rare",
  },
  first_workout_created: {
    id: "first_workout_created",
    title: "First Workout Created",
    description: "You built your first workout template.",
    category: "Tracking",
    rarity: "common",
  },
  workouts_created_10: {
    id: "workouts_created_10",
    title: "Program Builder",
    description: "Ten workouts created — you’re serious about structure.",
    category: "Tracking",
    rarity: "rare",
  },
  first_friend: {
    id: "first_friend",
    title: "First Friend Added",
    description: "You accepted a friend on ArmPal.",
    category: "Social",
    rarity: "common",
  },
  first_workout_shared: {
    id: "first_workout_shared",
    title: "First Workout Shared",
    description: "You shared a workout with a friend.",
    category: "Social",
    rarity: "common",
  },
  social_lifter: {
    id: "social_lifter",
    title: "Social Lifter",
    description: "Five workout shares — you’re lifting with your crew.",
    category: "Social",
    rarity: "rare",
  },
  streak_3: {
    id: "streak_3",
    title: "3 Day Streak",
    description: "Three consecutive days with a bodyweight log.",
    category: "Consistency",
    rarity: "common",
  },
  streak_7: {
    id: "streak_7",
    title: "7 Day Streak",
    description: "A full week of weigh-ins.",
    category: "Consistency",
    rarity: "rare",
  },
  streak_30: {
    id: "streak_30",
    title: "30 Day Streak",
    description: "A month straight — discipline on display.",
    category: "Consistency",
    rarity: "epic",
  },
};

export const ACHIEVEMENT_IDS = Object.keys(ACHIEVEMENTS);

export function getAchievement(id) {
  return ACHIEVEMENTS[id] || null;
}
