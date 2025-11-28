// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { getGoals } from "../api/goals";

export default function Dashboard() {
  const [dashboardGoals, setDashboardGoals] = useState([]);
  const [loadingGoals, setLoadingGoals] = useState(true);

  // Load a few goals for dashboard preview
  useEffect(() => {
    const loadGoals = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const userId = data?.user?.id;
        if (!userId) {
          setLoadingGoals(false);
          return;
        }

        const allGoals = await getGoals(userId);

        // For now: show up to 3 "active" goals (active true or null)
        const active = (allGoals || []).filter(
          (g) => g.active !== false // treat null/true as active
        );

        // later we can filter by g.pinned_to_dashboard === true
        setDashboardGoals(active.slice(0, 3));
      } catch (err) {
        console.error("Error loading dashboard goals:", err);
      } finally {
        setLoadingGoals(false);
      }
    };

    loadGoals();
  }, []);

  const renderGoalPreview = (goal) => {
    const current = Number(goal.current_value) || 0;
    const target = Number(goal.target_value) || 0;

    const raw = target > 0 ? Math.round((current / target) * 100) : 0;
    const percent = raw;
    const capped = Math.min(raw, 100);
    const isOver = percent > 100;

    return (
      <div key={goal.id} className="mb-3">
        <div className="flex justify-between text-xs text-neutral-300 mb-1">
          <span className="font-semibold text-sm text-white">
            {goal.title}
          </span>
          <span className="text-neutral-400">
            {current} / {target}
          </span>
        </div>

        <div
          className="goal-progress-bar relative overflow-visible"
          style={{ height: "10px" }}
        >
          <div
            className={`goal-progress-fill ${
              isOver ? "over-goal-fill" : "progress-glow"
            }`}
            style={{
              width: `${capped}%`,
              height: "100%",
              borderRadius: "20px",
              background: isOver
                ? "linear-gradient(90deg, #ffdd55, #ffaa00)"
                : "var(--red-soft)",
            }}
          ></div>

          {isOver && (
            <div
              className="absolute top-1/2 -translate-y-1/2"
              style={{
                left: "100%",
                width: "26px",
                height: "10px",
                background:
                  "linear-gradient(90deg, rgba(255,221,85,0.9), rgba(255,170,0,0.8))",
                boxShadow: "0 0 8px rgba(255,200,0,0.7)",
                borderRadius: "10px",
                marginLeft: "6px",
                animation: "pulseGlow 1.2s infinite ease-in-out",
              }}
            ></div>
          )}
        </div>

        <div className="text-right text-[11px] text-neutral-400 mt-1">
          {percent}% complete
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white px-5 pt-6 pb-24 fade-in">
      {/* HEADER */}
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">ArmPal</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Stronger every session.
          </p>
        </div>

        {/* PROFILE BUTTON */}
        <Link
          to="/profile"
          className="flex items-center justify-center w-11 h-11 rounded-full bg-neutral-900 border border-neutral-700 hover:border-red-500 transition"
        >
          <span className="text-xs text-neutral-300 font-semibold">YOU</span>
        </Link>
      </header>

      {/* STATS SECTION */}
      <section className="mb-7">
        <h2 className="section-title">Your Stats</h2>

        <div className="stats-grid">
          <div className="stat-box">
            <div className="stat-number">—</div>
            <div className="stat-label">Workouts</div>
          </div>
          <div className="stat-box">
            <div className="stat-number">—</div>
            <div className="stat-label">This Week</div>
          </div>
          <div className="stat-box">
            <div className="stat-number">—</div>
            <div className="stat-label">PR Count</div>
          </div>
        </div>
      </section>

      {/* QUICK ACTIONS */}
      <section className="mb-8">
        <h2 className="section-title">Quick Actions</h2>

        <div className="grid grid-cols-2 gap-3">
          <Link to="/workoutlogger" className="qa-btn qa-btn-red">
            <span className="block text-sm font-semibold">Track Workout</span>
            <span className="block text-xs text-neutral-400 mt-1">
              Log a new session
            </span>
          </Link>

          <Link to="/prs" className="qa-btn">
            <span className="block text-sm font-semibold">View PRs</span>
            <span className="block text-xs text-neutral-400 mt-1">
              Check your records
            </span>
          </Link>

          <Link to="/measure" className="qa-btn">
            <span className="block text-sm font-semibold">
              Update Measurements
            </span>
            <span className="block text-xs text-neutral-400 mt-1">
              Arms, weight, more
            </span>
          </Link>

          <Link to="/goals" className="qa-btn">
            <span className="block text-sm font-semibold">Goals</span>
            <span className="block text-xs text-neutral-400 mt-1">
              View your targets
            </span>
          </Link>
        </div>
      </section>

      {/* SUMMARY + GOAL PREVIEW */}
      <section className="space-y-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-neutral-300 tracking-wide uppercase mb-2">
            Last Workout
          </h3>
          <p className="text-sm text-neutral-400">
            See your most recent session and keep the streak alive.
          </p>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-neutral-300 tracking-wide uppercase mb-2">
            Latest PR
          </h3>
          <p className="text-sm text-neutral-400">
            Check your newest records and plan your next milestone.
          </p>
          <Link
            to="/prs"
            className="inline-block mt-3 text-xs text-red-400 hover:text-red-300"
          >
            Go to PRs →
          </Link>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-neutral-300 tracking-wide uppercase mb-2">
            Goal Progress
          </h3>

          {loadingGoals ? (
            <p className="text-sm text-neutral-500">Loading goals…</p>
          ) : dashboardGoals.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No active goals yet. Create one on the Goals tab.
            </p>
          ) : (
            <div className="space-y-3">
              {dashboardGoals.map((g) => renderGoalPreview(g))}
            </div>
          )}

          <Link
            to="/goals"
            className="inline-block mt-3 text-xs text-red-400 hover:text-red-300"
          >
            View all goals →
          </Link>
        </div>
      </section>
    </div>
  );
}
