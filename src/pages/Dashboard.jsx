// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { checkUsageCap, getIsPro } from "../utils/usageLimits";
import { Link, useNavigate } from "react-router-dom";
import StripeTestButton from "../components/StripeTestButton";

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
import EmptyState from "../components/EmptyState";


export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isPro, setIsPro] = useState(false);
  const [user, setUser] = useState(null);
  const [displayName, setDisplayName] = useState("Athlete");
  const [goals, setGoals] = useState([]);
  const [loadingGoals, setLoadingGoals] = useState(true);

  // ✅ AI Chat State (ONLY ONCE)
  const [showAIChat, setShowAIChat] = useState(false);
  // Smart Analytics / Progress Overview — Pro-only (centralized getIsPro)
  const [analyticsPro, setAnalyticsPro] = useState(null);
  const [showAnalyticsUpgrade, setShowAnalyticsUpgrade] = useState(false);

  // Strength Calculator State
  const [exerciseName, setExerciseName] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [repsInput, setRepsInput] = useState("");
  const [calculated1RM, setCalculated1RM] = useState(null);

  // PR comparison
  const [bestPR, setBestPR] = useState(null);
  const [prDifference, setPrDifference] = useState(null);
  const [prCapMessage, setPrCapMessage] = useState("");

  // Upcoming workout
  const [upcomingWorkout, setUpcomingWorkout] = useState(null);

  useEffect(() => {
    loadUserAndData();
  }, []);

  // After Stripe redirect: re-fetch profile from Supabase only. Never assume Pro from redirect.
  useEffect(() => {
    const stripeReturn = searchParams.get("stripe_return");
    if (stripeReturn !== "1") return;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id;
      if (!uid) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, is_pro")
        .eq("id", uid)
        .single();
      setUser(data?.user ?? null);
      setIsPro(!!profile?.is_pro);
      setDisplayName(profile?.username || data?.user?.email?.split("@")[0] || "Athlete");
      getIsPro(uid).then(setAnalyticsPro);
      setSearchParams({}, { replace: true });
    })();
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!user?.id) return;
    getIsPro(user.id).then(setAnalyticsPro);
  }, [user?.id]);

  async function loadUserAndData() {
    const { data, error } = await supabase.auth.getUser();
    if (error) return;

    const currentUser = data?.user || null;
    setUser(currentUser);

    let name =
      currentUser?.user_metadata?.username ||
      (currentUser?.email ? currentUser.email.split("@")[0] : "Athlete");

    if (currentUser?.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, is_pro")
        .eq("id", currentUser.id)
        .single();

      if (profile?.username) name = profile.username;
      setIsPro(!!profile?.is_pro);

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

    const cap = await checkUsageCap(user.id, "prs");
    if (!cap.allowed) {
      setPrCapMessage(`PR limit reached (${cap.limit}). Go Pro for more!`);
      return;
    }
    setPrCapMessage("");

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
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: "2px 0 0", display: "flex", alignItems: "center", gap: "8px" }}>
  {displayName}

  {isPro && (
    <span style={{
      padding: "2px 6px",
      fontSize: "12px",
      borderRadius: "6px",
      background: "#ffd700",
      color: "#000",
      fontWeight: "bold"
    }}>
      PRO
    </span>
  )}
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

      {/* Upgrade to Pro — only when NOT Pro (uses existing isPro from profiles) */}
      {!isPro && (
        <Link
          to="/pro"
          style={{
            display: "block",
            marginBottom: 16,
            padding: "12px 16px",
            borderRadius: 12,
            background: "var(--accent)",
            color: "var(--text)",
            fontWeight: 700,
            fontSize: 14,
            textAlign: "center",
            border: "1px solid var(--border)",
            textDecoration: "none",
          }}
        >
          Upgrade to Pro
        </Link>
      )}

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

      {/* SMART ANALYTICS (PRO-ONLY) — lock state + upgrade on click if free */}
      <ProgramsLauncher pillStyle={{ marginBottom: 12 }} />
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (analyticsPro === false) {
            setShowAnalyticsUpgrade(true);
            return;
          }
          if (analyticsPro === true) navigate("/analytics");
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          if (analyticsPro === false) {
            setShowAnalyticsUpgrade(true);
            return;
          }
          if (analyticsPro === true) navigate("/analytics");
        }}
        style={{ cursor: "pointer", position: "relative" }}
      >
        <SmartAnalytics />
        {analyticsPro === false && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 16,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <span style={{ fontSize: 32 }} aria-hidden>🔒</span>
          </div>
        )}
      </div>
      {showAnalyticsUpgrade && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9998,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setShowAnalyticsUpgrade(false)}
        >
          <div
            style={{
              background: "var(--card)",
              borderRadius: 16,
              padding: 24,
              maxWidth: 320,
              border: "1px solid var(--border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ margin: "0 0 16px", fontWeight: 600 }}>
              Progress Overview is a Pro feature
            </p>
            <p style={{ margin: "0 0 16px", fontSize: 14, opacity: 0.9 }}>
              Upgrade to unlock Smart Analytics and full progress tracking.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setShowAnalyticsUpgrade(false)}
                style={{
                  padding: "10px 20px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Not now
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAnalyticsUpgrade(false);
                  navigate("/pro");
                }}
                style={{
                  padding: "10px 20px",
                  borderRadius: 10,
                  border: "none",
                  background: "var(--accent)",
                  color: "var(--text)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Upgrade to Pro
              </button>
            </div>
          </div>
        </div>
      )}

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

              {prCapMessage ? (
                <p style={{ color: "var(--accent)", fontSize: 13, marginTop: 6 }}>{prCapMessage}</p>
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
            <EmptyState
              icon="📅"
              message="No upcoming workouts yet."
              ctaLabel="Go to Workouts"
              ctaOnClick={() => navigate("/workouts")}
            />
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
