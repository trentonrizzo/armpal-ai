import React from "react";

export default function ProgramsPill({ onClick, style = {} }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...styles.pill, ...style }}
    >
      <span style={styles.left}>🔒</span>
      <span style={styles.text}>Programs</span>
      <span style={styles.right}>💪</span>
    </button>
  );
}

const styles = {
  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,

    /* ARMPAL RED */
    background: "linear-gradient(135deg, var(--accent), var(--accent-soft))",
    color: "var(--text)",

    border: "1px solid var(--border)",
    borderRadius: 999,
    padding: "7px 12px",

    fontSize: 13,
    fontWeight: 900,
    lineHeight: 1,
    letterSpacing: "0.02em",

    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",

    /* RED GLOW — NOT PINK */
    boxShadow: "0 8px 20px color-mix(in srgb, var(--accent) 35%, transparent)",
  },

  left: { opacity: 0.95 },
  text: {},
  right: { opacity: 0.95 },
};
