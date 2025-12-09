// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [displayName, setDisplayName] = useState("Athlete");
  const [goals, setGoals] = useState([]);
  const [loadingGoals, setLoadingGoals] = useState(true);

  // NEXT UPCOMING WORKOUT
  const [nextWorkout, setNextWorkout] = useState(null);
  const [countdown, setCountdown] = useState("");

  // Strength Calculator State
  const [exerciseName, setExerciseName] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [repsInput, setRepsInput] = useState("");
  const [calculated1RM, setCalculated1RM] = useState(null);

  // PR comparison
  const [bestPR, setBestPR] = useState(null);
  const [prDifference, setPrDifference] = useState(null);

  useEffect(() => {
    loadUserAndGoals();
  }, []);

  async function loadUserAndGoals() {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;

      const currentUser = data?.user || null;
      setUser(currentUser);

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
        await loadNextWorkout(currentUser.id);
      }

      setDisplayName(name);
    } catch (err) {
      console.error("Error loading user:", err.message);
      setLoadingGoals(false);
    }
  }

  async function loadNextWorkout(uid) {
    const { data, error } = await supabase
      .from("workouts")
      .select("*")
      .eq("user_id", uid)
      .not("scheduled_for", "is", null)
      .order("scheduled_for", { ascending: true });

    if (error) {
      console.error("Error loading scheduled workouts:", error.message);
      return;
    }

    const now = new Date();

    // Find the FIRST workout scheduled in the future
    const upcoming = (data || []).find(
      (w) => new Date(w.scheduled_for) > now
    );

    setNextWorkout(upcoming || null);

    if (upcoming) {
      updateCountdown(upcoming.scheduled_for);

      // Update countdown every minute
      const interval = setInterval(() => {
        updateCountdown(upcoming.scheduled_for);
      }, 60000);

      return () => clearInterval(interval);
    }
  }

  // Countdown logic
  function updateCountdown(dateString) {
    const now = new Date();
    const target = new Date(dateString);
    const diffMs = target - now;

    if (diffMs <= 0) {
      setCountdown("Starting now!");
      return;
    }

    const minutes = Math.floor(diffMs / 1000 / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    const remHours = hours % 24;
    const remMinutes = minutes % 60;

    let text = "";

    if (days > 0) text += `${days}d `;
    if (hours > 0) text += `${remHours}h `;
    if (remMinutes >= 0) text += `${remMinutes}m`;

    setCountdown(text.trim());
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

    if (error) {
      console.error("Error saving PR:", error.message);
      return;
    }

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

      {/* TOP GOALS */}
      <section style={{ marginBottom: "18px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "8px",
          }}
        >
          <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>
            Top Goals
          </h2>
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
            <p style={{ fontSize: "13px", opacity: 0.7, margin: 0 }}>
              Loading goals...
            </p>
          ) : goals.length === 0 ? (
            <p style={{ fontSize: "13px", opacity: 0.7, margin: 0 }}>
              No goals yet. Add some to start tracking your progress.
            </p>
          ) : (
            goals.map((goal) => {
              const progress = getProgress(goal);

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
                      <p
                        style={{
                          margin: 0,
                          fontSize: "14px",
                          fontWeight: 600,
                        }}
                      >
                        {goal.title}
                      </p>
                      {goal.target_value ? (
                        <p style={{ margin: 0, fontSize: "11px", opacity: 0.7 }}>
                          {goal.current_value ?? 0} / {goal.target_value}{" "}
                          {goal.unit || ""}
                        </p>
                      ) : null}
                    </div>
                    <span style={{ fontSize: "12px", opacity: 0.8 }}>
                      {progress}%
                    </span>
                  </div>

                  <div
                    style={{
                      width: "100%",
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
                        borderRadius: "999px",
                        transition: "width 0.2s ease-out",
                      }}
                    ></div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* UPCOMING WORKOUT */}
      <section style={{ marginBottom: "18px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "8px",
          }}
        >
          <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>
            Upcoming Workout
          </h2>
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
          {!nextWorkout ? (
            <>
              <p style={{ fontSize: "13px", opacity: 0.8, margin: 0 }}>
                No upcoming workouts yet.
              </p>
              <p style={{ fontSize: "12px", opacity: 0.7, marginTop: "4px" }}>
                Plan your next session on the Workouts page.
              </p>
            </>
          ) : (
            <Link
              to="/workouts"
              style={{ textDecoration: "none", color: "white" }}
            >
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "15px",
                    fontWeight: 600,
                  }}
                >
                  {nextWorkout.name}
                </p>

                {/* Countdown */}
                <p
                  style={{
                    margin: "6px 0 4px",
                    fontSize: "13px",
                    opacity: 0.8,
                  }}
                >
                  Starts in:{" "}
                  <span style={{ fontWeight: 600, opacity: 1 }}>
                    {countdown}
                  </span>
                </p>

                <p style={{ fontSize: "12px", opacity: 0.7, margin: 0 }}>
                  {new Date(nextWorkout.scheduled_for).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </Link>
          )}
        </div>
      </section>

      {/* (Your Strength Calculator — unchanged) */}

      {/* QUICK LINKS */}
      <section style={{ marginBottom: "8px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "8px",
          }}
        >
          <Link
            to="/pr-tracker"
            style={{
              textDecoration: "none",
              background: "#101010",
              borderRadius: "10px",
              padding: "10px",
              border: "1px solid rgba(255,255,255,0.06)",
              fontSize: "12px",
              textAlign: "center",
            }}
          >
            PRs
          </Link>

          <Link
            to="/measurements"
            style={{
              textDecoration: "none",
              background: "#101010",
              borderRadius: "10px",
              padding: "10px",
              border: "1px solid rgba(255,255,255,0.06)",
              fontSize: "12px",
              textAlign: "center",
            }}
          >
            Measurements
          </Link>

          <Link
            to="/profile"
            style={{
              textDecoration: "none",
              background: "#101010",
              borderRadius: "10px",
              padding: "10px",
              border: "1px solid rgba(255,255,255,0.06)",
              fontSize: "12px",
              textAlign: "center",
            }}
          >
            Profile
          </Link>
        </div>
      </section>
    </div>
  );
}
