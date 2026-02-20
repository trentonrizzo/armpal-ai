/**
 * Right-side drag for look (pitch / yaw)
 */
import React, { useRef, useCallback } from "react";

export default function LookTouch({ onLookDelta }) {
  const lastRef = useRef({ x: 0, y: 0 });
  const activeRef = useRef(false);

  const handleStart = useCallback(
    (clientX, clientY) => {
      lastRef.current = { x: clientX, y: clientY };
      activeRef.current = true;
    },
    []
  );

  const handleMove = useCallback(
    (clientX, clientY) => {
      if (!activeRef.current || !onLookDelta) return;
      const dx = clientX - lastRef.current.x;
      const dy = clientY - lastRef.current.y;
      lastRef.current = { x: clientX, y: clientY };
      onLookDelta(dx, dy);
    },
    [onLookDelta]
  );

  const handleEnd = useCallback(() => {
    activeRef.current = false;
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        right: 0,
        top: 0,
        bottom: 0,
        width: "50%",
        touchAction: "none",
        zIndex: 9,
      }}
      onTouchStart={(e) => {
        e.preventDefault();
        const t = e.touches[0];
        if (t) handleStart(t.clientX, t.clientY);
      }}
      onTouchMove={(e) => {
        e.preventDefault();
        const t = e.touches[0];
        if (t) handleMove(t.clientX, t.clientY);
      }}
      onTouchEnd={handleEnd}
      onTouchCancel={handleEnd}
      onMouseDown={(e) => {
        e.preventDefault();
        handleStart(e.clientX, e.clientY);
      }}
      onMouseMove={(e) => {
        if (activeRef.current) handleMove(e.clientX, e.clientY);
      }}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      aria-hidden
    />
  );
}
