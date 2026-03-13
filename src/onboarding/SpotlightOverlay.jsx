import React, { useMemo } from "react";
import { createPortal } from "react-dom";

const OVERLAY_ROOT_ID = "armpal-onboarding-root";

function ensureOverlayRoot() {
  if (typeof document === "undefined") return null;
  let el = document.getElementById(OVERLAY_ROOT_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = OVERLAY_ROOT_ID;
    document.body.appendChild(el);
  }
  return el;
}

export default function SpotlightOverlay({
  active,
  step,
  targetRect,
  onPrimary,
  onSecondary,
}) {
  const root = ensureOverlayRoot();

  const cardPositionStyle = useMemo(() => ({
    position: "fixed",
    left: "50%",
    transform: "translateX(-50%)",
    bottom: "calc(env(safe-area-inset-bottom) + 88px)",
  }), []);

  if (!active || !root || !step) return null;

  const radius = targetRect?.radius ?? 16;

  const spotlightStyle = targetRect
    ? {
      position: "fixed",
      top: targetRect.top,
      left: targetRect.left,
      width: targetRect.width,
      height: targetRect.height,
      borderRadius: radius,
      boxShadow: "0 0 0 9999px rgba(0,0,0,0.68)",
      pointerEvents: "none",
      transition: "all 0.25s ease",
    }
    : null;

  const isModalStep = step.type === "modal";

  const isWelcomeOrComplete =
    isModalStep ||
    step.id === "tour_complete" ||
    step.id === "profile_saved";

  const primaryLabel = (() => {
    if (step.id === "welcome") return "Next";
    if (step.id === "profile_intro") return "Continue";
    if (step.id === "profile_saved") return "Start Tour";
    if (step.id === "tour_complete") return "Go to Dashboard";
    if (step.id === "tour_workouts") return "Next";
    if (step.id === "tour_overview") return "Next";
    if (step.id === "tour_add_friend") return "Next";
    if (step.id === "tour_profile_settings_panel") return "Next";
    return "Next";
  })();

  const canAdvanceManually =
    step.canAdvanceManually === undefined ? true : !!step.canAdvanceManually;

  // Hard rule: profile_edit can never advance manually; only the save event may advance it.
  const effectiveCanAdvance =
    step.id === "profile_edit" ? false : canAdvanceManually;

  const showSecondary = !!step.allowSkip;
  const secondaryLabel = step.allowSkip ? "Skip Tour" : "";

  return createPortal(
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9998,
            pointerEvents: isModalStep ? "auto" : "none",
          }}
        >
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: isWelcomeOrComplete ? "rgba(0,0,0,0.7)" : "transparent",
          pointerEvents: isWelcomeOrComplete ? "auto" : "none",
          transition: "background-color 0.25s ease",
        }}
      />

      {spotlightStyle && <div style={spotlightStyle} />}

      <div
        style={{
          zIndex: 9999,
          maxWidth: 420,
          width: "calc(100% - 32px)",
          ...cardPositionStyle,
          pointerEvents: "auto",
        }}
      >
        <div
          style={{
            background: "var(--card)",
            borderRadius: 18,
            padding: 18,
            border: "1px solid var(--border)",
            boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
            color: "var(--text)",
          }}
        >
          {step.title && (
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              {step.title}
            </div>
          )}
          {step.description && (
            <div
              style={{
                fontSize: 14,
                opacity: 0.85,
                lineHeight: 1.5,
                marginBottom: 14,
              }}
            >
              {step.description}
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: showSecondary ? "space-between" : "flex-end",
              gap: 8,
            }}
          >
            {showSecondary && (
              <button
                type="button"
                onClick={onSecondary}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 999,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text)",
                  fontSize: 14,
                }}
              >
                {secondaryLabel}
              </button>
            )}
            {effectiveCanAdvance && (
              <button
                type="button"
                onClick={onPrimary}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 999,
                  border: "none",
                  background: "var(--accent)",
                  color: "#000",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {primaryLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    root
  );
}

