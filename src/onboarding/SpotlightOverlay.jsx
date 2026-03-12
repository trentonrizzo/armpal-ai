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

  const isWelcomeOrComplete =
    step.id === "welcome" ||
    step.id === "tour_complete" ||
    step.id === "profile_saved";

  const primaryLabel = (() => {
    if (step.id === "welcome") return "Continue";
    if (step.id === "profile_saved") return "Start Tour";
    if (step.id === "tour_complete") return "Go to Dashboard";
    return "Next";
  })();

  const showSecondary = false;
  const secondaryLabel = "";

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        pointerEvents: "none",
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
          position: "fixed",
          zIndex: 9999,
          maxWidth: 360,
          width: "calc(100% - 32px)",
          margin: "0 auto",
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
          </div>
        </div>
      </div>
    </div>,
    root
  );
}

