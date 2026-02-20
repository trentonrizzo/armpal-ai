/**
 * Brief hit feedback (show for ~150ms on successful hit)
 */
import React, { useEffect, useState } from "react";

const wrap = {
  position: "absolute",
  left: "50%",
  top: "50%",
  transform: "translate(-50%, -50%)",
  pointerEvents: "none",
  zIndex: 30,
  width: 24,
  height: 24,
  opacity: 0,
  transition: "none",
};
const line = {
  position: "absolute",
  background: "rgba(255,255,255,0.95)",
  width: 2,
  height: 10,
  top: 7,
  left: 11,
};
const line1 = { ...line, transform: "rotate(-45deg)" };
const line2 = { ...line, transform: "rotate(45deg)" };

export default function HitMarker({ show }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!show) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 150);
    return () => clearTimeout(t);
  }, [show]);

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes arenaHitPing {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
      <div style={{ ...wrap, opacity: 1, animation: "arenaHitPing 0.15s ease-out forwards" }}>
        <div style={line1} />
        <div style={line2} />
      </div>
    </>
  );
}
