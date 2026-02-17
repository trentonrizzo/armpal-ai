import React from "react";
import { useNavigate } from "react-router-dom";

export default function ProgramCard({ program, owned }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(`/programs/${program.id}`)}
      style={styles.card}
    >
      <div style={styles.top}>
        <span style={styles.title}>{program.title}</span>
        {owned && <span style={styles.owned}>Owned</span>}
      </div>
      {program.preview_description ? (
        <p style={styles.desc}>{program.preview_description}</p>
      ) : null}
    </button>
  );
}

const styles = {
  card: {
    display: "block",
    width: "100%",
    textAlign: "left",
    background: "var(--card-2)",
    borderRadius: 14,
    border: "1px solid var(--border)",
    padding: 14,
    cursor: "pointer",
  },
  top: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  title: {
    color: "var(--text)",
    fontSize: 15,
    fontWeight: 800,
  },
  owned: {
    background: "color-mix(in srgb, var(--accent) 25%, transparent)",
    border: "1px solid var(--accent)",
    color: "var(--text)",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 11,
    fontWeight: 700,
  },
  desc: {
    margin: "8px 0 0",
    color: "var(--text-dim)",
    fontSize: 13,
    lineHeight: 1.35,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
  },
};
