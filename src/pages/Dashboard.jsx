// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const [userId, setUserId] = useState(null);
  const [goals, setGoals] = useState([]);
  const [upcoming, setUpcoming] = useState([]);

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      const id = data?.user?.id;
      setUserId(id);

      if (id) {
        loadGoals(id);
        loadUpcoming(id);
      }
    }
    loadUser();
  }, []);

  // -----------------------
  // LOAD GOALS
  // -----------------------
  async function loadGoals(uid) {
    const { data } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", uid)
      .limit(3)
      .order("updated_at", { ascending: false });

    setGoals(data || []);
  }

  // -----------------------
  // LOAD UPCOMING WORKOUTS (NEW SCHEDULED LOGIC)
  // -----------------------
  async function loadUpcoming(uid) {
    const { data, error } = await supabase
      .from("workouts")
      .select("*")
      .eq("user_id", uid)
      .not("scheduled_for", "is", null)               // Only workouts that HAVE a scheduled date
      .gte("scheduled_for", new Date().toISOString()) // Only FUTURE workouts
      .order("scheduled_for", { ascending: true })    // Soonest first
      .limit(3);

    if (error) {
      console.error("LOAD UPCOMING ERROR:", error);
    }

    setUpcoming(data || []);
  }

  // -----------------------
  // CALCULATE GOAL PROGRESS
  // -----------------------
  function getProgress(goal) {
    const current = goal.current_value || 0;
    const target = goal.target_value || 0;
    if (!target) return 0;
    return Math.min(Math.round((current / target) * 100), 100);
  }

  return (
    <div className="text-white p-4 pb-28">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>

      {/* ---------------- GOALS SECTION ---------------- */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Your Goals</h2>

        {goals.length === 0 ? (
          <p className="text-gray-400 text-sm">No goals yet.</p>
        ) : (
          goals.map((goal) => (
            <div
              key={goal.id}
              className="bg-[#111] p-3 rounded-lg border border-gray-800 mb-3"
            >
              <div className="flex justify-between mb-1">
                <span>{goal.title}</span>
                <span className="text-red-400">{getProgress(goal)}%</span>
              </div>

              <div className="w-full bg-gray-700 h-2 rounded">
                <div
                  className="bg-red-600 h-2 rounded"
                  style={{ width: `${getProgress(goal)}%` }}
                ></div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ---------------- UPCOMING WORKOUTS ---------------- */}
      {upcoming.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">Upcoming Workouts</h2>

          {upcoming.map((w) => (
            <div
              key={w.id}
              className="bg-[#111] p-3 rounded-lg border border-gray-800 mb-3"
            >
              <div className="flex justify-between">
                <span className="font-medium">{w.name}</span>
                <span className="text-gray-400 text-sm">
                  {new Date(w.scheduled_for).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* NONE SCHEDULED */}
      {upcoming.length === 0 && (
        <div className="text-gray-500 text-sm mb-6 italic">
          No upcoming workouts scheduled.
        </div>
      )}
    </div>
  );
}
