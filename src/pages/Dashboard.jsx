import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { motion } from "framer-motion";

export default function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [lastWorkout, setLastWorkout] = useState(null);
  const [prsCount, setPrsCount] = useState(0);
  const [workoutCount, setWorkoutCount] = useState(0);
  const [goals, setGoals] = useState([]);

  useEffect(() => {
    loadProfile();
    loadStats();
    loadLastWorkout();
    loadGoals();
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

      {/* Glow gradient */}
      <div className="fixed top-0 left-0 right-0 h-60 bg-red-700/25 blur-3xl opacity-50 pointer-events-none"></div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <div className="text-sm text-neutral-400 tracking-wide">
            Welcome back,
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {username}
          </div>
        </div>

        <img
          src={avatar}
          className="w-14 h-14 rounded-xl border border-red-600/60 shadow-md object-cover"
        />
      </motion.div>

      {/* Stats */}
      <div className="mb-10">
        <h3 className="text-lg font-semibold text-red-500 mb-3">Your Stats</h3>

        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-[#1a0000] rounded-xl border border-red-900/40 shadow-lg text-center">
            <div className="text-2xl font-bold text-red-500">{workoutCount}</div>
            <div className="text-xs text-neutral-400 mt-1">Workouts</div>
          </div>

          <div className="p-4 bg-[#1a0000] rounded-xl border border-red-900/40 shadow-lg text-center">
            <div className="text-2xl font-bold text-red-500">{prsCount}</div>
            <div className="text-xs text-neutral-400 mt-1">PRs</div>
          </div>

          <div className="p-4 bg-[#1a0000] rounded-xl border border-red-900/40 shadow-lg text-center">
            <div className="text-2xl font-bold text-red-500">
              {profile?.bio ? profile.bio.length : 0}
            </div>
            <div className="text-xs text-neutral-400 mt-1">Bio</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-10">
        <h3 className="text-lg font-semibold text-red-500 mb-3">Actions</h3>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div
            onClick={() => (window.location.href = "/workoutlogger")}
            className="py-3 bg-red-700/20 border border-red-700/40 rounded-xl text-sm text-red-400 font-semibold hover:bg-red-700/30 transition active:scale-95"
          >
            Log<br/>Workout
          </div>

          <div
            onClick={() => (window.location.href = "/prs")}
            className="py-3 bg-[#111] border border-neutral-700 rounded-xl text-sm text-neutral-300 font-semibold hover:bg-[#181818] transition active:scale-95"
          >
            Add<br/>PR
          </div>

          <div
            onClick={() => (window.location.href = "/measurements")}
            className="py-3 bg-[#111] border border-neutral-700 rounded-xl text-sm text-neutral-300 font-semibold hover:bg-[#181818] transition active:scale-95"
          >
            Add<br/>Measure
          </div>
        </div>
      </div>

      {/* Last Workout */}
      {lastWorkout && (
        <div className="mb-10">
          <h3 className="text-lg font-semibold text-red-500 mb-3">Last Workout</h3>

          <div className="p-5 bg-[#1a0000] rounded-xl border border-red-900/40 shadow-lg">
            <div className="text-lg font-bold text-red-400 mb-2">
              {new Date(lastWorkout.created_at).toLocaleDateString()}
            </div>
            <div className="text-neutral-300 text-sm">
              {lastWorkout.notes || "No notes added."}
            </div>
          </div>
        </div>
      )}

      {/* Goals */}
      <div className="mb-10">
        <h3 className="text-lg font-semibold text-red-500 mb-3">Goals</h3>

        {goals.length > 0 ? (
          goals.slice(0, 2).map((g) => {
            const percent = (g.current / g.target) * 100;
            const capped = Math.min(percent, 100);

            return (
              <div
                key={g.id}
                className="p-4 mb-3 bg-[#1a0000] border border-red-900/40 rounded-xl"
              >
                <div className="flex justify-between mb-1">
                  <span className="font-bold">{g.title}</span>
                  <span className="text-red-500">{percent.toFixed(1)}%</span>
                </div>

                <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-600 transition-all"
                    style={{ width: `${capped}%` }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-neutral-400 text-sm">No goals yet.</div>
        )}

        <a href="/goals" className="text-red-500 text-sm mt-2 block">
          View all goals →
        </a>
      </div>

      {/* Motivation */}
      <div className="mb-20">
        <h3 className="text-lg font-semibold text-red-500 mb-3">Motivation</h3>
        <div className="p-5 bg-[#111] border border-neutral-700 rounded-xl shadow-md italic text-neutral-300">
          “Work beats talent — every damn time.”
        </div>
      </div>

    </div>
  );
}
