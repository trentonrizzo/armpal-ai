
import { useEffect, useState } from "react";

/**
 * ArmPal AI Overlay — BIG ADD‑ONLY VERSION
 * RULES:
 * - NOTHING REMOVED from Batch 5 conceptually
 * - Context logic ADDED (not refactored)
 * - Message pools EXPANDED (per‑lift, per‑mood)
 * - File intentionally BIGGER for safety + future GPT swap
 */

export default function DashboardAIOverlay({
  userStats = {},
  onClose,
}) {
  /* ================= GLOBAL SETTINGS ================= */
  const [mode, setMode] = useState(
    localStorage.getItem("armpal_ai_mode") || "savage"
  );

  const enabled =
    localStorage.getItem("armpal_ai_enabled") !== "false";

  const [rules, setRules] = useState(
    localStorage.getItem("armpal_ai_rules") || ""
  );

  /* ================= INTERNAL STATE ================= */
  const [message, setMessage] = useState("");
  const [tick, setTick] = useState(0);

  /* ================= USER CONTEXT ================= */
  const {
    lastWorkoutDaysAgo,
    upcomingWorkoutToday,
    recentPR,
    streakDays,
    benchStalled,
    squatStalled,
    deadliftStalled,
  } = userStats;

  /* ================= MESSAGE POOLS ================= */

  // GENERAL SAVAGE
  const savageGeneral = [
    "You don’t need motivation. You need discipline.",
    "Comfort is killing your progress.",
    "You trained harder when you were weaker. Fix that.",
    "Skipping today won’t ruin you. Repeating it will.",
    "Average effort produces average results.",
    "PRs mean nothing without consistency.",
    "You say you want this. Prove it.",
    "Nobody remembers skipped workouts. Your body does.",
  ];

  // BENCH FOCUSED
  const savageBench = [
    "Bench stalled because your setup is lazy.",
    "If your bench isn’t moving, neither is your effort.",
    "Bench days expose discipline fast.",
    "Strong chest, weak commitment?",
  ];

  // SQUAT FOCUSED
  const savageSquat = [
    "Squat stalled because you avoid hard reps.",
    "Depth isn’t optional.",
    "Leg days separate talkers from doers.",
    "Heavy squats don’t care about excuses.",
  ];

  // DEADLIFT FOCUSED
  const savageDeadlift = [
    "Deadlift stalled because tension is trash.",
    "Grip failing before willpower.",
    "Deadlifts punish laziness instantly.",
    "Pull with intent or don’t pull at all.",
  ];

  // COACH MODE
  const coachGeneral = [
    "Consistency over time drives adaptation.",
    "Fatigue management dictates longevity.",
    "Progress requires sufficient stimulus.",
    "Recovery is part of training.",
  ];

  // MOTIVATION MODE
  const motivationGeneral = [
    "Momentum compounds quickly.",
    "Show up today.",
    "You are closer than you think.",
    "Win today. Stack tomorrow.",
  ];

  /* ================= MESSAGE PICKERS ================= */

  function pickSavage() {
    if (benchStalled) return savageBench[Math.floor(Math.random() * savageBench.length)];
    if (squatStalled) return savageSquat[Math.floor(Math.random() * savageSquat.length)];
    if (deadliftStalled) return savageDeadlift[Math.floor(Math.random() * savageDeadlift.length)];
    return savageGeneral[Math.floor(Math.random() * savageGeneral.length)];
  }

  function pickCoach() {
    return coachGeneral[Math.floor(Math.random() * coachGeneral.length)];
  }

  function pickMotivation() {
    return motivationGeneral[Math.floor(Math.random() * motivationGeneral.length)];
  }

  function pickContextLayer() {
    if (recentPR)
      return mode === "savage"
        ? "Nice PR. Don’t get sentimental. Build on it."
        : "Recent PR detected. Maintain workload.";
    if (upcomingWorkoutToday)
      return mode === "savage"
        ? "Workout today. Don’t ghost your own plan."
        : "Workout scheduled today.";
    if (lastWorkoutDaysAgo >= 3)
      return mode === "savage"
        ? `It’s been ${lastWorkoutDaysAgo} days. That’s avoidance.`
        : `Training gap detected.`;
    if (streakDays >= 5)
      return mode === "savage"
        ? `${streakDays}-day streak. Don’t get soft.`
        : `${streakDays}-day streak maintained.`;
    return null;
  }

  function pickMessage() {
    let base =
      mode === "savage"
        ? pickSavage()
        : mode === "coach"
        ? pickCoach()
        : pickMotivation();

    const context = pickContextLayer();
    if (context) base = context + "\n\n" + base;

    if (rules) base += `\n\nAI Note: ${rules}`;

    return base;
  }

  /* ================= EFFECTS ================= */

  useEffect(() => {
    localStorage.setItem("armpal_ai_mode", mode);
  }, [mode]);

  useEffect(() => {
    setRules(localStorage.getItem("armpal_ai_rules") || "");
  }, [tick]);

  useEffect(() => {
    setMessage(pickMessage());
  }, [mode, tick]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 90000);
    return () => clearInterval(interval);
  }, []);

  if (!enabled) return null;

  /* ================= RENDER ================= */

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 760,
          background: "#000",
          color: "#fff",
          padding: 16,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          borderTop: "3px solid red",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <strong>ArmPal AI Coach</strong>
          <button onClick={onClose} style={{ color: "#fff" }}>✕</button>
        </div>

        <p style={{ fontSize: 15, lineHeight: 1.45, whiteSpace: "pre-line" }}>
          {message}
        </p>

        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <button
            onClick={() => setTick((t) => t + 1)}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: "none",
              background: "#222",
              color: "#fff",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Give me advice
          </button>

          <span
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              fontSize: 12,
              background:
                mode === "savage"
                  ? "#b91c1c"
                  : mode === "coach"
                  ? "#2563eb"
                  : "#16a34a",
            }}
          >
            {mode.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
}
