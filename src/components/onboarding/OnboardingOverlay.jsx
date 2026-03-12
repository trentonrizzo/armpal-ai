import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";

const ONBOARDING_KEY = "armpal_onboarding_complete";

const STEPS = [
  { id: "welcome", route: "/profile", type: "center" },
  { id: "profile", route: "/profile", type: "profile" },
  { id: "dashboard", route: "/", type: "dashboard" },
  { id: "workouts", route: "/", type: "workouts" },
  { id: "prs", route: "/", type: "prs" },
  { id: "strength", route: "/", type: "strength" },
  { id: "measure", route: "/", type: "measure" },
  { id: "nutrition", route: "/", type: "nutrition" },
  { id: "friends", route: "/", type: "friends" },
  { id: "settings", route: "/", type: "settings" },
  { id: "finish", route: "/", type: "finish" },
];

function useShouldRunOnboarding(isNewUser) {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!isNewUser) {
      setAllowed(false);
      return;
    }
    try {
      const v = localStorage.getItem(ONBOARDING_KEY);
      setAllowed(v !== "true");
    } catch {
      setAllowed(true);
    }
  }, [isNewUser]);

  return allowed;
}

function BlinkingArrow({ position }) {
  const style = useMemo(() => {
    const base = {
      position: "fixed",
      zIndex: 999999,
      fontSize: 26,
      color: "var(--accent)",
      animation: "apOnboardBlink 0.9s ease-in-out infinite",
    };
    if (position === "top") return { ...base, top: "18%", left: "50%", transform: "translateX(-50%) rotate(180deg)" };
    if (position === "bottom") return { ...base, bottom: "18%", left: "50%", transform: "translateX(-50%)" };
    if (position === "left") return { ...base, top: "50%", left: "18%", transform: "translateY(-50%) rotate(-90deg)" };
    return { ...base, top: "50%", right: "18%", transform: "translateY(-50%) rotate(90deg)" };
  }, [position]);

  return <div style={style}>➤</div>;
}

