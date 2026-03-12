export const ONBOARDING_PHASE_SETUP = "setup";
export const ONBOARDING_PHASE_TOUR = "tour";

export const ONBOARDING_STEPS = [
  // Phase 1 — Profile setup (short, required)
  {
    id: "welcome",
    phase: ONBOARDING_PHASE_SETUP,
    route: "/profile",
    target: null,
    title: "Welcome to ArmPal",
    description:
      "Track your workouts, PRs, nutrition, and goals. Connect with friends and monitor your progress.",
    type: "modal",
    trigger: { type: "button", action: "start_profile" },
  },
  {
    id: "profile_intro",
    phase: ONBOARDING_PHASE_SETUP,
    route: "/profile",
    target: null,
    title: "Create your profile",
    description:
      "Create a name and handle to continue. The rest is optional. Tap Save to start the tour.",
    type: "modal",
    trigger: { type: "button", action: "start_profile_instructions" },
  },
  {
    id: "profile_edit",
    phase: ONBOARDING_PHASE_SETUP,
    route: "/profile",
    target: "[data-onboarding='display-handle-block']",
    title: "Set your profile",
    description: "Enter your name and handle, then tap Save.",
    trigger: null,
  },

  // Phase 2 — App tour (only after profile saved)
  {
    id: "profile_saved",
    phase: ONBOARDING_PHASE_TOUR,
    route: "/profile",
    target: null,
    title: "Profile Saved",
    description: "Let's take a quick tour.",
    trigger: { type: "button", action: "start_tour" },
  },
  {
    id: "tour_workouts",
    phase: ONBOARDING_PHASE_TOUR,
    route: "/workouts",
    target: "[data-onboarding='workouts-add']",
    title: "Workouts",
    description: "This is where you log workouts.",
    trigger: { type: "button", action: "next" },
  },
  {
    id: "tour_overview",
    phase: ONBOARDING_PHASE_TOUR,
    route: "/workouts",
    target: "[data-onboarding='nav-tabs']",
    title: "Track progress",
    description: "ArmPal tracks workouts, PRs, measurements, nutrition, and goals.",
    trigger: { type: "button", action: "next" },
  },
  {
    id: "tour_friends",
    phase: ONBOARDING_PHASE_TOUR,
    route: "/",
    target: "[data-onboarding='friends-button']",
    title: "Friends",
    description: "Add friends here to train together.",
    trigger: { type: "button", action: "next" },
  },
  {
    id: "tour_dashboard",
    phase: ONBOARDING_PHASE_TOUR,
    route: "/",
    target: "[data-onboarding='dashboard-main']",
    title: "Dashboard",
    description: "Your dashboard shows progress and activity.",
    trigger: { type: "button", action: "next" },
  },
  {
    id: "tour_strength",
    phase: ONBOARDING_PHASE_TOUR,
    route: "/",
    target: "[data-onboarding='strength-calculator']",
    title: "Strength calculator",
    description: "Use the strength calculator to estimate max lifts.",
    trigger: { type: "button", action: "next" },
  },
  {
    id: "tour_settings",
    phase: ONBOARDING_PHASE_TOUR,
    route: "/profile",
    target: "[data-onboarding='settings-button']",
    title: "Settings",
    description: "Customize ArmPal in settings.",
    trigger: { type: "button", action: "next" },
  },
  {
    id: "tour_complete",
    phase: ONBOARDING_PHASE_TOUR,
    route: "/",
    target: null,
    title: "You're ready.",
    description: "Go to the dashboard to start training.",
    trigger: { type: "button", action: "finish" },
  },
];

