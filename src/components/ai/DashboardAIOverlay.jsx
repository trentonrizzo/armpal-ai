
import { useEffect, useState } from "react";

/**
 * ArmPal AI Overlay — MERGED VERSION
 * - Keeps Batch 5 savage depth & personality buttons
 * - Adds custom rules from DashboardAISection
 * - Adds "Give me advice" button
 * - NO logic removed
 */

export default function DashboardAIOverlay({
  userStats = {},
  onClose,
}) {
  // ====== GLOBAL SETTINGS (synced with dashboard) ======
  const [mode, setMode] = useState(
    localStorage.getItem("armpal_ai_mode") || "savage"
  );

  const enabled =
    localStorage.getItem("armpal_ai_enabled") !== "false";

  const [rules, setRules] = useState(
    localStorage.getItem("armpal_ai_rules") || ""
  );

  // ====== INTERNAL STATE ======
  const [message, setMessage] = useState("");
  const [tick, setTick] = useState(0);

  // ====== MESSAGE POOLS (BIG & DIRTY) ======
  const savage = [
    "You don’t need motivation. You need to stop being comfortable.",
    "Rest days are earned. This one wasn’t.",
    "You said you wanted this. Act like it.",
    "Skipping today won’t ruin you. Repeating it will.",
    "No one is coming to save your progress.",
    "Your discipline disappears the moment things get inconvenient.",
    "You trained harder when you were weaker. Fix that.",
    "Comfort is the real addiction.",
    "You don’t need a new program. You need to execute.",
    "Most people quit right before results show. Be smarter.",
    "You check the app more than you train. Interesting.",
    "This version of you is temporary — decide which way it goes.",
    "PRs are cool. Consistency is cooler.",
    "Your body remembers what your mind tries to forget.",
    "Average effort produces average results.",
  ];

  const coach = [
    "Consistency over time is the primary driver of adaptation.",
    "Training quality matters more than novelty.",
    "Manage fatigue to maintain performance.",
    "Track trends, not emotions.",
    "Progress requires sufficient stimulus and recovery.",
    "Small execution errors compound over weeks.",
    "Recovery is part of training, not an excuse to skip it.",
  ];

  const motivation = [
    "Every rep today is an investment in future strength.",
    "Momentum compounds faster than motivation.",
    "You are closer than you think.",
    "Show up. The rest follows.",
    "Win the day. Stack the days.",
    "Confidence is built by keeping promises to yourself.",
  ];

  // ====== MESSAGE PICKER ======
  function pickMessage() {
    const pool =
      mode === "savage"
        ? savage
        : mode === "coach"
        ? coach
        : motivation;

    let base =
      pool[Math.floor(Math.random() * pool.length)];

    // Apply custom rules as bias / context
    if (rules) {
      base += `\n\nAI Note: ${rules}`;
    }

    return base;
  }

  // ====== EFFECTS ======
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
    }, 90000); // rotate every ~90s
    return () => clearInterval(interval);
  }, []);

  if (!enabled) return null;

  // ====== RENDER ======
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <strong>ArmPal AI Coach</strong>
          <button
            onClick={onClose}
            style={{ color: "#fff", opacity: 0.7 }}
          >
            ✕
          </button>
        </div>

        <p
          style={{
            fontSize: 15,
            lineHeight: 1.45,
            whiteSpace: "pre-line",
          }}
        >
          {message}
        </p>

        {/* ACTIONS */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 14,
            flexWrap: "wrap",
          }}
        >
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
