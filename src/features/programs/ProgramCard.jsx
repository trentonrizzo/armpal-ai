import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import ReportModal from "../../components/reports/ReportModal";

const ADMIN_CREATOR_ID =
  typeof import.meta !== "undefined" ? import.meta.env.VITE_ADMIN_CREATOR_ID : undefined;

export default function ProgramCard({ program, owned, onPreviewClick, creatorProfile }) {
  const navigate = useNavigate();
  const meta = program?.parsed_program?.meta;
  const thumbnailStyle = meta?.thumbnail_style ?? "default";
  const [menuOpen, setMenuOpen] = useState(false);
  const [showReport, setShowReport] = useState(false);

  function handleClick() {
    if (onPreviewClick) {
      onPreviewClick(program);
    } else {
      navigate(`/programs/${program.id}`);
    }
  }

  const creatorName =
    creatorProfile?.display_name ||
    creatorProfile?.username ||
    creatorProfile?.handle ||
    null;
  const creatorHandle = creatorProfile?.handle || null;
  const isOfficial =
    creatorProfile?.role === "official" ||
    (creatorHandle && creatorHandle.toLowerCase() === "armpal") ||
    (ADMIN_CREATOR_ID && program.creator_id === ADMIN_CREATOR_ID);

  function handleCreatorClick(e) {
    e.stopPropagation();
    if (!creatorProfile?.id) return;
    navigate(`/friend/${creatorProfile.id}`);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleClick();
      }}
      className={`program-card ${thumbnailStyle}`}
      style={styles.card}
    >
      <div style={styles.badges}>
        {meta?.difficulty && (
          <span className="badge difficulty">{meta.difficulty}</span>
        )}
        {creatorName && (
          <button
            type="button"
            onClick={handleCreatorClick}
            style={styles.creatorAttribution}
          >
            Created by{" "}
            <span style={styles.creatorHandle}>
              {creatorHandle ? `@${creatorHandle}` : creatorName}
            </span>
          </button>
        )}
        {isOfficial && (
          <span className="badge official-pill">Official</span>
        )}
        {owned && <span style={styles.owned}>Owned</span>}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((v) => !v);
        }}
        style={styles.menuBtn}
        aria-label="Program options"
        title="Options"
      >
        ⋯
      </button>
      {menuOpen && (
        <div
          style={styles.menu}
          onClick={(e) => e.stopPropagation()}
          role="menu"
        >
          <button
            type="button"
            style={styles.menuItem}
            onClick={() => {
              setMenuOpen(false);
              setShowReport(true);
            }}
          >
            Report
          </button>
        </div>
      )}
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
      <ReportModal
        open={showReport}
        onClose={() => setShowReport(false)}
        targetType="program"
        targetId={program?.id}
        targetLabel={program?.title || "Program"}
      />
    </div>
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
    position: "relative",
  },
  badges: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  menuBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: "var(--text)",
    cursor: "pointer",
    lineHeight: 1,
    fontSize: 18,
  },
  menu: {
    position: "absolute",
    top: 48,
    right: 10,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--card)",
    overflow: "hidden",
    zIndex: 5,
    minWidth: 140,
    boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
  },
  menuItem: {
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    border: "none",
    background: "transparent",
    color: "var(--text)",
    fontWeight: 700,
    cursor: "pointer",
  },
  creatorAttribution: {
    border: "none",
    background: "none",
    padding: 0,
    margin: 0,
    fontSize: 11,
    color: "var(--text-dim)",
    cursor: "pointer",
    textAlign: "left",
  },
  creatorHandle: {
    fontWeight: 700,
    color: "var(--text)",
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
