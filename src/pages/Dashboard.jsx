// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Link, useNavigate } from "react-router-dom";

// Programs
import ProgramsLauncher from "../components/programs/ProgramsLauncher";

// NEW FRIENDS ICON
import { FiUsers } from "react-icons/fi";

// SMART ANALYTICS (READ-ONLY)
import SmartAnalytics from "../components/SmartAnalytics";

// AI SECTION (keep if you still use it visually)
import DashboardAISection from "../components/ai/DashboardAISection";

// ✅ AI CHAT (from api folder)
import DashboardAIChat from "../components/ai/DashboardAIChat";
import AIChatButtonOverlay from "../components/ai/AIChatButtonOverlay";


export default function Dashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [displayName, setDisplayName] = useState("Athlete");
  const [goals, setGoals] = useState([]);
  const [loadingGoals, setLoadingGoals] = useState(true);

  // ✅ AI Chat State (ONLY ONCE)
  const [showAIChat, setShowAIChat] = useState(false);

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

  // FIXED UPCOMING WORKOUT — ONLY FUTURE TIMES COUNT
  async function loadUpcomingWorkout(uid) {
    const { data, error } = await supabase
      .from("workouts")
      .select("*")
      .eq("user_id", uid)
      .not("scheduled_for", "is", null);

    if (error || !data) return setUpcomingWorkout(null);

    const now = new Date();

    const futureWorkouts = data
      .filter((w) => new Date(w.scheduled_for) > now)
      .sort(
        (a, b) =>
          new Date(a.scheduled_for).getTime() -
          new Date(b.scheduled_for).getTime()
      );

    setUpcomingWorkout(futureWorkouts[0] || null);
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

    const est = r === 1 ? Math.round(w) : Math.round(w * (1 + r / 30));
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
      .maybeSingle();

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

  // Table data (15 rows)
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
      {/* HEADER WITH FRIENDS ICON */}
      <header
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <p style={{ fontSize: 14, opacity: 0.8, margin: 0 }}>Welcome back,</p>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: "2px 0 0" }}>
            {displayName}
          </h1>
          <p style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
            Track your progress. Crush your PRs. Stay locked in.
          </p>
      {showAIChat && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--bg)' }}>
          <DashboardAIChat onClose={() => setShowAIChat(false)} />
        </div>
      )}
        </div>

        {/* FRIENDS PAGE BUTTON */}
        <Link
          to="/friends"
          style={{
            background: "var(--card-2)",
            borderRadius: "10px",
            padding: "8px",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 36,
            width: 36,
          }}
        >
          <FiUsers size={18} color="var(--text)" />
        </Link>
      </header>

      {/* Today's Focus */}
      <DashboardAISection />

      {/* AI CHAT (PREMIUM ONLY) */}
