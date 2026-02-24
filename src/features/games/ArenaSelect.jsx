/**
 * Arm Power Arena — choose Multiplayer (queue) or Trainer (single-player aim).
 */
import React from "react";
import { useNavigate } from "react-router-dom";

const PAGE = {
  minHeight: "100vh",
  background: "var(--bg)",
  color: "var(--text)",
  padding: "24px 16px 90px",
  maxWidth: 420,
  margin: "0 auto",
};
const TITLE = { fontSize: 22, fontWeight: 900, marginBottom: 8 };
const SUB = { fontSize: 14, color: "var(--text-dim)", marginBottom: 24 };
const GRID = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
};
const BTN = {
  display: "block",
  width: "100%",
  padding: "20px 24px",
  borderRadius: 16,
  border: "2px solid var(--border)",
  background: "var(--card-2)",
  color: "var(--text)",
  fontSize: 18,
  fontWeight: 800,
  cursor: "pointer",
  textAlign: "left",
  transition: "transform 0.2s ease, box-shadow 0.2s ease",
};
const BTN_MULTI = {
  ...BTN,
  borderColor: "var(--accent)",
  background: "color-mix(in srgb, var(--accent) 18%, var(--card-2))",
};
const BACK = {
  marginBottom: 16,
  padding: "8px 0",
  background: "none",
  border: "none",
  color: "var(--text-dim)",
  fontSize: 14,
  cursor: "pointer",
};

export default function ArenaSelect() {
  const navigate = useNavigate();

  return (
    <div style={PAGE}>
      <button type="button" style={BACK} onClick={() => navigate("/games")}>
        ← Games
      </button>
      <h1 style={TITLE}>Arm Power Arena</h1>
      <p style={SUB}>Choose a mode</p>
      <div style={GRID}>
        <button
          type="button"
          style={BTN_MULTI}
          onClick={() => navigate("/minigames/arena")}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 8px 24px color-mix(in srgb, var(--accent) 30%, transparent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <span style={{ display: "block", marginBottom: 4 }}>🎯 Multiplayer</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-dim)" }}>
            1v1 queue. First to 7 kills or 90s.
          </span>
        </button>
        <button
          type="button"
          style={BTN}
          onClick={() => navigate("/games/arena-trainer")}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <span style={{ display: "block", marginBottom: 4 }}>🎲 Arena Aim Trainer</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-dim)" }}>
            Single-player. Hit targets, no matchmaking.
          </span>
        </button>
      </div>
    </div>
  );
}
