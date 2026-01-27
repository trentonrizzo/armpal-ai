import { useEffect, useState } from "react";

/**
 * DashboardAIOverlay (FINAL MODES, BIG FILE)
 * - Reads: armpal_ai_mode, armpal_ai_enabled, armpal_ai_rules
 * - Supports: savage, coach, motivation, recovery, science, vulgar
 * - Vulgar mode only appears if armpal_ai_vulgar_ack=true (hard safety gate)
 * - Uses CSS vars so it matches your theme (accent, card, border, text)
 */

export default function DashboardAIOverlay({ userStats = {}, onClose }) {
  const enabled = localStorage.getItem("armpal_ai_enabled") !== "false";

  const [mode, setMode] = useState(localStorage.getItem("armpal_ai_mode") || "savage");
  const [rules, setRules] = useState(localStorage.getItem("armpal_ai_rules") || "");
  const [message, setMessage] = useState("");
  const [tick, setTick] = useState(0);

  const vulgarOk = localStorage.getItem("armpal_ai_vulgar_ack") === "true";

  const {
    lastWorkoutDaysAgo,
    upcomingWorkoutToday,
    recentPR,
    streakDays,
    benchStalled,
    squatStalled,
    deadliftStalled,
  } = userStats;

  /* ==================== POOLS ==================== */

  const savageGeneral = [
    "You don’t need motivation. You need discipline.",
    "Comfort is killing your progress.",
    "You trained harder when you were weaker. Fix that.",
    "Skipping today won’t ruin you. Repeating it will.",
    "Average effort produces average results.",
    "PRs mean nothing without consistency.",
    "You say you want this. Prove it.",
    "Nobody remembers skipped workouts. Your body does.",
    "If you can scroll, you can train.",
    "You’re not tired. You’re undisciplined.",
  ];

  const coachGeneral = [
    "Consistency over time drives adaptation.",
    "Prioritize execution: sleep, nutrition, and progressive overload.",
    "Manage fatigue to sustain performance.",
    "Track trends, not emotions. Adjust based on data.",
    "If performance stalls, change ONE variable at a time.",
  ];

  const motivationGeneral = [
    "Show up today. Momentum follows.",
    "Every rep compounds.",
    "You are closer than you think.",
    "Win today. Stack tomorrow.",
    "Make it ugly if you have to — just show up.",
  ];

  const recoveryGeneral = [
    "If joints are irritated, reduce intensity and increase quality reps.",
    "Recovery is training. Sleep and food are part of your program.",
    "Deloads keep you progressing. Ego breaks you.",
    "Pain is a signal. Adjust volume and exercise selection.",
    "If you’re smoked, do a lighter session and keep the habit alive.",
  ];

  const scienceGeneral = [
    "Strength ≈ skill × muscle × recovery. Improve the weakest link.",
    "For hypertrophy: 10–20 hard sets per muscle/week is a common target range.",
    "RPE 7–9 is usually the sweet spot for most growth and strength work.",
    "If you plateau: increase volume 10–20% OR reduce fatigue with a deload week.",
    "1RM estimate (Epley): weight × (1 + reps/30). Use it consistently.",
  ];

  // Per-lift packs
  const savageBench = [
    "Bench stalled because your setup is lazy.",
    "If your bench isn’t moving, neither is your effort.",
    "Bench days expose discipline fast.",
    "Strong chest, weak commitment?",
  ];

  const savageSquat = [
    "Squat stalled because you avoid hard reps.",
    "Depth isn’t optional.",
    "Leg days separate talkers from doers.",
    "Heavy squats don’t care about excuses.",
  ];

  const savageDeadlift = [
    "Deadlift stalled because tension is trash.",
    "Grip failing before willpower.",
    "Deadlifts punish laziness instantly.",
    "Pull with intent or don’t pull at all.",
  ];

  // Vulgar/Unhinged (gated)
  const vulgarGeneral = [
    "Alright you absolute menace — time to work. No more doom-scrolling like a gremlin.",
    "If you skip today, you’re officially the CEO of excuses. Congrats.",
    "You want results? Then stop training like a sleepy house cat.",
    "You can’t ‘manifest’ strength. Pick up the weight, you magnificent idiot.",
    "If you’re gonna be a fat ass about it, at least be consistent.",
  ];

  /* ==================== PICKERS ==================== */

  function pickFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function contextLayer() {
    if (recentPR) {
      if (mode === "vulgar") return "Nice PR. Don’t get emotional. Go earn another one, dumbass.";
      if (mode === "savage") return "Nice PR. Don’t get sentimental. Build on it.";
      if (mode === "science") return "PR logged. Keep stimulus high for 2–3 weeks to solidify adaptation.";
      return "Recent PR detected. Maintain workload and recover well.";
    }

    if (upcomingWorkoutToday) {
      if (mode === "vulgar") return "Workout’s today. Don’t ghost your own plan like a clown.";
      if (mode === "savage") return "Workout today. Don’t ghost your own plan.";
      return "Workout scheduled today. Execute as planned.";
    }

    if (typeof lastWorkoutDaysAgo === "number" && lastWorkoutDaysAgo >= 3) {
      if (mode === "vulgar") return `It’s been ${lastWorkoutDaysAgo} days. That’s not recovery — that’s avoidance, champ.`;
      if (mode === "savage") return `It’s been ${lastWorkoutDaysAgo} days. That’s avoidance, not recovery.`;
      return `Training gap detected (${lastWorkoutDaysAgo} days). Address consistency.`;
    }

    if (benchStalled || squatStalled || deadliftStalled) {
      if (mode === "vulgar") return "Lift stalled. Either volume, recovery, or honesty is missing. Fix it.";
      if (mode === "savage") return "Lift stalled. Either volume, recovery, or honesty is missing.";
      return "Plateau detected. Adjust volume, intensity, or recovery.";
    }

    if (typeof streakDays === "number" && streakDays >= 5) {
      if (mode === "vulgar") return `${streakDays}-day streak. Don’t get soft now, keep your foot on the gas.`;
      if (mode === "savage") return `${streakDays}-day streak. Don’t get soft now.`;
      return `${streakDays}-day streak. Maintain momentum.`;
    }

    return null;
  }

  function pickBaseMessage() {
    if (mode === "vulgar" && !vulgarOk) {
      // Hard fail-safe: if somehow set without accept, degrade to savage.
      return pickFrom(savageGeneral);
    }

    if (mode === "savage") {
      if (benchStalled) return pickFrom(savageBench);
      if (squatStalled) return pickFrom(savageSquat);
      if (deadliftStalled) return pickFrom(savageDeadlift);
      return pickFrom(savageGeneral);
    }

    if (mode === "coach") return pickFrom(coachGeneral);
    if (mode === "motivation") return pickFrom(motivationGeneral);
    if (mode === "recovery") return pickFrom(recoveryGeneral);
    if (mode === "science") return pickFrom(scienceGeneral);
    if (mode === "vulgar") return pickFrom(vulgarGeneral);

    // Fallback
    return pickFrom(savageGeneral);
  }

  function buildMessage() {
    const top = contextLayer();
    const base = pickBaseMessage();

    let out = base;
    if (top) out = top + "\n\n" + base;

    // Rules from dashboard section
    if (rules) out += `\n\nAI Note: ${rules}`;

    return out;
  }

  /* ==================== EFFECTS ==================== */

  useEffect(() => {
    // stay synced with dashboard settings
    setMode(localStorage.getItem("armpal_ai_mode") || "savage");
  }, [tick]);

  useEffect(() => {
    setRules(localStorage.getItem("armpal_ai_rules") || "");
  }, [tick]);

  useEffect(() => {
    setMessage(buildMessage());
  }, [mode, tick]);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 90000);
    return () => clearInterval(interval);
  }, []);

  if (!enabled) return null;

  /* ==================== RENDER ==================== */

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
        padding: 12,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 760,
          background: "var(--card)",
          color: "var(--text)",
          padding: 14,
          borderRadius: 16,
          border: "1px solid var(--border)",
          boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <strong>ArmPal AI Coach</strong>
          <button
            onClick={onClose}
            style={{
              color: "var(--text)",
              border: "1px solid var(--border)",
              background: "transparent",
              borderRadius: 10,
              padding: "6px 10px",
              cursor: "pointer",
              opacity: 0.9,
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: 14, lineHeight: 1.45, whiteSpace: "pre-line", marginTop: 10 }}>
          {message}
        </p>

        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={() => setTick((t) => t + 1)}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: "var(--card-2)",
              color: "var(--text)",
              fontSize: 12,
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            Give me advice
          </button>

          <span
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 900,
              border: "1px solid var(--border)",
              background: "var(--card-2)",
            }}
          >
            {mode.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
}
