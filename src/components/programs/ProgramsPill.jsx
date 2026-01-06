import React from "react";

export default function ProgramsPill({ onClick, style = {} }) {
  return (
    <button type="button" onClick={onClick} style={{ ...styles.pill, ...style }}>
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
    background: "#e11d48",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 999,
    padding: "7px 12px",
    fontSize: 13,
    fontWeight: 900,
    lineHeight: 1,
    cursor: "pointer",
    userSelect: "none",
    boxShadow: "0 10px 22px rgba(225,29,72,0.28)",
    whiteSpace: "nowrap",
  },
  left: { opacity: 0.95 },
  text: { letterSpacing: "0.02em" },
  right: { opacity: 0.95 },
};
