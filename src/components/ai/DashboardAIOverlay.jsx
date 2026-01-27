import { useEffect, useState } from "react";

export default function DashboardAIOverlay({ userStats, mode = "savage", onClose }) {
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!userStats) return;

    const { lastWorkoutDaysAgo, benchPR, squatPR, streakDays } = userStats;

    const savageMessages = [];
    const coachMessages = [];

    if (lastWorkoutDaysAgo >= 7) {
      savageMessages.push(
        `You haven't trained in ${lastWorkoutDaysAgo} days. Not injured. Just lazy.`
      );
      coachMessages.push(
        `It's been ${lastWorkoutDaysAgo} days since your last session. Consistency is slipping.`
      );
    }

    if (benchPR) {
      savageMessages.push(
        `Bench PR is ${benchPR}. Cool. Still not 405 though.`
      );
      coachMessages.push(
        `Current bench PR: ${benchPR}. Progress is steady. Next milestone approaching.`
      );
    }

    if (squatPR) {
      savageMessages.push(
        `Squat PR ${squatPR}. Legs aren't the problem. Your discipline is.`
      );
      coachMessages.push(
        `Squat strength is solid at ${squatPR}. Maintain volume to avoid regression.`
      );
    }

    if (streakDays >= 5) {
      savageMessages.push(
        `${streakDays}-day streak. Don't get soft now.`
      );
      coachMessages.push(
        `${streakDays}-day training streak. Momentum is on your side.`
      );
    }

    const pool = mode === "savage" ? savageMessages : coachMessages;

    setMessage(pool[Math.floor(Math.random() * pool.length)] || "Log a workout so I have something to judge.");
  }, [userStats, mode]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 999999, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 720, background: "#000", color: "#fff", padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold">ArmPal AI Coach</h3>
          <button onClick={onClose} className="text-sm opacity-70 hover:opacity-100">✕</button>
        </div>

        <p className="text-base leading-relaxed">{message}</p>

        <div className="mt-4 flex gap-2">
          <span className="text-xs rounded-full bg-red-600 px-3 py-1">{mode.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}
