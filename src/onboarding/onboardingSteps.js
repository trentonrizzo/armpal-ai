export const ONBOARDING_PHASE_SETUP = "setup";
export const ONBOARDING_PHASE_TOUR = "tour";

export const ONBOARDING_STEPS = [
  // Phase 1 — Profile setup
  {
    id: "welcome",
    phase: ONBOARDING_PHASE_SETUP,
    route: "/profile",
    target: null,
    title: "Welcome to ArmPal",
    description: "Track workouts. Build strength. Train with friends.",
    trigger: { type: "button", action: "start_profile" },
  },
  {
    id: "profile_display_name",
    phase: ONBOARDING_PHASE_SETUP,
    route: "/profile",
    target: "[data-onboarding='display-name']",
    title: "Set your display name",
    description: "This is the name people will see.",
    trigger: { type: "display_name_valid", minLength: 2 },
  },
  {
    id: "profile_handle",
    phase: ONBOARDING_PHASE_SETUP,
    route: "/profile",
    target: "[data-onboarding='handle']",
    title: "Choose your handle",
    description: "Choose your handle so friends can find you.",
    trigger: { type: "handle_valid", minLength: 3 },
  },
  {
    id: "profile_bio",
    phase: ONBOARDING_PHASE_SETUP,
    route: "/profile",
    target: "[data-onboarding='bio']",
    title: "Add a bio (optional)",
    description: "Tell people what you're training for.",
    trigger: { type: "button", action: "next_or_skip" },
  },
  {
    id: "profile_save",
    phase: ONBOARDING_PHASE_SETUP,
    route: "/profile",
    target: "[data-onboarding='save-profile']",
    title: "Save your profile",
    description: "Save your profile to continue.",
    trigger: { type: "event", name: "ap_onboarding_profile_saved" },
  },
  {
    id: "profile_success",
    phase: ONBOARDING_PHASE_SETUP,
    route: "/profile",
    target: null,
    title: "Profile Ready",
    description: "You're all set. Let's explore ArmPal.",
    trigger: { type: "button", action: "start_tour" },
  },

  // Phase 2 — App tour
  {
    id: "tour_workouts",
    phase: ONBOARDING_PHASE_TOUR,
    route: "/workouts",
    target: "[data-onboarding='workouts-add']",
    title: "Log workouts",
    description:
      "This is where you log workouts. Track exercises, sets, reps, and PRs here.",
    trigger: { type: "button", action: "next_or_skip_tour" },
  },
  {
    id: "tour_tracking_overview",
    phase: ONBOARDING_PHASE_TOUR,
    route: "/workouts",
    target: "[data-onboarding='nav-tabs']",
    title: "Track everything",
    description:
      "ArmPal tracks PRs, body measurements, nutrition, and goals so you can see your progress.",
    trigger: { type: "button", action: "next" },
  },
  {
    id: "tour_friends",
    phase: ONBOARDING_PHASE_TOUR,
    route: "/",
    target: "[data-onboarding='friends-button']",
    title: "Train with friends",
    description:
      "Train with friends. Add lifters here and share progress to stay motivated.",
    trigger: { type: "button", action: "next" },
  },
  {
    id: "tour_dashboard",
    phase: ONBOARDING_PHASE_TOUR,
    route: "/",
    target: "[data-onboarding='dashboard-main']",
    title: "Dashboard overview",
    description:
      "Your dashboard shows streaks, progress, and activity. It's your home base.",
    trigger: { type: "button", action: "next" },
  },
  {
    id: "tour_strength_calculator",
    phase: ONBOARDING_PHASE_TOUR,
    route: "/",
    target: "[data-onboarding='strength-calculator']",
    title: "Strength calculator",
    description:
      "Use the strength calculator to estimate your max lifts and plan training.",
    trigger: { type: "button", action: "next" },
  },
  {
    id: "tour_settings",
    phase: ONBOARDING_PHASE_TOUR,
    route: "/profile",
    target: "[data-onboarding='settings-button']",
    title: "Settings",
    description:
      "You can customize ArmPal in settings. Change colors, preferences, and more.",
    trigger: { type: "button", action: "next" },
  },
  {
    id: "tour_complete",
    phase: ONBOARDING_PHASE_TOUR,
    route: "/",
    target: null,
    title: "You're ready.",
    description: "Start logging workouts and building strength.",
    trigger: { type: "button", action: "finish" },
  },
];

