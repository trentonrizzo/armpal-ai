import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { motion } from "framer-motion";

export default function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [lastWorkout, setLastWorkout] = useState(null);
  const [prsCount, setPrsCount] = useState(0);
  const [workoutCount, setWorkoutCount] = useState(0);
  const [goals, setGoals] = useState([]); // ⬅ NEW

  useEffect(() => {
    loadProfile();
    loadStats();
    loadLastWorkout();
    loadGoals(); // ⬅ NEW
  }, []);

  async function loadProfile() {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) return;

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    setProfile(profileRow);
  }

  async function loadStats() {
    const { data: prData } = await supabase.from("PRs").select("id");
    const { data: wkData } = await supabase.from("workouts").select("id");

    setPrsCount(prData?.length || 0);
    setWorkoutCount(wkData?.length || 0);
  }

  async function loadLastWorkout() {
    const { data } = await supabase
      .from("workouts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);

    setLastWorkout(data?.[0] || null);
  }

  // ⬅ NEW: Load user goals
  async function loadGoals() {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) return;

    const { data } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    setGoals(data || []);
  }

  const username = profile?.username || "Athlete";
  const avatar = profile?.avatar_url || "/default-avatar.png";

  return (
    <div className="min-h-screen bg-black text-white px-6 pt-10 pb-24 overflow-y-scroll">

      {/* GRADIENT BACKLIGHT */}
      <div className="fixed top-0 left-0 right-0 h-64 bg-red-900/20 blur-3xl opacity-40 pointer-events-none"></div>

      {/* HERO HEADER */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex items-center justify-between mb-10"
      >
        <div>
          <div className="text-lg text-neutral-400">Welcome back,</div>
          <div className="text-4xl font-extrabold tracking-tight text-white drop-shadow-lg">
            {username}
          </div>
        </div>

        <motion.img
          src={avatar}
          className="w-14 h-14 rounded-2xl border border-red-600/40 shadow-lg object-cover"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.35 }}
        />
      </motion.div>

      {/* QUICK STATS */}
      <div className="mb-10">
        <h3 className="text-lg font-semibold text-red-400 mb-3">Your Stats</h3>

        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-neutral-900/70 rounded-xl border border-neutral-800 shadow-md text-center">
            <div className="text-2xl font-bold">{workoutCount}</div>
            <div className="text-xs text-neutral-400 mt-1">Workouts</div>
          </div>

          <div className="p-4 bg-neutral-900/70 rounded-xl border border-neutral-800 shadow-md text-center">
            <div className="text-2xl font-bold">{prsCount}</div>
            <div className="text-xs text-neutral-400 mt-1">PRs</div>
          </div>

          <div className="p-4 bg-neutral-900/70 rounded-xl border border-neutral-800 shadow-md text-center">
            <div className="text-2xl font-bold">
              {profile?.bio ? profile.bio.length : 0}
            </div>
            <div className="text-xs text-neutral-400 mt-1">Bio Length</div>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="mb-10">
        <h3 className="text-lg font-semibold text-red-400 mb-3">Quick Actions</h3>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div
            onClick={() => (window.location.href = "/workoutlogger")}
            className="py-3 bg-red-600/20 border border-red-800 rounded-xl text-sm text-red-300 font-semibold hover:bg-red-600/30 transition shadow-md active:scale-95"
          >
            Log<br />Workout
          </div>

          <div
            onClick={() => (window.location.href = "/prs")}
            className="py-3 bg-neutral-900/60 border border-neutral-700 rounded-xl text-sm text-neutral-300 font-semibold hover:bg-neutral-800 transition shadow-md active:scale-95"
          >
            Add<br />PR
          </div>

          <div
            onClick={() => (window.location.href = "/measurements")}
            className="py-3 bg-neutral-900/60 border border-neutral-700 rounded-xl text-sm text-neutral-300 font-semibold hover:bg-neutral-800 transition shadow-md active:scale-95"
          >
            Add<br />Measure
          </div>
        </div>
      </div>

      {/* LAST WORKOUT */}
      {lastWorkout && (
        <div className="mb-10">
          <h3 className="text-lg font-semibold text-red-400 mb-3">Last Workout</h3>

          <div className="p-5 bg-neutral-900/70 rounded-2xl border border-neutral-800 shadow-lg shadow-black/40">
            <div className="text-lg font-bold mb-2">
              {new Date(lastWorkout.created_at).toLocaleDateString()}
            </div>
            <div className="text-neutral-400 text-sm">
              {lastWorkout.notes || "No notes added."}
            </div>
          </div>
        </div>
      )}

      {/* GOALS PREVIEW */}
      <div className="mb-10">
        <h3 className="text-lg font-semibold text-red-400 mb-3">Your Goals</h3>

        {goals.length > 0 ? (
          goals.slice(0, 2).map((g) => {
            const percent = (g.current / g.target) * 100;
            const capped = Math.min(percent, 100);

            return (
              <div
                key={g.id}
                className="p-4 mb-3 bg-neutral-900/70 border border-neutral-800 rounded-xl"
              >
                <div className="flex justify-between mb-1">
                  <span className="font-bold">{g.title}</span>
                  <span className="text-red-500">{percent.toFixed(1)}%</span>
                </div>

                <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-red-600 transition-all ${
                      percent > 100
                        ? "shadow-[0_0_8px_2px_rgba(255,0,0,0.7)]"
                        : ""
                    }`}
                    style={{ width: `${capped}%` }}
                  />
                </div>

                {g.current > g.target && (
                  <div className="text-green-400 text-xs mt-1">
                    +{g.current - g.target} over goal!
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-gray-400 text-sm">No goals yet.</div>
        )}

        <a href="/goals" className="text-red-500 text-sm mt-2 block">
          View all goals →
        </a>
      </div>

      {/* MOTIVATION */}
      <div className="mb-20">
        <h3 className="text-lg font-semibold text-red-400 mb-3">Motivation</h3>
        <div className="p-5 bg-neutral-900/60 border border-neutral-700 rounded-xl shadow-md italic text-neutral-300">
          “Discipline beats motivation — show up, even when you don’t feel like it.”
        </div>
      </div>
    </div>
  );
}
