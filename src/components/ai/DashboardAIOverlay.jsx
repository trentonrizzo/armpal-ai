
import { useEffect, useState } from "react";

export default function DashboardAIOverlay({
  userStats,
  mode = "savage",
  onClose,
}) {
  const [message, setMessage] = useState("");
  const [index, setIndex] = useState(0);

  const savageMessages = [
    "You opened the app. That already puts you ahead of who you were yesterday.",
    "Squat PR is strong. Consistency is still questionable.",
    "Discipline beats motivation. You don’t look disciplined today.",
    "Training works when you don’t feel like training.",
    "You don’t need more motivation. You need fewer excuses.",
    "Strength is built on boring days. Today counts.",
    "Most people quit right where you are. Decide who you are.",
    "The program works. The question is whether *you* do.",
    "No one remembers skipped workouts. Your body does.",
    "Progress doesn’t care how you feel.",
  ];

  const coachMessages = [
    "Consistency over time produces measurable results.",
    "Today’s session contributes to long-term adaptation.",
    "Strength gains depend on recovery and execution.",
    "Track performance trends to identify plateaus.",
    "Fatigue management is as important as intensity.",
  ];

  const pool = mode === "savage" ? savageMessages : coachMessages;

  useEffect(() => {
    if (!pool.length) return;
    setMessage(pool[index % pool.length]);
  }, [index]);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => i + 1);
    }, 120000); // rotate every 2 minutes

    return () => clearInterval(interval);
  }, []);

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
          maxWidth: 720,
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
            marginBottom: 6,
          }}
        >
          <strong>ArmPal AI Coach</strong>
          <button onClick={onClose} style={{ color: "#fff", opacity: 0.7 }}>
            ✕
          </button>
        </div>

        <p style={{ fontSize: 15, lineHeight: 1.45 }}>{message}</p>

        <div style={{ marginTop: 10 }}>
          <span
            style={{
              fontSize: 11,
              padding: "4px 10px",
              borderRadius: 999,
              background: mode === "savage" ? "#b91c1c" : "#2563eb",
            }}
          >
            {mode.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
}