<section style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          Today’s Focus
        </h2>
        <div
          style={{
            background: "var(--card-2)",
            borderRadius: 12,
            padding: 12,
            border: "1px solid var(--border)",
            fontSize: 14,
          }}
        >
          Don’t wait for motivation — build it under the bar.
        </div>
      </section>

      {/* SMART ANALYTICS (READ-ONLY) — CLICKABLE TO FULL PAGE */}
      <ProgramsLauncher pillStyle={{ marginBottom: 12 }} />
      <div
        role="button"
        tabIndex={0}
        onClick={() => navigate("/analytics")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") navigate("/analytics");
        }}
        style={{ cursor: "pointer" }}
      >
        <SmartAnalytics />
      </div>

      {/* GOALS */}
      {/* REMOVED — goals belong in /analytics and /goals */}

      {/* STRENGTH CALCULATOR */}
      <section style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          Strength Calculator
        </h2>

        <div
          style={{
            background: "var(--card)",
            borderRadius: 12,
            padding: 12,
            border: "1px solid var(--border)",
          }}
        >
          {/* Exercise input */}
          <label style={label}>Exercise name</label>
          <input
            type="text"
            value={exerciseName}
            onChange={(e) => {
              setExerciseName(e.target.value);
              if (calculated1RM) fetchBestPR(e.target.value, calculated1RM);
            }}
            placeholder="bench press, squat, deadlift"
            style={input}
          />

          {/* two column layout */}
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              flexWrap: "wrap",
              marginTop: 10,
            }}
          >
            {/* LEFT — weight + reps */}
            <div style={{ flex: 1, minWidth: "140px" }}>
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

            {/* RIGHT — 1RM card */}
            <div
              style={{
                flex: 1,
                minWidth: "160px",
                padding: 10,
                background: "var(--card-2)",
                borderRadius: 8,
                border: "1px solid var(--border)",
              }}
            >
              <p style={{ fontSize: 12, opacity: 0.8, margin: 0 }}>
                Estimated 1RM
              </p>

              <p
                style={{
                  margin: "4px 0 6px",
                  fontSize: 20,
                  fontWeight: 700,
                }}
              >
                {calculated1RM ? `${calculated1RM} lb` : "--"}
              </p>

              {/* PR Comparison */}
              {exerciseName && calculated1RM ? (
                bestPR ? (
                  <p style={{ fontSize: 12, opacity: 0.8, margin: "4px 0" }}>
                    Your best: <b>{bestPR} lb</b>{" "}
                    {prDifference !== null ? (
                      <span style={{ opacity: 0.7 }}>
                        ({prDifference >= 0 ? "+" : ""}
                        {prDifference})
                      </span>
                    ) : null}
                  </p>
                ) : (
                  <p style={{ fontSize: 12, opacity: 0.7, margin: "4px 0" }}>
                    No PR saved yet for this exercise.
                  </p>
                )
              ) : null}

              {/* Save PR button */}
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
                    !exerciseName || !calculated1RM ? "color-mix(in srgb, var(--text) 20%, transparent)" : "var(--accent)",
                  color: "var(--text)",
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

          {/* 15×15 TABLES */}
          {calculated1RM ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
                marginTop: 14,
              }}
            >
              {/* Percent Table */}
              <div
                style={{
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    padding: "6px 8px",
                    background: "var(--card-2)",
                    fontWeight: 600,
                    fontSize: 11,
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <span>% of 1RM</span>
                  <span style={{ textAlign: "right" }}>Weight</span>
                </div>

                {percentRows.map((row) => (
                  <div
                    key={row.percent}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      padding: "6px 8px",
                      fontSize: 11,
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <span>{row.percent}%</span>
                    <span style={{ textAlign: "right" }}>{row.weight} lb</span>
                  </div>
                ))}
              </div>

              {/* Rep Table */}
              <div
                style={{
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    padding: "6px 8px",
                    background: "var(--card-2)",
                    fontWeight: 600,
                    fontSize: 11,
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <span>Reps</span>
                  <span style={{ textAlign: "right" }}>Est. Weight</span>
                </div>

                {repRows.map((row) => (
                  <div
                    key={row.reps}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      padding: "6px 8px",
                      fontSize: 11,
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <span>{row.reps}</span>
                    <span style={{ textAlign: "right" }}>{row.weight} lb</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
              Enter weight and reps to calculate 1RM and full tables.
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
          <Link to="/workouts" style={{ fontSize: 12, opacity: 0.8 }}>
            Open workouts
          </Link>
        </div>

        <div
          style={{
            background: "var(--card)",
            borderRadius: 12,
            padding: 12,
            border: "1px solid var(--border)",
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

      {/* ✅ AI CHAT BUTTON */}
      <AIChatButtonOverlay onOpen={() => setShowAIChat(true)} />

      {/* ✅ AI CHAT OVERLAY */}
      {showAIChat && (
        <DashboardAIChat onClose={() => setShowAIChat(false)} />
      )}

    </div>
  );
}

/* ----------------------- */
const input = {
  width: "100%",
  padding: "8px 10px",
  background: "var(--card-2)",
  color: "var(--text)",
  borderRadius: 8,
  border: "1px solid var(--border)",
  marginBottom: 8,
  fontSize: 13,
};

const label = {
  display: "block",
  fontSize: 12,
  opacity: 0.9,
  marginBottom: 4,
};
