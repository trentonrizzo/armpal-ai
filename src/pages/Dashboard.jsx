// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function Dashboard() {
  const [userId, setUserId] = useState(null);
  const [goals, setGoals] = useState([]);
  const [upcoming, setUpcoming] = useState([]);

  const mainGoal = goals[0] || null;

  // -------------------------
  // STRENGTH CALCULATOR STATE
  // -------------------------
  const [liftName, setLiftName] = useState("");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [oneRM, setOneRM] = useState(null);
  const [currentPR, setCurrentPR] = useState(null);

  const repMultipliers = {
    1: 1.0,
    2: 1.05,
    3: 1.08,
    4: 1.12,
    5: 1.15,
    6: 1.18,
    7: 1.20,
    8: 1.22,
    9: 1.24,
    10: 1.27,
  };

  const percentages = [
    { pct: 95, reps: 1 },
    { pct: 90, reps: 2 },
    { pct: 85, reps: 3 },
    { pct: 80, reps: 5 },
    { pct: 75, reps: 8 },
    { pct: 70, reps: 10 },
    { pct: 65, reps: 12 },
    { pct: 60, reps: 15 },
  ];

  // -------------------------
  // LOAD USER / GOALS / WORKOUT
  // -------------------------
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

  async function loadGoals(uid) {
    const { data } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", uid)
      .order("updated_at", { ascending: false })
      .limit(3);

    setGoals(data || []);
  }

  async function loadUpcoming(uid) {
    const { data, error } = await supabase
      .from("workouts")
      .select("*")
      .eq("user_id", uid)
      .not("scheduled_for", "is", null)
      .gte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(1);

    if (error) console.error("LOAD UPCOMING ERROR:", error);
    setUpcoming(data || []);
  }

  function getProgress(goal) {
    const current = goal?.current_value || 0;
    const target = goal?.target_value || 0;
    if (!target) return 0;
    return Math.min(Math.round((current / target) * 100), 999);
  }

  // -------------------------
  // LOAD CURRENT PR WHEN LIFT CHANGES
  // -------------------------
  useEffect(() => {
    async function loadPR() {
      if (!liftName) {
        setCurrentPR(null);
        return;
      }

      const { data, error } = await supabase
        .from("prs")
        .select("*")
        .eq("lift_name", liftName.toLowerCase())
        .order("weight", { ascending: false })
        .limit(1);

      if (error) {
        console.error("LOAD PR ERROR:", error);
        setCurrentPR(null);
        return;
      }

      setCurrentPR(data?.[0]?.weight ?? null);
    }

    loadPR();
  }, [liftName]);

  // -------------------------
  // CALCULATE ESTIMATED 1RM
  // -------------------------
  function calculateOneRM() {
    if (!weight || !reps) return;

    const w = Number(weight);
    const r = Number(reps);
    if (!w || !r) return;

    const multiplier = repMultipliers[r] || (1 + r * 0.03);
    const est = Math.round(w * multiplier);

    setOneRM(est);
  }

  // -------------------------
  // SAVE PR
  // -------------------------
  async function savePR() {
    if (!liftName || !oneRM) return;

    const { error } = await supabase.from("prs").insert({
      lift_name: liftName.toLowerCase(),
      weight: oneRM,
    });

    if (error) {
      console.error("SAVE PR ERROR:", error);
      return;
    }

    setCurrentPR(oneRM);
  }

  // -------------------------
  // RENDER
  // -------------------------
  return (
    <div className="text-white p-4 pb-28">
      {/* HEADER */}
      <header className="mb-6">
        <h1 className="text-3xl font-extrabold leading-tight">ArmPal</h1>
        <p className="text-sm text-gray-300">Stronger every session.</p>
      </header>

      {/* UPCOMING WORKOUT */}
      <section className="mb-5">
        <h2 className="text-lg font-semibold mb-1">Upcoming Workout</h2>
        {upcoming.length === 0 ? (
          <p className="text-gray-400 text-sm">
            No workouts yet. Create one!
          </p>
        ) : (
          upcoming.map((w) => (
            <div
              key={w.id}
              className="bg-[#111] p-3 rounded-xl border border-gray-800 mb-2"
            >
              <p className="font-medium">{w.name}</p>
              <p className="text-xs text-gray-400">
                {new Date(w.scheduled_for).toLocaleDateString()}
              </p>
            </div>
          ))
        )}
      </section>

      {/* MAIN GOAL */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-1">Main Goal</h2>

        {mainGoal ? (
          <div className="bg-[#111] p-4 rounded-xl border border-gray-800">
            <p className="font-semibold mb-1">{mainGoal.title}</p>
            <p className="text-sm text-gray-300">
              {mainGoal.current_value} / {mainGoal.target_value}
            </p>
            <p className="text-sm">{getProgress(mainGoal)}% complete</p>

            <div className="w-full bg-gray-700 h-2 rounded mt-2">
              <div
                className="bg-red-600 h-2 rounded"
                style={{ width: `${Math.min(getProgress(mainGoal), 100)}%` }}
              />
            </div>

            <button className="mt-3 text-xs text-red-400">
              View all goals →
            </button>
          </div>
        ) : (
          <p className="text-gray-400 text-sm">
            No goals yet. Add one in the Goals tab.
          </p>
        )}
      </section>

      {/* ============================= */}
      {/*      STRENGTH CALCULATOR      */}
      {/* ============================= */}
      <section className="bg-[#0d0d0d] p-5 rounded-2xl border border-red-900/40 shadow-[0_0_25px_rgba(255,0,0,0.15)] mb-6">
        <h2 className="text-lg font-semibold text-red-400 mb-3">
          STRENGTH CALCULATOR
        </h2>

        {/* Lift Name */}
        <label className="block text-sm text-gray-300 mb-1">Lift Name</label>
        <input
          type="text"
          placeholder="bench, squat, deadlift..."
          value={liftName}
          onChange={(e) => setLiftName(e.target.value)}
          className="w-full p-3 mb-3 bg-black border border-red-800/40 rounded-lg focus:border-red-600 transition"
        />

        {/* Weight + Reps on SAME ROW */}
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-sm text-gray-300 mb-1">Weight</label>
            <input
              type="number"
              placeholder="lbs"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full p-3 bg-black border border-red-800/40 rounded-lg"
            />
          </div>

          <div className="w-24">
            <label className="block text-sm text-gray-300 mb-1">Reps</label>
            <input
              type="number"
              placeholder="#"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              className="w-full p-3 bg-black border border-red-800/40 rounded-lg"
            />
          </div>
        </div>

        {/* Button */}
        <button
          onClick={calculateOneRM}
          className="w-full mt-1 py-3 rounded-lg font-bold bg-red-600 hover:bg-red-700 tracking-wide shadow-[0_0_15px_rgba(255,0,0,0.35)] transition"
        >
          Calculate 1RM
        </button>
      </section>

      {/* ESTIMATED 1RM + PR COMPARISON */}
      {oneRM && (
        <section className="bg-[#0d0d0d] p-5 rounded-2xl border border-red-900/40 shadow-[0_0_25px_rgba(255,0,0,0.15)] mb-6">
          <h3 className="text-xl font-bold text-red-400 mb-1">
            Estimated 1RM
          </h3>
          <p className="text-3xl font-extrabold text-white mb-2">
            {oneRM} lbs
          </p>

          <div className="w-full h-[2px] bg-red-700 mb-3" />

          {/* PR COMPARISON – always show something */}
          <div className="mb-3 text-sm">
            <p className="text-gray-400">PR Comparison</p>
            {currentPR !== null ? (
              <>
                <p>Current PR: {currentPR} lbs</p>
                <p>Your 1RM: {oneRM} lbs</p>
                <p className="mt-1">
                  Difference:{" "}
                  <span className="font-semibold text-red-400">
                    {oneRM - currentPR} lbs
                  </span>
                </p>
                {oneRM > currentPR && (
                  <p className="text-red-400 font-bold mt-1">
                    🔥 NEW PR POSSIBLE
                  </p>
                )}
              </>
            ) : (
              <p className="text-gray-300">
                No PR saved yet for this lift.
              </p>
            )}
          </div>

          {/* Save button – always available when 1RM exists */}
          <button
            onClick={savePR}
            className="w-full py-2 mt-2 bg-red-700 rounded-lg hover:bg-red-800 font-semibold"
          >
            Save as PR
          </button>
        </section>
      )}

      {/* PERCENTAGES: LEFT = % + weight, RIGHT = reps + weight */}
      {oneRM && (
        <section className="bg-[#0d0d0d] p-5 rounded-2xl border border-red-900/40 shadow-[0_0_25px_rgba(255,0,0,0.15)]">
          <h3 className="text-xl font-bold mb-4">Percentages</h3>

          <div className="space-y-2 text-sm">
            {percentages.map((row) => {
              const pctWeight = Math.round(oneRM * (row.pct / 100));
              const repsWeight = Math.round(
                oneRM / (repMultipliers[row.reps] || 1)
              );

              return (
                <div
                  key={row.pct}
                  className="flex items-center justify-between"
                >
                  {/* LEFT: 95% — 299 lbs */}
                  <span>
                    {row.pct}% — {pctWeight} lbs
                  </span>

                  {/* RIGHT: 1 rep — 315 lbs */}
                  <span className="text-gray-300">
                    {row.reps} reps —{" "}
                    <span className="text-red-400 font-semibold">
                      {repsWeight} lbs
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
