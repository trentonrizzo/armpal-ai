// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [goals, setGoals] = useState([]);
  const [loadingGoals, setLoadingGoals] = useState(true);

  // Strength Calculator State
  const [oneRepMaxInput, setOneRepMaxInput] = useState("");
  const [estimated1RM, setEstimated1RM] = useState(null);

  useEffect(() => {
    loadUserAndGoals();
  }, []);

  async function loadUserAndGoals() {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;

      const currentUser = data?.user || null;
      setUser(currentUser);

      if (currentUser?.id) {
        await loadGoals(currentUser.id);
      } else {
        setLoadingGoals(false);
      }
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

  function getProgress(goal) {
    const current = Number(goal.current_value) || 0;
    const target = Number(goal.target_value) || 0;
    if (!target || target <= 0) return 0;

    const pct = Math.round((current / target) * 100);
    if (pct < 0) return 0;
    if (pct > 100) return 100;
    return pct;
  }

  function handleOneRepMaxChange(e) {
    const value = e.target.value;
    setOneRepMaxInput(value);

    const numeric = parseFloat(value);
    if (isNaN(numeric) || numeric <= 0) {
      setEstimated1RM(null);
    } else {
      setEstimated1RM(numeric);
    }
  }

  function getStrengthRows() {
    if (!estimated1RM) return [];

    const percents = [95, 90, 85, 80, 75, 70, 65, 60];
    const repsByPercent = {
      95: 2,
      90: 3,
      85: 5,
      80: 8,
      75: 10,
      70: 12,
      65: 15,
      60: 20,
    };

    return percents.map((p) => {
      const weight = Math.round(estimated1RM * (p / 100));
      const reps = repsByPercent[p] || "";
      return {
        percent: p,
        weight,
        reps,
      };
    });
  }

  const strengthRows = getStrengthRows();

  const username =
    user?.user_metadata?.username ||
    (user?.email ? user.email.split("@")[0] : "Athlete");

  return (
    <div
      className="dashboard-page"
      style={{
        paddingTop: "16px",
        paddingLeft: "16px",
        paddingRight: "16px",
        paddingBottom: "90px", // safe for BottomNav
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <header style={{ marginBottom: "16px" }}>
        <p
          style={{
            fontSize: "14px",
            opacity: 0.8,
            margin: 0,
          }}
        >
          Welcome back,
        </p>
        <h1
          style={{
            fontSize: "24px",
            fontWeight: 700,
            margin: "2px 0 0",
          }}
        >
          {username}
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

      {/* Goals Section */}
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
                        {goal.title || "Goal"}
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

      {/* Strength Calculator */}
      <section style={{ marginBottom: "18px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "8px",
          }}
        >
          <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>
            Strength Calculator
          </h2>

          <Link
            to="/strength-calculator"
            style={{
              fontSize: "12px",
              textDecoration: "none",
              opacity: 0.8,
            }}
          >
            Full view
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
          <label
            style={{
              display: "block",
              fontSize: "12px",
              marginBottom: "6px",
              opacity: 0.9,
            }}
          >
            Estimated 1RM (lbs)
          </label>

          <input
            type="number"
            value={oneRepMaxInput}
            onChange={handleOneRepMaxChange}
            placeholder="Enter your 1 rep max"
            style={{
              width: "100%",
              padding: "8px 10px",
              background: "#080808",
              color: "white",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.15)",
              marginBottom: "12px",
            }}
          />

          {estimated1RM && strengthRows.length > 0 ? (
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
                  gridTemplateColumns: "1fr 1fr 1fr",
                  fontSize: "11px",
                  padding: "6px 8px",
                  background: "#141414",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  fontWeight: 600,
                }}
              >
                <span>% of 1RM</span>
                <span style={{ textAlign: "center" }}>Weight</span>
                <span style={{ textAlign: "right" }}>Reps</span>
              </div>

              {strengthRows.map((row) => (
                <div
                  key={row.percent}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    padding: "6px 8px",
                    fontSize: "11px",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <span>{row.percent}%</span>
                  <span style={{ textAlign: "center" }}>
                    {row.weight} lb
                  </span>
                  <span style={{ textAlign: "right" }}>
                    {row.reps || "-"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: "12px", opacity: 0.7, margin: 0 }}>
              Enter a 1RM to calculate your working weights.
            </p>
          )}
        </div>
      </section>

      {/* Upcoming Workouts */}
      <section style={{ marginBottom: "18px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "8px",
          }}
        >
          <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>
            Upcoming Workouts
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
          <p style={{ fontSize: "13px", opacity: 0.8, margin: 0 }}>
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
        </div>
      </section>

      {/* Quick Links */}
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
