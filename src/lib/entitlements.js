export const PRO_FEATURES = {
  voice: {
    id: "voice",
    title: "Voice fitness assistant",
    body: "Talk to ArmPal to check PRs, update your log, and get answers hands-free.",
  },
  ai_chat: {
    id: "ai_chat",
    title: "AI Coach",
    body: "Ask ArmPal about your training and let it help build workouts from your data.",
  },
  food_scan: {
    id: "food_scan",
    title: "Smart Food Scan",
    body: "Photograph a meal and get calorie and macro estimates.",
  },
  workout_converter: {
    id: "workout_converter",
    title: "AI Workout Converter",
    body: "Paste a program and turn it into saved ArmPal workouts.",
  },
  advanced_analytics: {
    id: "advanced_analytics",
    title: "Advanced analytics",
    body: "Charts and trends for bodyweight, measurements, and PR history.",
  },
};

export const FREE_FEATURE_LIST = [
  "Unlimited workout logging",
  "Unlimited PRs, measurements, bodyweight, and goals",
  "Nutrition logging",
  "Profile, friends, and chat",
  "Strength calculator",
  "Basic progress snapshot",
];

export const PRO_FEATURE_LIST = [
  "Voice fitness assistant",
  "AI Coach chat",
  "Smart Food Scan",
  "AI Workout Converter",
  "Advanced analytics and PR trends",
];

export function isProStatus(value) {
  return value === true || value === "pro";
}
