import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Analytics() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("bodyweight");

  return (
    <div style={{ minHeight: "100vh", background: "#0b0b0f", color: "#fff", padding: 16 }}>
      <button
        onClick={() => navigate(-1)}
        style={{
          background: "transparent",
          border: "1px solid rgba(255,255,255,0.15)",
          color: "#fff",
          padding: "10px 12px",
          borderRadius: 12,
        }}
      >
        ← Back
      </button>

      <div style={{ marginTop: 14, fontSize: 22, fontWeight: 800 }}>
        Smart Analytics
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        {[
          ["bodyweight", "Bodyweight"],
          ["measurements", "Measurements"],
          ["prs", "PRs"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.12)",
              background: tab === key ? "rgba(255,0,64,0.18)" : "rgba(255,255,255,0.04)",
              color: "#fff",
              fontWeight: 800,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Placeholder content */}
      <div
        style={{
          marginTop: 14,
          padding: 14,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.04)",
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 6 }}>
          {tab === "bodyweight" && "Bodyweight analytics coming next"}
          {tab === "measurements" && "Measurements analytics coming next"}
          {tab === "prs" && "PR analytics coming next"}
        </div>
        <div style={{ opacity: 0.8 }}>
          This is the skeleton page. Next step is wiring real data + charts.
        </div>
      </div>
    </div>
  );
}