export default function OnboardingOverlay({ isNewUser }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  const shouldRun = useShouldRunOnboarding(isNewUser);
  const current = STEPS[stepIndex] || STEPS[STEPS.length - 1];

  // Global keyframes injected once.
  useEffect(() => {
    const el = document.getElementById("ap-onboard-keyframes");
    if (el) return;
    const style = document.createElement("style");
    style.id = "ap-onboard-keyframes";
    style.innerHTML = `
@keyframes apOnboardBlink {
  0%,100% { opacity: 0.2; transform: scale(0.96); }
  50% { opacity: 1; transform: scale(1); }
}
@keyframes apOnboardFade {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
    `;
    document.head.appendChild(style);
  }, []);

  // Sync visibility and route with step.
  useEffect(() => {
    if (!shouldRun) {
      setVisible(false);
      return;
    }
    setVisible(true);
  }, [shouldRun]);

  // Navigate to target route for each step when needed.
  useEffect(() => {
    if (!visible) return;
    if (location.pathname !== current.route) {
      navigate(current.route, { replace: true });
    }
  }, [visible, current.route, location.pathname, navigate]);

  // Auto-advance for non-interactive steps.
  useEffect(() => {
    if (!visible) return;
    if (["welcome", "profile", "finish"].includes(current.id)) return;

    const delay =
      current.id === "dashboard"
        ? 2200
        : current.id === "strength"
        ? 2200
        : 1800;

    const t = setTimeout(() => {
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    }, delay);
    return () => clearTimeout(t);
  }, [visible, current.id]);

  // When we reach finish and user taps start, mark complete.
  function completeOnboarding() {
    try {
      localStorage.setItem(ONBOARDING_KEY, "true");
    } catch {}
    setVisible(false);
  }

  // Allow profile page to notify us after Save via custom event.
  useEffect(() => {
    function handleProfileSaved() {
      setStepIndex(2); // jump to dashboard step
      navigate("/", { replace: true });
    }
    window.addEventListener("ap_onboarding_profile_saved", handleProfileSaved);
    return () => window.removeEventListener("ap_onboarding_profile_saved", handleProfileSaved);
  }, [navigate]);

  if (!visible) return null;

  const overlay = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99998,
        background: "rgba(0,0,0,0.65)",
        pointerEvents: "none",
      }}
    >
      {/* Main card */}
      <div
        style={{
          position: "fixed",
          left: "50%",
          bottom: current.id === "welcome" || current.id === "finish" ? "16%" : "10%",
          transform: "translateX(-50%)",
          maxWidth: 360,
          width: "86%",
          background: "var(--card)",
          borderRadius: 16,
          border: "1px solid var(--border)",
          padding: 16,
          boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
          color: "var(--text)",
          animation: "apOnboardFade 0.24s ease-out",
          pointerEvents: "auto",
        }}
      >
        {current.id === "welcome" && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Welcome to ArmPal</div>
            <p style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>
              Let&apos;s get you set up in a few seconds.
            </p>
            <button
              type="button"
              onClick={() => setStepIndex(1)}
              style={{
                marginTop: 14,
                width: "100%",
                padding: 10,
                borderRadius: 12,
                border: "none",
                background: "var(--accent)",
                color: "var(--text)",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Continue
            </button>
          </>
        )}

        {current.id === "profile" && (
          <>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
              Set up your profile
            </div>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
              Start by entering your name and handle. This is how people will find you.
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.7 }}>
              Tap <strong>Save</strong> to continue.
            </p>
          </>
        )}

        {current.id === "dashboard" && (
          <>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
              Your dashboard
            </div>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
              Your strength progress, workouts, and stats will appear here.
            </p>
          </>
        )}

        {current.id === "workouts" && (
          <>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
              Workouts
            </div>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
              Track your workouts here. Log sets, reps, and exercises.
            </p>
          </>
        )}

        {current.id === "prs" && (
          <>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
              PR Tracker
            </div>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
              Record your personal records. ArmPal keeps track of your strongest lifts.
            </p>
          </>
        )}

        {current.id === "strength" && (
          <>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
              Strength calculator
            </div>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
              Use the strength calculator to estimate your one-rep max.
            </p>
          </>
        )}

        {current.id === "measure" && (
          <>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
              Measurements
            </div>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
              Track bodyweight and measurements over time.
            </p>
          </>
        )}

        {current.id === "nutrition" && (
          <>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
              Nutrition
            </div>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
              Log your food and monitor your macros.
            </p>
          </>
        )}

        {current.id === "friends" && (
          <>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
              Friends
            </div>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
              Add friends and share progress.
            </p>
          </>
        )}

        {current.id === "settings" && (
          <>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
              Settings
            </div>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
              Customize themes, profile settings, and preferences.
            </p>
          </>
        )}

        {current.id === "finish" && (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
              You&apos;re ready
            </div>
            <p style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>
              Enjoy tracking your progress with ArmPal.
            </p>
            <button
              type="button"
              onClick={completeOnboarding}
              style={{
                marginTop: 14,
                width: "100%",
                padding: 10,
                borderRadius: 12,
                border: "none",
                background: "var(--accent)",
                color: "var(--text)",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Start Training
            </button>
          </>
        )}
      </div>

      {/* Directional arrow per step (roughly pointing at relevant UI) */}
      {current.id === "profile" && <BlinkingArrow position="top" />}
      {current.id === "dashboard" && <BlinkingArrow position="top" />}
      {current.id === "workouts" && <BlinkingArrow position="bottom" />}
      {current.id === "prs" && <BlinkingArrow position="bottom" />}
      {current.id === "strength" && <BlinkingArrow position="top" />}
      {current.id === "measure" && <BlinkingArrow position="bottom" />}
      {current.id === "nutrition" && <BlinkingArrow position="bottom" />}
      {current.id === "friends" && <BlinkingArrow position="bottom" />}
      {current.id === "settings" && <BlinkingArrow position="bottom" />}
    </div>
  );

  return createPortal(overlay, document.body);
}

