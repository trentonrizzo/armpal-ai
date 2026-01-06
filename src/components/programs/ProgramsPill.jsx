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
    background: "linear-gradient(135deg, #ff2f2f, #d81e1e)",
    color: "#fff",

    border: "1px solid rgba(255,255,255,0.14)",
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
    boxShadow: "0 8px 20px rgba(255,47,47,0.35)",
  },

  left: { opacity: 0.95 },
  text: {},
  right: { opacity: 0.95 },
};
