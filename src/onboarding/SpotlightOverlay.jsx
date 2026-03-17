import React, { useEffect, useMemo, useState } from "react";
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
  const [viewportOffset, setViewportOffset] = useState({ top: 0, height: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleViewportChange() {
      const vv = window.visualViewport;
      if (vv) {
        setViewportOffset({ top: vv.offsetTop || 0, height: vv.height || 0 });
      } else {
        setViewportOffset({ top: 0, height: window.innerHeight || 0 });
      }
    }

    handleViewportChange();
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", handleViewportChange);
      vv.addEventListener("scroll", handleViewportChange);
    } else {
      window.addEventListener("resize", handleViewportChange);
      window.addEventListener("scroll", handleViewportChange);
    }
    return () => {
      if (vv) {
        vv.removeEventListener("resize", handleViewportChange);
        vv.removeEventListener("scroll", handleViewportChange);
      } else {
        window.removeEventListener("resize", handleViewportChange);
        window.removeEventListener("scroll", handleViewportChange);
      }
    };
  }, []);

  const root = ensureOverlayRoot();
  const showFullScreenCard = !targetRect;

  const cardPositionStyle = useMemo(() => {
    const padding = 16;
    const viewportTop = viewportOffset.top || 0;
    const viewportHeight = viewportOffset.height || window.innerHeight || 0;
    const bottomSafe = viewportTop + viewportHeight - padding;

    if (!targetRect || showFullScreenCard) {
      return {
        left: "50%",
        transform: "translateX(-50%)",
        bottom: viewportHeight > 0 ? viewportHeight * 0.12 : 80,
      };
    }

    const desiredTop = targetRect.bottom + 16;
    const cardHeightEstimate = 160;
    if (desiredTop + cardHeightEstimate > bottomSafe) {
      return {
        left: "50%",
        transform: "translateX(-50%)",
        bottom: viewportHeight > 0 ? viewportHeight * 0.12 : 80,
      };
    }

    return {
      left: "50%",
      transform: "translateX(-50%)",
      top: Math.max(desiredTop, viewportTop + padding),
    };
  }, [targetRect, viewportOffset, showFullScreenCard]);

  if (!active || !root || !step) return null;

  const radius = targetRect?.radius ?? 20;

  const SPOTLIGHT_PADDING = 12;

  const spotlightStyle = targetRect
    ? {
        position: "fixed",
        top: Math.max(targetRect.top - SPOTLIGHT_PADDING, 0),
        left: Math.max(targetRect.left - SPOTLIGHT_PADDING, 0),
        width: targetRect.width + SPOTLIGHT_PADDING * 2,
        height: targetRect.height + SPOTLIGHT_PADDING * 2,
        borderRadius: radius,
        boxShadow: "0 0 0 9999px rgba(0,0,0,0.68)",
        pointerEvents: "none",
        transition: "all 0.25s ease",
        boxSizing: "border-box",
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

      {spotlightStyle && (
        <>
          <div
            style={{
              ...spotlightStyle,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.7)",
            }}
          />
          <div
            style={{
              position: "fixed",
              top: spotlightStyle.top,
              left: spotlightStyle.left,
              width: spotlightStyle.width,
              height: spotlightStyle.height,
              borderRadius: spotlightStyle.borderRadius,
              border: "2px solid rgba(255,255,255,0.85)",
              boxShadow:
                "0 0 24px rgba(255,255,255,0.45), 0 0 60px rgba(255,0,80,0.55)",
              pointerEvents: "none",
              animation: "apSpotlightPulse 1.4s ease-in-out infinite",
            }}
          />
          <style>
            {`
              @keyframes apSpotlightPulse {
                0% {
                  transform: translateZ(0) scale(1);
                  opacity: 0.9;
                }
                50% {
                  transform: translateZ(0) scale(1.04);
                  opacity: 1;
                }
                100% {
                  transform: translateZ(0) scale(1);
                  opacity: 0.9;
                }
              }
            `}
          </style>
        </>
      )}

      <div
        style={{
          position: "fixed",
          zIndex: 9999,
          maxWidth: 420,
          width: "calc(100% - 32px)",
          margin: "0 auto",
          ...cardPositionStyle,
          left: "50%",
          transform: "translateX(-50%)",
          bottom: "calc(env(safe-area-inset-bottom) + 88px)",
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

