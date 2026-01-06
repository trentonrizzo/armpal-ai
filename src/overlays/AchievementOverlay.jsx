// src/overlays/AchievementOverlay.jsx
import React, { useEffect, useState } from "react";

/*
  BUILD-SAFE VERSION
  - NO external CSS imports
  - NO window access at module scope
  - All client-only logic inside effects
*/

export default function AchievementOverlay() {
  const [queue, setQueue] = useState([]);
  const [active, setActive] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = (e) => {
      const payload = e?.detail;
      if (!payload) return;
      setQueue((q) => [...q, payload]);
    };

    window.addEventListener("achievement", handler);
    return () => window.removeEventListener("achievement", handler);
  }, []);

  useEffect(() => {
    if (!active && queue.length > 0) {
      setActive(queue[0]);
      setQueue((q) => q.slice(1));
    }
  }, [queue, active]);

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setActive(null), 2800);
    return () => clearTimeout(t);
  }, [active]);

  if (!active) return null;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.title}>Achievement Unlocked</div>
        <div style={styles.text}>{active.title || "Nice work 💪"}</div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: "fixed",
    top: 20,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 10000,
    pointerEvents: "none",
  },
  card: {
    background: "rgba(20,20,20,0.95)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 12,
    padding: "14px 18px",
    minWidth: 220,
    textAlign: "center",
    boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
  },
  title: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  text: {
    fontSize: 16,
    fontWeight: 600,
  },
};
