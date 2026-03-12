import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useProfileGate } from "../../context/ProfileGateContext";

const ONBOARDING_KEY = "armpal_onboarding_complete";

// Ordered, 20–25s guided tour.
const STEPS = [
  { id: "welcome", route: "/profile" },
  { id: "profileFields", route: "/profile" },
  { id: "profileSave", route: "/profile" },
  { id: "workouts", route: "/workouts" },
  { id: "prs", route: "/prs" },
  { id: "measure", route: "/measure" },
  { id: "goals", route: "/goals" },
  { id: "nutrition", route: "/nutrition" },
  { id: "strength", route: "/" },
  { id: "friends", route: "/" },    // wait for user to tap Friends
  { id: "settings", route: "/profile" },
  { id: "finish", route: "/" },
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

// Approximate spotlight rectangles per step (percent-based).
function getTargetRect(stepId) {
  switch (stepId) {
    case "profileFields":
      return { top: "18%", left: "8%", width: "84%", height: "26%", radius: 18 };
    case "profileSave":
      return { top: "52%", left: "8%", width: "84%", height: "12%", radius: 18 };
    case "workouts":
      return { top: "18%", left: "4%", width: "92%", height: "40%", radius: 18 };
    case "prs":
      return { top: "18%", left: "4%", width: "92%", height: "40%", radius: 18 };
    case "measure":
      return { top: "18%", left: "4%", width: "92%", height: "40%", radius: 18 };
    case "goals":
      return { top: "18%", left: "4%", width: "92%", height: "40%", radius: 18 };
    case "nutrition":
      return { top: "18%", left: "4%", width: "92%", height: "36%", radius: 18 };
    case "strength":
      return { top: "46%", left: "4%", width: "92%", height: "26%", radius: 18 };
    case "friends":
      return { top: "10%", left: "74%", width: "18%", height: "16%", radius: 20 };
    case "settings":
      return { top: "8%", left: "68%", width: "24%", height: "16%", radius: 18 };
    default:
      return null;
  }
}

function BlinkingArrow({ stepId }) {
  const style = useMemo(() => {
    const base = {
      position: "fixed",
      zIndex: 999999,
      fontSize: 26,
      color: "var(--accent)",
      animation: "apOnboardBlink 0.9s ease-in-out infinite",
    };

    switch (stepId) {
      case "profileFields":
        return { ...base, top: "14%", left: "50%", transform: "translateX(-50%) rotate(180deg)" };
      case "profileSave":
        return { ...base, top: "66%", left: "50%", transform: "translateX(-50%) rotate(180deg)" };
      case "workouts":
        return { ...base, bottom: "16%", left: "22%" };
      case "prs":
        return { ...base, bottom: "16%", left: "40%" };
      case "measure":
        return { ...base, bottom: "16%", left: "58%" };
      case "goals":
        return { ...base, bottom: "16%", left: "76%" };
      case "nutrition":
        return { ...base, bottom: "16%", left: "50%" };
      case "strength":
        return { ...base, top: "54%", left: "50%", transform: "translateX(-50%) rotate(180deg)" };
      case "friends":
        return { ...base, top: "9%", right: "14%", transform: "rotate(90deg)" };
      case "settings":
        return { ...base, top: "10%", right: "14%", transform: "rotate(90deg)" };
      default:
        return null;
    }
  }, [stepId]);

  if (!style) return null;
  return <div style={style}>➤</div>;
}

export default function OnboardingOverlay({ isNewUser }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const gate = useProfileGate ? useProfileGate() : null;

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
    // For friends step we let the user tap Friends; do not force route.
    if (!current.route || current.id === "friends") return;
    if (location.pathname !== current.route) {
      navigate(current.route, { replace: true });
    }
  }, [visible, current.route, current.id, location.pathname, navigate]);

  // Auto-advance for non-interactive steps.
  useEffect(() => {
    if (!visible) return;
    if (["welcome", "profileFields", "profileSave", "friends", "finish"].includes(current.id)) {
      return;
    }

    const delay = current.id === "strength" ? 2200 : 2000;

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
      // Jump into app tour at Workouts.
      setStepIndex(3);
      navigate("/workouts", { replace: true });
    }
    window.addEventListener("ap_onboarding_profile_saved", handleProfileSaved);
    return () => window.removeEventListener("ap_onboarding_profile_saved", handleProfileSaved);
  }, [navigate]);

  // Detect typing on profile page to move from fields -> save step.
  useEffect(() => {
    function handleInput() {
      setStepIndex((i) => {
        const step = STEPS[i];
        if (step?.id === "profileFields") {
          return Math.min(i + 1, STEPS.length - 1);
        }
        return i;
      });
    }
    if (visible) {
      window.addEventListener("input", handleInput);
    }
    return () => window.removeEventListener("input", handleInput);
  }, [visible]);

  // Friends step: wait for user to actually navigate to /friends.
  useEffect(() => {
    if (!visible) return;
    if (current.id !== "friends") return;
    if (location.pathname === "/friends") {
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    }
  }, [visible, current.id, location.pathname]);

  if (!visible) return null;

  const overlay = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99998,
        pointerEvents: "none",
      }}
    >
      {/* Spotlight highlight (dims everything except active area) */}
      {(() => {
        const rect = getTargetRect(current.id);
        if (!rect) return null;
        return (
          <div
            style={{
              position: "fixed",
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              borderRadius: rect.radius,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.65)",
              pointerEvents: "none",
              transition: "all 0.25s ease-out",
            }}
          />
        );
      })()}

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
          borderRadius: 18,
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

        {current.id === "profileFields" && (
          <>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
              Set up your profile
            </div>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
              Start by entering your name and handle so people can find you.
            </p>
          </>
        )}

        {current.id === "profileSave" && (
          <>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
              Save your profile
            </div>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
              Great. Tap <strong>Save</strong> to continue.
            </p>
          </>
        )}

        {current.id === "workouts" && (
          <>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
              Workouts
            </div>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
              This is where you log and access your workouts anytime.
            </p>
          </>
        )}

        {current.id === "prs" && (
          <>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
              PR Tracker
            </div>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
              Track your personal records and watch your strength improve.
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
              Record bodyweight and body measurements over time.
            </p>
          </>
        )}

        {current.id === "goals" && (
          <>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
              Goals
            </div>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
              Set strength or bodyweight goals and monitor your progress.
            </p>
          </>
        )}

        {current.id === "nutrition" && (
          <>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
              Nutrition
            </div>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
              Track calories, macros, and daily nutrition.
            </p>
          </>
        )}

        {current.id === "friends" && (
          <>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
              Friends
            </div>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
              Add friends and follow their progress. Tap the Friends area now.
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
              {`Alright ${gate?.profile?.display_name || gate?.profile?.handle || "there"}, you're ready.`}
            </div>
            <p style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>
              Track your workouts. Measure your progress. Reach your goals.
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 13, opacity: 0.85 }}>
              You can also upgrade to ArmPal Pro for AI tools and advanced features.
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
              Let&apos;s Go
            </button>
          </>
        )}
      </div>

      {/* Directional arrow per step (roughly pointing at relevant UI) */}
      <BlinkingArrow stepId={current.id} />
    </div>
  );

  return createPortal(overlay, document.body);
}

