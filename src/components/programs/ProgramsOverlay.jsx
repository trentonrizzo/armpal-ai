import React, { useEffect } from "react";

export default function ProgramsOverlay({ open, onClose }) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div style={styles.panel} role="dialog" aria-modal="true">
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.kicker}>ARMPAL</div>
            <div style={styles.title}>Programs</div>
          </div>

          <button style={styles.closeBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div style={styles.sub}>
          Categories are placeholders for now. We’ll add paid programs here later.
        </div>

        <div style={styles.grid}>
          <CategoryCard title="Bench Programs" desc="Strength + hypertrophy blocks" />
          <CategoryCard title="Squat Programs" desc="Technique + weekly progression" />
          <CategoryCard title="Deadlift Programs" desc="Pull power + volume waves" />
          <CategoryCard title="Arm Wrestling" desc="Hook / toproll / back pressure" />
        </div>

        <div style={styles.footer}>
          <button style={styles.primaryBtn} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryCard({ title, desc }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardTop}>
        <div style={styles.cardTitle}>{title}</div>
        <div style={styles.lockTag}>🔒</div>
      </div>
      <div style={styles.cardDesc}>{desc}</div>
      <div style={styles.coming}>Coming soon</div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 999999,
    background: "rgba(0,0,0,0.68)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },

  panel: {
    width: "100%",
    maxWidth: 560,
    borderRadius: 18,
    background: "var(--card)",
    border: "1px solid var(--border)",
    boxShadow: "0 24px 80px rgba(0,0,0,0.65)",
    padding: 16,
  },

  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },

  headerLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },

  kicker: {
    color: "var(--text-dim)",
    letterSpacing: "0.22em",
    fontSize: 11,
    fontWeight: 700,
  },

  title: {
    color: "var(--text)",
    fontSize: 22,
    fontWeight: 900,
    lineHeight: 1.1,
  },

  closeBtn: {
    background: "transparent",
    border: "1px solid var(--border)",
    color: "var(--text)",
    borderRadius: 12,
    width: 40,
    height: 40,
    cursor: "pointer",
    fontSize: 18,
  },

  sub: {
    marginTop: 10,
    color: "var(--text-dim)",
    fontSize: 13,
    lineHeight: 1.35,
  },

  grid: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
  },

  card: {
    background: "var(--card-2)",
    borderRadius: 14,
    border: "1px solid var(--border)",
    padding: 14,
  },

  cardTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  cardTitle: {
    color: "var(--text)",
    fontSize: 15,
    fontWeight: 800,
  },

  lockTag: {
    background: "color-mix(in srgb, var(--accent) 18%, transparent)",
    border: "1px solid color-mix(in srgb, var(--accent) 45%, transparent)",
    color: "var(--text)",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 12,
    fontWeight: 800,
  },

  cardDesc: {
    marginTop: 6,
    color: "var(--text-dim)",
    fontSize: 13,
    lineHeight: 1.35,
  },

  coming: {
    marginTop: 10,
    color: "color-mix(in srgb, var(--text) 45%, transparent)",
    fontSize: 12,
    letterSpacing: "0.10em",
    textTransform: "uppercase",
    fontWeight: 700,
  },

  footer: {
    marginTop: 14,
    display: "flex",
    justifyContent: "flex-end",
  },

  primaryBtn: {
    background: "linear-gradient(135deg, var(--accent), var(--accent-soft))",
    border: "none",
    color: "#fff",
    fontWeight: 900,
    padding: "10px 14px",
    borderRadius: 12,
    cursor: "pointer",
    boxShadow: "0 10px 24px color-mix(in srgb, var(--accent) 35%, transparent)",
  },
};
