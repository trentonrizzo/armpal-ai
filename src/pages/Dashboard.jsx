// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [displayName, setDisplayName] = useState("Athlete");
  const [goals, setGoals] = useState([]);
  const [loadingGoals, setLoadingGoals] = useState(true);

  // Strength Calculator
  const [exerciseName, setExerciseName] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [repsInput, setRepsInput] = useState("");
  const [calculated1RM, setCalculated1RM] = useState(null);

  const [bestPR, setBestPR] = useState(null);
  const [prDifference, setPrDifference] = useState(null);

  // Upcoming workouts
  const [upcomingWorkout, setUpcomingWorkout] = useState(null);

  useEffect(() => {
    loadUserData();
  }, []);

  async function loadUserData() {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;

      const currentUser = data?.user || null;
      setUser(currentUser);

      let name =
        currentUser?.user_metadata?.username ||
        (currentUser?.email ? currentUser.email.split("@")[0] : "Athlete");

      if (currentUser?.id) {
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
    } catch (err) {
      console.error("Error loading user:", err.message);
    }
  }

  // Load goals
  async function loadGoals(uid) {
    try {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", uid)
        .order("updated_at", { ascending: false })
        .limit(3);

      if (error) throw error;

      setGoals(data || []);
    } catch (err) {
      console.error("Error loading goals:", err.message);
    } finally {
      setLoadingGoals(false);
    }
  }

  // Load only *future* workouts using LOCAL timezone
  async function loadUpcomingWorkout(uid) {
    try {
      const nowLocal = new Date();
      const nowIsoLocal = nowLocal.toISOString();

      const { data, error } = await supabase
        .from("workouts")
        .select("*")
        .eq("user_id", uid)
        .gt("scheduled_for", nowIsoLocal) // ← ONLY future times
        .order("scheduled_for", { ascending: true })
        .limit(1);

      if (error) throw error;

      setUpcomingWorkout(data?.[0] || null);
    } catch (err) {
      console.error("Error loading upcoming workout:", err.message);
    }
  }

  // Strength Calculator Logic
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

    if (new1RM) {
      setPrDifference(new1RM - pr.weight);
    }
  }

  async function handleSavePR() {
    if (!user?.id || !exerciseName || !calculated1RM) return;

    const today = new Date().toISOString().split("T")[0];

    const { error } = await supabase.from("PRs").insert({
      user_id: user.id,
      lift_name: exerciseName,
      weight: calculated1RM,
      reps: 1,
      unit: "lb",
      date: today,
      notes: "",
      order_index: 0,
    });

    if (!error) fetchBestPR(exerciseName, calculated1RM);
  }

  function getPercentRows() {
    if (!calculated1RM) return [];
    const percents = [95, 90, 85, 80, 75, 70, 65, 60, 58, 56, 54, 52, 50, 48, 46];
    return percents.map((p) => ({
      percent: p,
      weight: Math.round(calculated1RM * (p / 100)),
    }));
  }

  function getRepRows() {
    if (!calculated1RM) return [];
    const repsList = Array.from({ length: 15 }, (_, i) => i + 1);
    return repsList.map((r) => ({
      reps: r,
      weight: Math.round(calculated1RM / (1 + r / 30)),
    }));
  }

  const percentRows = getPercentRows();
  const repRows = getRepRows();
  return (
    <div
      className="dashboard-page"
      style={{
        paddingTop: "16px",
        paddingLeft: "16px",
        paddingRight: "16px",
        paddingBottom: "90px",
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      {/* HEADER */}
      <header style={{ marginBottom: "16px" }}>
        <p style={{ fontSize: "14px", opacity: 0.8, margin: 0 }}>Welcome back,</p>
        <h1 style={{ fontSize: "24px", fontWeight: 700, margin: "2px 0 0" }}>
          {displayName}
        </h1>
        <p style={{ fontSize: "13px", opacity: 0.7, marginTop: "4px" }}>
          Track your progress. Crush your PRs. Stay locked in.
        </p>
      </header>

      {/* TODAY'S FOCUS */}
      <section style={{ marginBottom: "18px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
          Today’s Focus
        </h2>

        <div
          style={{
            background: "#101010",
            borderRadius: "12px",
            padding: "12px",
            border: "1px solid rgba(255,255,255,0.06)",
            fontSize: "14px",
          }}
        >
          Don’t wait for motivation — build it under the bar.
        </div>
      </section>

      {/* GOALS */}
      <section style={{ marginBottom: "18px" }}>
        <div
          style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}
        >
          <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>Top Goals</h2>
          <Link
            to="/goals"
            style={{ fontSize: "12px", textDecoration: "none", opacity: 0.8 }}
          >
            View all
          </Link>
        </div>

        <div
          style={{
            background: "#101010",
            borderRadius: "12px",
            padding: "12px",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {loadingGoals ? (
            <p style={{ opacity: 0.7 }}>Loading goals...</p>
          ) : goals.length === 0 ? (
            <p style={{ opacity: 0.7 }}>No goals yet. Add some to start tracking.</p>
          ) : (
            goals.map((goal) => {
              const progress = Math.min(
                100,
                Math.round(((goal.current_value || 0) / goal.target_value) * 100)
              );

              return (
                <div
                  key={goal.id}
                  style={{
                    marginBottom: "10px",
                    paddingBottom: "8px",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "4px",
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>
                        {goal.title}
                      </p>
                      <p style={{ margin: 0, fontSize: "11px", opacity: 0.7 }}>
                        {goal.current_value ?? 0} / {goal.target_value}
                      </p>
                    </div>
                    <span style={{ fontSize: "12px", opacity: 0.8 }}>{progress}%</span>
                  </div>

                  <div
                    style={{
                      height: "6px",
                      background: "rgba(255,255,255,0.06)",
                      borderRadius: "999px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${progress}%`,
                        height: "100%",
                        background: "linear-gradient(90deg, #ff2f2f, #ff6b4a)",
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* STRENGTH CALCULATOR */}
      <section style={{ marginBottom: "18px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
          Strength Calculator
        </h2>

        <div
          style={{
            background: "#101010",
            borderRadius: "12px",
            padding: "12px",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {/* Exercise Input */}
          <label style={{ fontSize: "12px", opacity: 0.9 }}>Exercise name</label>
          <input
            type="text"
            value={exerciseName}
            onChange={(e) => {
              setExerciseName(e.target.value);
              if (calculated1RM) fetchBestPR(e.target.value, calculated1RM);
            }}
            placeholder="bench press, squat, deadlift"
            style={{
              width: "100%",
              padding: "8px 10px",
              background: "#080808",
              color: "white",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.15)",
              marginBottom: "10px",
            }}
          />

          {/* Two-column */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {/* Left */}
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: "12px", opacity: 0.9 }}>Weight (lbs)</label>
              <input
                type="number"
                value={weightInput}
                onChange={handleWeightChange}
                style={{
                  width: "100%",
                  padding: "8px",
                  background: "#080808",
                  color: "white",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.15)",
                  marginBottom: "6px",
                }}
              />

              <label style={{ fontSize: "12px", opacity: 0.9 }}>Reps</label>
              <input
                type="number"
                value={repsInput}
                onChange={handleRepsChange}
                style={{
                  width: "100%",
                  padding: "8px",
                  background: "#080808",
                  color: "white",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.15)",
                }}
              />
            </div>

            {/* Right */}
            <div
              style={{
                flex: 1,
                minWidth: "160px",
                padding: "10px",
                background: "#0c0c0c",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <p style={{ fontSize: "12px", opacity: 0.8 }}>Estimated 1RM</p>
              <p style={{ fontSize: "20px", fontWeight: 700 }}>
                {calculated1RM ? `${calculated1RM} lb` : "--"}
              </p>

              {exerciseName && calculated1RM && (
                <p style={{ fontSize: "12px", opacity: 0.7 }}>
                  Your best:{" "}
                  {bestPR !== null ? (
                    <>
                      <b>{bestPR} lb</b>{" "}
                      {prDifference !== null && (
                        <span style={{ opacity: 0.6 }}>
                          ({prDifference >= 0 ? "+" : ""}
                          {prDifference})
                        </span>
                      )}
                    </>
                  ) : (
                    "No PR yet"
                  )}
                </p>
              )}

              <button
                onClick={handleSavePR}
                disabled={!exerciseName || !calculated1RM}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "8px",
                  border: "none",
                  background: !exerciseName || !calculated1RM ? "#444" : "#ff2f2f",
                  color: "white",
                  fontWeight: 600,
                  marginTop: "6px",
                }}
              >
                Save PR
              </button>
            </div>
          </div>

          {!calculated1RM && (
            <p style={{ fontSize: "12px", opacity: 0.7, marginTop: "8px" }}>
              Enter weight + reps to calculate.
            </p>
          )}
        </div>
      </section>

      {/* UPCOMING WORKOUT */}
      <section style={{ marginBottom: "18px" }}>
        <div
          style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}
        >
          <h2 style={{ fontSize: "16px", fontWeight: 600 }}>Upcoming Workout</h2>
          <Link
            to="/workouts"
            style={{ fontSize: "12px", textDecoration: "none", opacity: 0.8 }}
          >
            Open workouts
          </Link>
        </div>

        <div
          style={{
            background: "#101010",
            borderRadius: "12px",
            padding: "12px",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {!upcomingWorkout ? (
            <>
              <p style={{ opacity: 0.8 }}>No upcoming workouts yet.</p>
              <p style={{ opacity: 0.7, fontSize: "12px" }}>
                Plan your next session on the Workouts page.
              </p>
            </>
          ) : (
            <>
              <p style={{ fontSize: "15px", fontWeight: 600, margin: 0 }}>
                {upcomingWorkout.name}
              </p>
              <p style={{ opacity: 0.7, fontSize: "13px", marginTop: "4px" }}>
                {new Date(upcomingWorkout.scheduled_for).toLocaleString()}
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}