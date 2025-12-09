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

  // Upcoming workouts
  const [upcomingWorkout, setUpcomingWorkout] = useState(null);

  // Today’s Focus motivational quotes
  const quotes = [
    "Win the day. One rep at a time.",
    "Consistency beats talent when talent doesn’t show up.",
    "Discipline creates the freedom you want.",
    "Your future self is watching. Don’t disappoint him.",
    "Small wins stack big lifts.",
    "Strong body, strong mind, strong life.",
    "Don’t wait for motivation — build it under the bar.",
    "Every rep is a deposit.",
    "Drag. Rise. Commit.",
    "Control the hand, control the match.",
    "Tight elbow, rising wrist, unstoppable back-pressure.",
    "A stronger arm starts with a stronger mindset.",
    "Become the man your goals require.",
    "Outwork every version of yourself.",
    "Talk less. Lift more. Dominate.",
    "You’re not tired — you’re underdeveloped.",
  ];

  const focusQuote = quotes[Math.floor(Math.random() * quotes.length)];

  useEffect(() => {
    loadUserAndGoals();
    loadUpcomingWorkout();
  }, []);

  async function loadUserAndGoals() {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;

      const currentUser = data?.user || null;
      setUser(currentUser);

      // Default fallback name
      let name =
        currentUser?.user_metadata?.username ||
        (currentUser?.email ? currentUser.email.split("@")[0] : "Athlete");

      // Load profile username
      if (currentUser?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", currentUser.id)
          .single();

        if (profile?.username) name = profile.username;

        await loadGoals(currentUser.id);
      }

      setDisplayName(name);
    } catch (err) {
      console.error("Error loading user:", err.message);
      setLoadingGoals(false);
    }
  }

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

  async function loadUpcomingWorkout() {
    const { data } = await supabase
      .from("workouts")
      .select("*")
.eq("user_id", uid)
.gt("scheduled_for", new Date().toISOString())   // only future workouts
.order("scheduled_for", { ascending: true })
.limit(1);

    setUpcomingWorkout(data?.[0] || null);
  }

  function getProgress(goal) {
    const current = Number(goal.current_value) || 0;
    const target = Number(goal.target_value) || 0;
    if (!target || target <= 0) return 0;
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

    const { data: pr } = await supabase
      .from("PRs")
      .select("*")
      .eq("user_id", user.id)
      .eq("lift_name", name)
      .order("weight", { ascending: false })
      .limit(1)
      .single();

    if (!pr) {
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

  function getPercentRows() {
    if (!calculated1RM) return [];

    const percents = [
      95, 90, 85, 80, 75, 70, 65, 60,
      58, 56, 54, 52, 50, 48, 46,
    ];

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
        paddingTop: 16,
        paddingLeft: 16,
        paddingRight: 16,
        paddingBottom: 120,
        maxWidth: 900,
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

      {/* TODAY’S FOCUS */}
      <section style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
          Today’s Focus
        </h2>
        <div
          style={{
            background: "#101010",
            borderRadius: 12,
            padding: 14,
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <p style={{ margin: 0, fontSize: 14, lineHeight: "19px" }}>{focusQuote}</p>
        </div>
      </section>

      {/* GOALS SECTION */}
      <section style={{ marginBottom: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 8,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Top Goals</h2>
          <Link to="/goals" style={{ fontSize: 12, opacity: 0.8 }}>View all</Link>
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
            <p style={{ opacity: 0.7 }}>Loading goals...</p>
          ) : goals.length === 0 ? (
            <p style={{ opacity: 0.7 }}>No goals yet.</p>
          ) : (
            goals.map((goal) => {
              const progress = getProgress(goal);

              return (
                <div
                  key={goal.id}
                  style={{
                    marginBottom: 10,
                    paddingBottom: 8,
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
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
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                        {goal.title}
                      </p>
                      {goal.target_value ? (
                        <p style={{ margin: 0, fontSize: 11, opacity: 0.7 }}>
                          {goal.current_value ?? 0} / {goal.target_value}{" "}
                          {goal.unit || ""}
                        </p>
                      ) : null}
                    </div>
                    <span style={{ fontSize: 12, opacity: 0.8 }}>
                      {progress}%
                    </span>
                  </div>

                  <div
                    style={{
                      width: "100%",
                      height: 6,
                      background: "rgba(255,255,255,0.06)",
                      borderRadius: 999,
                    }}
                  >
                    <div
                      style={{
                        width: `${progress}%`,
                        height: "100%",
                        background: "linear-gradient(90deg,#ff2f2f,#ff6b4a)",
                        borderRadius: 999,
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

        {/* — KEEPING ALL YOUR PERFECT LAYOUT EXACTLY AS IT WAS — */}
        <div
          style={{
            background: "#101010",
            borderRadius: 12,
            padding: 12,
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {/* Exercise Input */}
          <label style={{ fontSize: 12, opacity: 0.9 }}>Exercise name</label>
          <input
            type="text"
            value={exerciseName}
            onChange={(e) => {
              setExerciseName(e.target.value);
              if (calculated1RM) fetchBestPR(e.target.value, calculated1RM);
            }}
            placeholder="bench press, squat, deadlift"
            style={inputBox}
          />

          {/* Weight / Reps Row */}
          <div style={calcGrid}>
            <div style={{ flex: 1 }}>
              <label style={label}>Weight (lbs)</label>
              <input
                type="number"
                value={weightInput}
                onChange={handleWeightChange}
                placeholder="225"
                style={inputBox}
              />

              <label style={label}>Reps</label>
              <input
                type="number"
                value={repsInput}
                onChange={handleRepsChange}
                placeholder="5"
                style={inputBox}
              />
            </div>

            <div style={calcCard}>
              <p style={calcLabel}>Estimated 1RM</p>
              <p style={calcNumber}>
                {calculated1RM ? `${calculated1RM} lb` : "--"}
              </p>

              {exerciseName && calculated1RM ? (
                bestPR ? (
                  <p style={calcPR}>
                    Your best: <b>{bestPR} lb</b>{" "}
                    {prDifference !== null && (
                      <span style={{ opacity: 0.7 }}>
                        ({prDifference >= 0 ? "+" : ""}
                        {prDifference})
                      </span>
                    )}
                  </p>
                ) : (
                  <p style={calcNoPR}>No PR saved yet.</p>
                )
              ) : null}

              <button
                onClick={handleSavePR}
                disabled={!exerciseName || !calculated1RM}
                style={{
                  ...saveBtn,
                  background:
                    !exerciseName || !calculated1RM ? "#444" : "#ff2f2f",
                }}
              >
                Save PR
              </button>
            </div>
          </div>

          {/* TABLES */}
          {calculated1RM ? (
            <div style={twoCol}>
              <div style={tableCard}>
                <div style={tableHeader}>
                  <span>% of 1RM</span>
                  <span style={{ textAlign: "right" }}>Weight</span>
                </div>

                {percentRows.map((row) => (
                  <div key={row.percent} style={tableRow}>
                    <span>{row.percent}%</span>
                    <span style={{ textAlign: "right" }}>{row.weight} lb</span>
                  </div>
                ))}
              </div>

              <div style={tableCard}>
                <div style={tableHeader}>
                  <span>Reps</span>
                  <span style={{ textAlign: "right" }}>Est. Weight</span>
                </div>

                {repRows.map((row) => (
                  <div key={row.reps} style={tableRow}>
                    <span>{row.reps}</span>
                    <span style={{ textAlign: "right" }}>{row.weight} lb</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 12, opacity: 0.7 }}>
              Enter weight + reps to calculate.
            </p>
          )}
        </div>
      </section>

      {/* UPCOMING WORKOUTS */}
      <section style={{ marginBottom: 22 }}>
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

          <Link to="/workouts" style={{ fontSize: 12, opacity: 0.8 }}>
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
              <p style={{ fontSize: 15, margin: 0, fontWeight: 600 }}>
                {upcomingWorkout.name}
              </p>

              <p style={{ opacity: 0.7, fontSize: 12, marginTop: 4 }}>
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

      {/* SPACING AT BOTTOM */}
      <div style={{ height: 60 }} />
    </div>
  );
}

/* --------------------------
    SHARED STYLES
--------------------------- */
const inputBox = {
  width: "100%",
  padding: "8px 10px",
  background: "#080808",
  color: "white",
  borderRadius: "8px",
  border: "1px solid rgba(255,255,255,0.15)",
  marginBottom: "10px",
  fontSize: "13px",
};

const label = {
  display: "block",
  fontSize: "12px",
  opacity: 0.9,
  marginBottom: "4px",
};

const calcGrid = {
  display: "flex",
  gap: "10px",
  alignItems: "flex-end",
  flexWrap: "wrap",
  marginBottom: "12px",
};

const calcCard = {
  flex: 1,
  minWidth: "160px",
  padding: "10px",
  background: "#0c0c0c",
  borderRadius: "8px",
  border: "1px solid rgba(255,255,255,0.12)",
};

const calcLabel = { margin: 0, fontSize: 12, opacity: 0.8 };
const calcNumber = { margin: "4px 0 6px", fontSize: 20, fontWeight: 700 };
const calcPR = { fontSize: 12, opacity: 0.8, margin: "4px 0" };
const calcNoPR = { fontSize: 12, opacity: 0.7, margin: "4px 0" };

const saveBtn = {
  width: "100%",
  marginTop: 6,
  padding: 8,
  borderRadius: 8,
  border: "none",
  color: "white",
  fontWeight: 600,
  fontSize: 13,
};

const twoCol = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "10px",
};

const tableCard = {
  borderRadius: "10px",
  border: "1px solid rgba(255,255,255,0.08)",
  overflow: "hidden",
};

const tableHeader = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  fontSize: 11,
  padding: "6px 8px",
  background: "#141414",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  fontWeight: 600,
};

const tableRow = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  padding: "6px 8px",
  fontSize: 11,
  borderBottom: "1px solid rgba(255,255,255,0.05)",
};
