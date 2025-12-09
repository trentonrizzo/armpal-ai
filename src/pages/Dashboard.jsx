// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [displayName, setDisplayName] = useState("Athlete");
  const [goals, setGoals] = useState([]);
  const [loadingGoals, setLoadingGoals] = useState(true);

  // Strength Calculator State
  const [exerciseName, setExerciseName] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [repsInput, setRepsInput] = useState("");
  const [calculated1RM, setCalculated1RM] = useState(null);

  // PR comparison
  const [bestPR, setBestPR] = useState(null);
  const [prDifference, setPrDifference] = useState(null);

  // Upcoming workout
  const [upcomingWorkout, setUpcomingWorkout] = useState(null);

  useEffect(() => {
    loadUserAndData();
  }, []);

  async function loadUserAndData() {
    const { data, error } = await supabase.auth.getUser();
    if (error) return;

    const currentUser = data?.user || null;
    setUser(currentUser);

    let name =
      currentUser?.user_metadata?.username ||
      (currentUser?.email ? currentUser.email.split("@")[0] : "Athlete");

    if (currentUser?.id) {
      // Load profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", currentUser.id)
        .single();
      if (profile?.username) name = profile.username;

      await loadGoals(currentUser.id);
      await loadUpcomingWorkout(currentUser.id);
    }

    setDisplayName(name);
  }

  async function loadGoals(uid) {
    const { data, error } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", uid)
      .order("updated_at", { ascending: false })
      .limit(3);

    if (!error) setGoals(data || []);
    setLoadingGoals(false);
  }

  // FIXED UPCOMING WORKOUT LOGIC — ONLY FUTURE TIMES COUNT
  async function loadUpcomingWorkout(uid) {
    const { data, error } = await supabase
      .from("workouts")
      .select("*")
      .eq("user_id", uid)
      .not("scheduled_for", "is", null);

    if (error || !data) return setUpcomingWorkout(null);

    const now = new Date();

    const futureWorkouts = data
      .filter((w) => {
        if (!w.scheduled_for) return false;
        return new Date(w.scheduled_for) > now;
      })
      .sort((a, b) => new Date(a.scheduled_for) - new Date(b.scheduled_for));

    setUpcomingWorkout(futureWorkouts[0] || null);
  }

  function getProgress(goal) {
    const current = Number(goal.current_value) || 0;
    const target = Number(goal.target_value) || 0;
    if (!target) return 0;
    const pct = Math.round((current / target) * 100);
    return Math.min(100, Math.max(0, pct));
  }

  // -----------------------
  //   STRENGTH CALCULATOR
  // -----------------------

  function updateCalculated1RM(weightVal, repsVal) {
    const w = parseFloat(weightVal);
    const r = parseInt(repsVal, 10);

    if (!w || !r || w <= 0 || r <= 0) {
      setCalculated1RM(null);
      return;
    }

    const est = Math.round(w * (1 + r / 30));
    setCalculated1RM(est);

    if (exerciseName) fetchBestPR(exerciseName, est);
  }

  function handleWeightChange(e) {
    const value = e.target.value;
    setWeightInput(value);
    updateCalculated1RM(value, repsInput);
  }

  function handleRepsChange(e) {
    const value = e.target.value;
    setRepsInput(value);
    updateCalculated1RM(weightInput, value);
  }

  async function fetchBestPR(name, new1RM = null) {
    if (!user?.id || !name) return;

    const { data: pr, error } = await supabase
      .from("PRs")
      .select("*")
      .eq("user_id", user.id)
      .eq("lift_name", name)
      .order("weight", { ascending: false })
      .limit(1)
      .single();

    if (error || !pr) {
      setBestPR(null);
      setPrDifference(null);
      return;
    }

    setBestPR(pr.weight);

    if (new1RM) setPrDifference(new1RM - pr.weight);
  }

  async function handleSavePR() {
    if (!user?.id || !exerciseName || !calculated1RM) return;

    const today = new Date().toISOString().split("T")[0];

    await supabase.from("PRs").insert({
      user_id: user.id,
      lift_name: exerciseName,
      weight: calculated1RM,
      reps: 1,
      unit: "lb",
      date: today,
      notes: "",
      order_index: 0,
    });

    fetchBestPR(exerciseName, calculated1RM);
  }

  const percentRows = calculated1RM
    ? [95, 90, 85, 80, 75, 70, 65, 60, 58, 56, 54, 52, 50, 48, 46].map((p) => ({
        percent: p,
        weight: Math.round(calculated1RM * (p / 100)),
      }))
    : [];

  const repRows = calculated1RM
    ? Array.from({ length: 15 }, (_, i) => i + 1).map((r) => ({
        reps: r,
        weight: Math.round(calculated1RM / (1 + r / 30)),
      }))
    : [];

  return (
    <div
      style={{
        padding: "16px 16px 90px",
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      {/* HEADER */}
      <header style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 14, opacity: 0.8, margin: 0 }}>Welcome back,</p>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: "2px 0 0" }}>
          {displayName}
        </h1>
        <p style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
          Track your progress. Crush your PRs. Stay locked in.
        </p>
      </header>

      {/* Today's Focus */}
      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          Today’s Focus
        </h2>
        <div
          style={{
            background: "#111",
            borderRadius: 12,
            padding: 12,
            border: "1px solid rgba(255,255,255,0.08)",
            fontSize: 14,
          }}
        >
          Don’t wait for motivation — build it under the bar.
        </div>
      </section>

      {/* GOALS */}
      <section style={{ marginBottom: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Top Goals</h2>
          <Link to="/goals" style={{ fontSize: 12, opacity: 0.8 }}>
            View all
          </Link>
        </div>

        <div
          style={{
            background: "#101010",
            borderRadius: 12,
            padding: 12,
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {loadingGoals ? (
            <p style={{ fontSize: 13, opacity: 0.7 }}>Loading goals...</p>
          ) : goals.length === 0 ? (
            <p style={{ fontSize: 13, opacity: 0.7 }}>
              No goals yet. Add some to start tracking your progress.
            </p>
          ) : (
            goals.map((goal) => {
              const progress = getProgress(goal);

              return (
                <div
                  key={goal.id}
                  style={{
                    marginBottom: 10,
                    paddingBottom: 8,
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}
                  >
                    <div>
                      <p
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          margin: 0,
                        }}
                      >
                        {goal.title}
                      </p>
                      <p style={{ fontSize: 11, opacity: 0.7, margin: 0 }}>
                        {goal.current_value} / {goal.target_value} {goal.unit}
                      </p>
                    </div>
                    <span style={{ fontSize: 12, opacity: 0.8 }}>
                      {progress}%
                    </span>
                  </div>

                  <div
                    style={{
                      height: 6,
                      background: "rgba(255,255,255,0.06)",
                      borderRadius: 999,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${progress}%`,
                        height: "100%",
                        background: "linear-gradient(90deg, #ff2f2f, #ff6b4a)",
                        transition: "width 0.25s ease",
                      }}
                    ></div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* STRENGTH CALCULATOR */}
      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          Strength Calculator
        </h2>

        <div
          style={{
            background: "#101010",
            borderRadius: 12,
            padding: 12,
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <label style={{ fontSize: 12, opacity: 0.9 }}>Exercise name</label>
          <input
            type="text"
            value={exerciseName}
            onChange={(e) => {
              setExerciseName(e.target.value);
              if (calculated1RM)
                fetchBestPR(e.target.value, calculated1RM);
            }}
            placeholder="bench press, squat, deadlift"
            style={input}
          />

          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={label}>Weight (lbs)</label>
              <input
                type="number"
                value={weightInput}
                onChange={handleWeightChange}
                placeholder="225"
                style={input}
              />

              <label style={label}>Reps</label>
              <input
                type="number"
                value={repsInput}
                onChange={handleRepsChange}
                placeholder="5"
                style={input}
              />
            </div>

            <div
              style={{
                flex: 1,
                background: "#0c0c0c",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.12)",
                padding: 10,
              }}
            >
              <p style={{ fontSize: 12, opacity: 0.8 }}>Estimated 1RM</p>
              <p style={{ fontSize: 20, fontWeight: 700 }}>
                {calculated1RM ? `${calculated1RM} lb` : "--"}
              </p>

              {exerciseName && bestPR ? (
                <p style={{ fontSize: 12, opacity: 0.8 }}>
                  Your best: <b>{bestPR} lb</b>{" "}
                  {prDifference !== null &&
                    `(${prDifference >= 0 ? "+" : ""}${prDifference})`}
                </p>
              ) : null}

              <button
                onClick={handleSavePR}
                disabled={!exerciseName || !calculated1RM}
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: 8,
                  borderRadius: 8,
                  border: "none",
                  background:
                    !exerciseName || !calculated1RM
                      ? "#444"
                      : "#ff2f2f",
                  color: "white",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor:
                    !exerciseName || !calculated1RM
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                Save PR
              </button>
            </div>
          </div>

          {!calculated1RM && (
            <p style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
              Enter weight + reps to calculate.
            </p>
          )}
        </div>
      </section>

      {/* UPCOMING WORKOUT */}
      <section style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
            Upcoming Workout
          </h2>
          <Link
            to="/workouts"
            style={{ fontSize: 12, opacity: 0.8 }}
          >
            Open workouts
          </Link>
        </div>

        <div
          style={{
            background: "#101010",
            borderRadius: 12,
            padding: 12,
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {upcomingWorkout ? (
            <>
              <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
                {upcomingWorkout.name}
              </p>

              <p style={{ opacity: 0.8, fontSize: 13, marginTop: 4 }}>
                {new Date(upcomingWorkout.scheduled_for).toLocaleString()}
              </p>
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, opacity: 0.8, margin: 0 }}>
                No upcoming workouts yet.
              </p>
              <p style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                Plan your next session on the Workouts page.
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

/* ----------------------- */
const input = {
  width: "100%",
  padding: "8px 10px",
  background: "#080808",
  color: "white",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.15)",
  marginBottom: 8,
  fontSize: 13,
};

const label = {
  display: "block",
  fontSize: 12,
  opacity: 0.9,
  marginBottom: 4,
};
