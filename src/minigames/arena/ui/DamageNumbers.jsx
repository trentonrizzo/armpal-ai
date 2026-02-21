/**
 * Floating damage numbers at hit point (world → screen projected by parent)
 */
import React from "react";

const wrap = {
  position: "absolute",
  pointerEvents: "none",
  zIndex: 45,
  color: "#fff",
  fontSize: 18,
  fontWeight: 900,
  textShadow: "0 1px 2px #000, 0 0 4px #000",
  animation: "arenaDamageFloat 0.8s ease-out forwards",
};
const headshot = { ...wrap, color: "#f80" };

export default function DamageNumbers({ entries, project }) {
  if (!entries?.length || !project) return null;

  return (
    <>
      <style>{`
        @keyframes arenaDamageFloat {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-28px) scale(1.1); }
        }
      `}</style>
      {entries.map((e, i) => {
        const screen = project(e.x, e.y, e.z);
        if (!screen) return null;
        return (
          <div
            key={i}
            style={{
              ...(e.headshot ? headshot : wrap),
              left: screen.x,
              top: screen.y,
              transform: "translate(-50%, -50%)",
            }}
          >
            {e.damage}
          </div>
        );
      })}
    </>
  );
}
