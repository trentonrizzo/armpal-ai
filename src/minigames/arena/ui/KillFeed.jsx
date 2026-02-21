/**
 * Brief kill feed: "You eliminated Enemy" / "Enemy eliminated you"
 */
import React, { useState, useEffect } from "react";

const wrap = {
  position: "absolute",
  left: "50%",
  top: 100,
  transform: "translateX(-50%)",
  zIndex: 40,
  pointerEvents: "none",
  textAlign: "center",
};
const line = {
  padding: "6px 14px",
  borderRadius: 8,
  background: "rgba(0,0,0,0.7)",
  color: "var(--text)",
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 4,
};

export default function KillFeed({ entries }) {
  const [visible, setVisible] = useState([]);

  useEffect(() => {
    if (!entries?.length) return;
    setVisible((v) => [...v, ...entries].slice(-3));
    const t = setTimeout(() => setVisible((v) => v.filter((_, i) => i < v.length - entries.length)), 3000);
    return () => clearTimeout(t);
  }, [entries?.length]);

  if (!visible.length) return null;

  return (
    <div style={wrap}>
      {visible.map((e, i) => (
        <div key={i} style={line}>
          {e.youKilled ? "You eliminated opponent" : "Opponent eliminated you"}
        </div>
      ))}
    </div>
  );
}
