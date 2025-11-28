// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const [userId, setUserId] = useState(null);
  const [goals, setGoals] = useState([]);

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      const id = data?.user?.id;
      setUserId(id);

      if (id) loadGoals(id);
    }
    loadUser();
  }, []);

  async function loadGoals(uid) {
    const { data } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", uid)
      .limit(3) // show top 3 goals
      .order("updated_at", { ascending: false });

    setGoals(data || []);
  }

  function getProgress(goal) {
    const current = goal.current_value || 0;
    const target = goal.target_value || 0;
    if (!target || target <= 0) return 0;
    return Math.round((current / target) * 100);
  }

  return (
    <div className="min-h-screen px-5 pb-24 pt-6 text-white bg-black">
      <h1 className="text-4xl font-extrabold">ArmPal</h1>
      <p className="mt-1 text-lg text-gray-300">Stronger every session.</p>
      <p className="text-red-500 font-bold">YOU</p>

      {/* ---------- QUICK ACTIONS ---------- */}
      <h2 className="section-title mt-8">Quick Actions</h2>

      <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory no-scrollbar">
        {[
          { label: "Track Workout", link: "/workouts" },
          { label: "Log a new session", link: "/workouts" },
          { label: "View PRs", link: "/prs" },
          { label: "Check your records", link: "/prs" },
          { label: "Update Measurements", link: "/measure" },
          { label: "Arms, weight, more", link: "/measure" },
          { label: "Goals", link: "/goals" },
          { label: "View your targets", link: "/goals" },
        ].map((item, idx) => (
          <Link
            key={idx}
            to={item.link}
            className="
              qa-btn snap-center whitespace-nowrap
              px-5 py-3 rounded-xl bg-neutral-900
              border border-neutral-700 text-sm text-white
              hover:border-red-500 transition
            "
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* ---------- LAST WORKOUT ---------- */}
      <div className="card mt-4">
        <h3 className="text-xl font-bold">Last Workout</h3>
        <p className="text-gray-400">See your most recent session and keep the streak alive.</p>
      </div>

      {/* ---------- LATEST PR ---------- */}
      <div className="card mt-4">
        <h3 className="text-xl font-bold">Latest PR</h3>
        <p className="text-gray-400">Check your newest records and plan your next milestone.</p>
        <Link to="/prs" className="text-red-400 text-sm mt-1 inline-block">
          Go to PRs →
        </Link>
      </div>

      {/* ---------- GOAL PROGRESS ---------- */}
      <div className="card mt-6">
        <h3 className="text-xl font-bold">Goal Progress</h3>

        {goals.length === 0 && (
          <p className="text-gray-500 mt-1">No goals yet. Go set some targets!</p>
        )}

        {goals.map((goal, i) => {
          const progress = getProgress(goal);

          return (
            <div key={goal.id} className="mt-4">
              <p className="font-semibold text-lg">
                {goal.title}
              </p>

              {/* numeric */}
              <p className="text-sm text-gray-400">
                {goal.current_value || 0} / {goal.target_value || 0}
              </p>

              {/* progress bar */}
              <div className="goal-progress-bar mt-2">
                <div
                  className={`goal-progress-fill ${
                    progress > 100 ? "bg-yellow-400 progress-glow" : "bg-red-500"
                  }`}
                  style={{ width: `${Math.min(progress, 120)}%` }}
                ></div>
              </div>

              <p className="text-xs text-gray-400 mt-1">{progress}% complete</p>
            </div>
          );
        })}

        <Link
          to="/goals"
          className="text-red-400 text-sm mt-3 inline-block"
        >
          View all goals →
        </Link>
      </div>
    </div>
  );
}
