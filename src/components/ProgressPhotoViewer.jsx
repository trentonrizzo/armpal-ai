// src/components/ProgressPhotoViewer.jsx
//
// Fullscreen viewer for the Progress Photos vault. Designed to feel native:
//   - Black backdrop, image rendered with object-fit: contain
//   - Big always-visible close button in the top-right (44px touch target)
//   - Swipe left/right between photos when the image is at 1x
//   - Two-finger pinch-to-zoom + pan when zoomed
//   - Double-tap toggles 1x ↔ 2.5x
//   - iOS native long-press menu (Save to Photos, Copy) is preserved
//   - Date + optional note shown in a non-blocking overlay at the bottom
//   - Z-index sits above the bottom nav so controls never get covered

import React, { useEffect, useRef, useState, useCallback } from "react";
import { FaTimes } from "react-icons/fa";

const MAX_ZOOM = 4;
const MIN_ZOOM = 1;
const ZOOM_DOUBLE_TAP = 2.5;
const SWIPE_THRESHOLD_PX = 60;
const DOUBLE_TAP_MS = 300;

function distance(a, b) {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

function midpoint(a, b) {
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
}

export default function ProgressPhotoViewer({ photos, startIndex, onClose }) {
  const safeStart = Math.max(0, Math.min(startIndex || 0, photos.length - 1));
  const [index, setIndex] = useState(safeStart);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  const gestureRef = useRef({
    mode: "idle", // 'idle' | 'pan' | 'pinch' | 'swipe'
    startTouches: null,
    startScale: 1,
    startTx: 0,
    startTy: 0,
    startDist: 0,
    lastTapTime: 0,
    swipeDx: 0,
  });

  const photo = photos[index];

  const resetZoom = useCallback(() => {
    setScale(1);
    setTx(0);
    setTy(0);
  }, []);

  // Keyboard support (for web)
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
      else if (e.key === "ArrowLeft" && index > 0) {
        resetZoom();
        setIndex((i) => i - 1);
      } else if (e.key === "ArrowRight" && index < photos.length - 1) {
        resetZoom();
        setIndex((i) => i + 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, photos.length, onClose, resetZoom]);

  function clampPan(nextScale, nextTx, nextTy) {
    // Loose bounds — keep the image roughly inside the viewport.
    const range = (nextScale - 1) * 200;
    return {
      tx: Math.max(-range, Math.min(range, nextTx)),
      ty: Math.max(-range, Math.min(range, nextTy)),
    };
  }

  function goPrev() {
    if (index <= 0) return;
    setTransitioning(true);
    resetZoom();
    setIndex((i) => i - 1);
    requestAnimationFrame(() => setTransitioning(false));
  }

  function goNext() {
    if (index >= photos.length - 1) return;
    setTransitioning(true);
    resetZoom();
    setIndex((i) => i + 1);
    requestAnimationFrame(() => setTransitioning(false));
  }

  function onTouchStart(e) {
    const g = gestureRef.current;
    const touches = e.touches;
    if (touches.length === 2) {
      g.mode = "pinch";
      g.startDist = distance(touches[0], touches[1]);
      g.startScale = scale;
      g.startTx = tx;
      g.startTy = ty;
    } else if (touches.length === 1) {
      const now = Date.now();
      if (scale > 1) {
        g.mode = "pan";
        g.startTouches = { x: touches[0].clientX, y: touches[0].clientY };
        g.startTx = tx;
        g.startTy = ty;
      } else {
        g.mode = "swipe";
        g.startTouches = { x: touches[0].clientX, y: touches[0].clientY };
        g.swipeDx = 0;
      }

      if (now - g.lastTapTime < DOUBLE_TAP_MS) {
        // double-tap → toggle zoom
        if (scale > 1) {
          resetZoom();
        } else {
          setScale(ZOOM_DOUBLE_TAP);
        }
        g.lastTapTime = 0;
        g.mode = "idle";
      } else {
        g.lastTapTime = now;
      }
    }
  }

  function onTouchMove(e) {
    const g = gestureRef.current;
    if (g.mode === "pinch" && e.touches.length === 2) {
      const d = distance(e.touches[0], e.touches[1]);
      const ratio = g.startDist > 0 ? d / g.startDist : 1;
      const nextScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, g.startScale * ratio));
      const { tx: nx, ty: ny } = clampPan(nextScale, g.startTx, g.startTy);
      setScale(nextScale);
      setTx(nx);
      setTy(ny);
      e.preventDefault?.();
    } else if (g.mode === "pan" && e.touches.length === 1) {
      const dx = e.touches[0].clientX - g.startTouches.x;
      const dy = e.touches[0].clientY - g.startTouches.y;
      const { tx: nx, ty: ny } = clampPan(scale, g.startTx + dx, g.startTy + dy);
      setTx(nx);
      setTy(ny);
      e.preventDefault?.();
    } else if (g.mode === "swipe" && e.touches.length === 1) {
      g.swipeDx = e.touches[0].clientX - g.startTouches.x;
      // We don't translate the image during swipe — keep it simple and snappy.
    }
  }

  function onTouchEnd() {
    const g = gestureRef.current;
    if (g.mode === "swipe") {
      const dx = g.swipeDx;
      if (Math.abs(dx) > SWIPE_THRESHOLD_PX) {
        if (dx < 0) goNext();
        else goPrev();
      }
    }
    if (g.mode === "pinch" && scale <= 1.05) {
      // snap back to 1x cleanly
      resetZoom();
    }
    g.mode = "idle";
    g.startTouches = null;
    g.swipeDx = 0;
  }

  if (!photo) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        zIndex: 100000,
        display: "flex",
        flexDirection: "column",
        // Sit above the bottom nav and any system controls.
      }}
    >
      {/* Top bar: close button only, always tappable, never blocks the image */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding: "calc(8px + var(--safe-area-top)) 12px 8px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          zIndex: 2,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%)",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            opacity: 0.85,
            pointerEvents: "none",
          }}
        >
          {index + 1} / {photos.length}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            pointerEvents: "auto",
            width: 44,
            height: 44,
            borderRadius: 999,
            border: "none",
            background: "rgba(0,0,0,0.55)",
            color: "#fff",
            fontSize: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
        >
          <FaTimes />
        </button>
      </div>

      {/* Image stage */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          // touch-action: none for our custom gestures; native long-press still works.
          touchAction: "none",
        }}
      >
        {photo.url && (
          <img
            src={photo.url}
            alt={photo.date || "Progress photo"}
            draggable={false}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
              transformOrigin: "center center",
              transition: transitioning
                ? "transform 0s"
                : "transform 120ms ease-out",
              userSelect: "auto",
              WebkitUserSelect: "auto",
              WebkitTouchCallout: "default",
              pointerEvents: "auto",
            }}
          />
        )}
      </div>

      {/* Bottom overlay: date + optional note, non-blocking */}
      {(photo.date || photo.note) && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "12px 14px calc(14px + var(--safe-area-bottom)) 14px",
            background:
              "linear-gradient(0deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)",
            color: "#fff",
            pointerEvents: "none",
            zIndex: 2,
          }}
        >
          {photo.date && (
            <div style={{ fontWeight: 700, fontSize: 13 }}>{photo.date}</div>
          )}
          {photo.note && (
            <div
              style={{
                fontSize: 12,
                opacity: 0.85,
                marginTop: 4,
                lineHeight: 1.35,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {photo.note}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
