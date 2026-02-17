import React from "react";
import { useNavigate } from "react-router-dom";

export default function TapStrength({ game }) {
  const navigate = useNavigate();
  return (
    <div style={{ padding: "16px 16px 90px", maxWidth: 400, margin: "0 auto" }}>
      <button
        type="button"
        onClick={() => navigate("/games")}
        style={{ marginBottom: 16, padding: "8px 0", background: "none", border: "none", color: "var(--text-dim)", fontSize: 14, cursor: "pointer" }}
      >
        ← Games
      </button>
      <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 16px", color: "var(--text)" }}>
        {game?.title ?? "Tap Strength"}
      </h2>
      <p style={{ color: "var(--text-dim)", fontSize: 14 }}>Coming soon.</p>
    </div>
  );
}
