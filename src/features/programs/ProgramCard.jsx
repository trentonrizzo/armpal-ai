import React from "react";
import { useNavigate } from "react-router-dom";

export default function ProgramCard({ program, owned, onPreviewClick }) {
  const navigate = useNavigate();
  const meta = program?.parsed_program?.meta;
  const thumbnailStyle = meta?.thumbnail_style ?? "default";

  function handleClick() {
    if (onPreviewClick) {
      onPreviewClick(program);
    } else {
      navigate(`/programs/${program.id}`);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`program-card ${thumbnailStyle}`}
      style={styles.card}
    >
      <div style={styles.badges}>
        {meta?.difficulty && (
          <span className="badge difficulty">{meta.difficulty}</span>
        )}
        {program.creator_id && (
          <span className="badge creator-pro">Creator Program</span>
        )}
        {owned && <span style={styles.owned}>Owned</span>}
      </div>
      <div style={styles.top}>
        <span style={styles.title}>{program.title}</span>
      </div>
      {meta?.tags?.length > 0 && (
        <div style={styles.tags}>
          {meta.tags.map((tag) => (
            <span key={tag} className="badge tag">{tag}</span>
          ))}
        </div>
      )}
      {(program.preview_description || meta?.description) ? (
        <p style={styles.desc}>{program.preview_description || meta.description}</p>
      ) : null}
    </button>
  );
}

const styles = {
  card: {
    display: "block",
    width: "100%",
    minHeight: 140,
    textAlign: "left",
    background: "var(--card-2)",
    borderRadius: 14,
    border: "1px solid var(--border)",
    padding: 14,
    cursor: "pointer",
  },
  badges: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  top: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  tags: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
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
