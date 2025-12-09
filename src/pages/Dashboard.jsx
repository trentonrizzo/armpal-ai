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
  const [nextWorkout, setNextWorkout] = useState(null);
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    loadUserAndGoals();
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
        await loadNextWorkout(currentUser.id);
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

  // Load next upcoming scheduled workout
  async function loadNextWorkout(uid) {
    try {
      const { data, error } = await supabase
        .from("workouts")
        .select("id, name, scheduled_for")
        .eq("user_id", uid)
        .not("scheduled_for", "is", null)
        .order("scheduled_for", { ascending: true });

      if (error) throw error;

      const now = new Date();
      const upcoming = (data || []).find((w) => {
        if (!w.scheduled_for) return false;
        const d = new Date(w.scheduled_for);
        return d > now;
      });

      setNextWorkout(upcoming || null);

      if (upcoming?.scheduled_for) {
        updateCountdown(upcoming.scheduled_for);
      } else {
        setCountdown("");
      }
    } catch (err) {
      console.error("Error loading workouts:", err.message);
      setNextWorkout(null);
      setCountdown("");
    }
  }

  // Recalculate countdown every minute
  useEffect(() => {
    if (!nextWorkout?.scheduled_for) return;

    function tick() {
      updateCountdown(nextWorkout.scheduled_for);
    }

    tick(); // initial
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [nextWorkout?.scheduled_for]);

  function updateCountdown(scheduledFor) {
    if (!scheduledFor) {
      setCountdown("");
      return;
    }

    const target = new Date(scheduledFor);
    const now = new Date();
    const diffMs = target - now;

    if (diffMs <= 0) {
      setCountdown("soon");
      return;
    }

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    let parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    setCountdown(parts.join(" ") || "soon");
  }

  function formatWorkoutDateTime(value) {
    if (!value) return "";
    const d = new Date(value);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
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
      setBestPR(null);
      setPrDifference(null);
      return;
    }

    // Epley formula
    const est = Math.round(w * (1 + r / 30));
    setCalculated1RM(est);

    // Fetch updated PR comparison
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

    if (error) {
      console.error("Error saving PR:", error.message);
      return;
    }

    // Refresh PR comparison
    fetchBestPR(exerciseName, calculated1RM);
  }

  function getPercentRows() {
    if (!calculated1RM) return [];

    const percents = [
      95, 90, 85, 80, 75, 70, 65, 60, 58, 56, 54, 52, 50, 48, 46,
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
        <p style={{ fontSize: "14px", opacity: 0.8, margin: 0 }}>
          Welcome back,
        </p>
        <h1
          style={{
            fontSize: "24px",
            fontWeight: 700,
            margin: "2px 0 0",
          }}
        >
          {displayName}
        </h1>
        <p
          style={{
            fontSize: "13px",
            opacity: 0.7,
            marginTop: "4px",
          }}
        >
          Track your progress. Crush your PRs. Stay locked in.
        </p>
      </header>

      {/* GOALS SECTION */}
      <section style={{ marginBottom: "18px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "8px",
          }}
        >
          <h2
            style={{
              fontSize: "16px",
              fontWeight: 600,
              margin: 0,
            }}
          >
            Top Goals
          </h2>
          <Link
            to="/goals"
            style={{
              fontSize: "12px",
              textDecoration: "none",
              opacity: 0.8,
            }}
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
            <p
              style={{
                fontSize: "13px",
                opacity: 0.7,
                margin: 0,
              }}
            >
              Loading goals...
            </p>
          ) : goals.length === 0 ? (
            <p
              style={{
                fontSize: "13px",
                opacity: 0.7,
                margin: 0,
              }}
            >
              No goals yet. Add some to start tracking your progress.
            </p>
          ) : (
            goals.map((goal, index) => {
              const progress = getProgress(goal);
              const isLast = index === goals.length - 1;

              return (
                <div
                  key={goal.id}
                  style={{
                    marginBottom: isLast ? 0 : "10px",
                    paddingBottom: isLast ? 0 : "8px",
                    borderBottom: isLast
                      ? "none"
                      : "1px solid rgba(255,255,255,0.06)",
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
                        <p
                          style={{
                            margin: 0,
                            fontSize: "11px",
                            opacity: 0.7,
                          }}
                        >
                          {goal.current_value ?? 0} / {goal.target_value}{" "}
                          {goal.unit || ""}
                        </p>
                      ) : null}
                    </div>
                    <span
                      style={{ fontSize: "12px", opacity: 0.8 }}
                    >
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
                        background:
                          "linear-gradient(90deg, #ff2f2f, #ff6b4a)",
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

      {/* STRENGTH CALCULATOR */}
      <section style={{ marginBottom: "18px" }}>
        <h2
          style={{
            fontSize: "16px",
            fontWeight: 600,
            marginBottom: "8px",
          }}
        >
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
          {/* Exercise input */}
          <label
            style={{
              display: "block",
              fontSize: "12px",
              opacity: 0.9,
              marginBottom: "4px",
            }}
          >
            Exercise name
          </label>
          <input
            type="text"
            value={exerciseName}
            onChange={(e) => {
              setExerciseName(e.target.value);
              if (calculated1RM)
                fetchBestPR(e.target.value, calculated1RM);
            }}
            placeholder="e.g. bench press, squat, deadlift"
            style={{
              width: "100%",
              padding: "8px 10px",
              background: "#080808",
              color: "white",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.15)",
              marginBottom: "10px",
              fontSize: "13px",
            }}
          />

          {/* two-column layout */}
          <div
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "flex-end",
              flexWrap: "wrap",
              marginBottom: "12px",
            }}
          >
            {/* Left: weight + reps */}
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  opacity: 0.9,
                  marginBottom: "4px",
                }}
              >
                Weight (lbs)
              </label>
              <input
                type="number"
                value={weightInput}
                onChange={handleWeightChange}
                placeholder="e.g. 225"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  background: "#080808",
                  color: "white",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.15)",
                  marginBottom: "6px",
                }}
              />

              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  opacity: 0.9,
                  marginBottom: "4px",
                }}
              >
                Reps
              </label>
              <input
                type="number"
                value={repsInput}
                onChange={handleRepsChange}
                placeholder="e.g. 5"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  background: "#080808",
                  color: "white",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.15)",
                }}
              />
            </div>

            {/* Right: 1RM / PR compare / save button */}
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
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  opacity: 0.8,
                }}
              >
                Estimated 1RM
              </p>

              <p
                style={{
                  margin: "4px 0 6px",
                  fontSize: "20px",
                  fontWeight: 700,
                }}
              >
                {calculated1RM ? `${calculated1RM} lb` : "--"}
              </p>

              {/* PR Comparison */}
              {exerciseName && calculated1RM ? (
                bestPR ? (
                  <p
                    style={{
                      fontSize: "12px",
                      opacity: 0.8,
                      margin: "4px 0",
                    }}
                  >
                    Your best: <b>{bestPR} lb</b>{" "}
                    {prDifference !== null ? (
                      <span style={{ opacity: 0.7 }}>
                        ({prDifference >= 0 ? "+" : ""}
                        {prDifference})
                      </span>
                    ) : null}
                  </p>
                ) : (
                  <p
                    style={{
                      fontSize: "12px",
                      opacity: 0.7,
                      margin: "4px 0",
                    }}
                  >
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
                  marginTop: "6px",
                  padding: "8px",
                  borderRadius: "8px",
                  border: "none",
                  background:
                    !exerciseName || !calculated1RM
                      ? "#444"
                      : "#ff2f2f",
                  color: "white",
                  fontWeight: 600,
                  fontSize: "13px",
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

          {/* TABLES */}
          {calculated1RM ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
              }}
            >
              {/* Percent table */}
              <div
                style={{
                  borderRadius: "10px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    fontSize: "11px",
                    padding: "6px 8px",
                    background: "#141414",
                    borderBottom:
                      "1px solid rgba(255,255,255,0.08)",
                    fontWeight: 600,
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
                      fontSize: "11px",
                      borderBottom:
                        "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <span>{row.percent}%</span>
                    <span style={{ textAlign: "right" }}>
                      {row.weight} lb
                    </span>
                  </div>
                ))}
              </div>

              {/* Rep table */}
              <div
                style={{
                  borderRadius: "10px",
                  border: "1px solid rgba(255,255,255,0.08)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    fontSize: "11px",
                    padding: "6px 8px",
                    background: "#141414",
                    borderBottom:
                      "1px solid rgba(255,255,255,0.08)",
                    fontWeight: 600,
                  }}
                >
                  <span>Reps</span>
                  <span style={{ textAlign: "right" }}>
                    Est. Weight
                  </span>
                </div>

                {repRows.map((row) => (
                  <div
                    key={row.reps}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      padding: "6px 8px",
                      fontSize: "11px",
                      borderBottom:
                        "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <span>{row.reps}</span>
                    <span style={{ textAlign: "right" }}>
                      {row.weight} lb
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: "12px", opacity: 0.7 }}>
              Enter weight and reps to calculate 1RM and detailed
              breakdown.
            </p>
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
          <h2
            style={{
              fontSize: "16px",
              fontWeight: 600,
              margin: 0,
            }}
          >
            Upcoming Workout
          </h2>
          <Link
            to="/workouts"
            style={{
              fontSize: "12px",
              textDecoration: "none",
              opacity: 0.8,
            }}
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
          {nextWorkout ? (
            <>
              <p
                style={{
                  fontSize: "15px",
                  fontWeight: 600,
                  margin: 0,
                  marginBottom: "4px",
                }}
              >
                {nextWorkout.name || "Workout"}
              </p>
              <p
                style={{
                  fontSize: "13px",
                  opacity: 0.85,
                  margin: 0,
                  marginBottom: "4px",
                }}
              >
                Starts in:{" "}
                <b>{countdown || "soon"}</b>
              </p>
              <p
                style={{
                  fontSize: "12px",
                  opacity: 0.75,
                  margin: 0,
                  marginTop: "2px",
                }}
              >
                {formatWorkoutDateTime(nextWorkout.scheduled_for)}
              </p>
            </>
          ) : (
            <>
              <p
                style={{
                  fontSize: "13px",
                  opacity: 0.8,
                  margin: 0,
                }}
              >
                No upcoming workouts yet.
              </p>
              <p
                style={{
                  fontSize: "12px",
                  opacity: 0.7,
                  marginTop: "4px",
                }}
              >
                Plan your next session on the Workouts page.
              </p>
            </>
          )}
        </div>
      </section>

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
