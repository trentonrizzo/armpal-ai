import React from "react";

export default function CoachingCard({ onRequestClick, compact = false }) {
  return (
    <section style={{ marginBottom: compact ? 0 : 20 }} data-onboarding="coaching">
      {!compact && (
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          1-on-1 Coaching
        </h2>
      )}

      <div
        style={{
          background: "var(--card-2)",
          border: "1px solid var(--border)",
          borderRadius: compact ? 14 : 12,
          padding: compact ? 14 : 14,
          display: "flex",
          flexDirection: "column",
          gap: compact ? 10 : 12,
          boxShadow: compact
            ? "none"
            : "0 8px 28px rgba(0,0,0,0.22), 0 0 0 1px rgba(255,255,255,0.03)",
        }}
      >
        {compact && (
          <div style={{ fontWeight: 800, fontSize: 15 }}>1-on-1 Coaching</div>
        )}

        <p
          style={{
            margin: 0,
            fontSize: compact ? 13 : 14,
            lineHeight: 1.45,
            color: "var(--text-dim)",
          }}
        >
          Want personalized help with strength, muscle gain, fat loss, or accountability?
        </p>

        <button
          type="button"
          onClick={onRequestClick}
          style={{
            width: "100%",
            padding: compact ? "11px 14px" : "12px 14px",
            borderRadius: 12,
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            fontWeight: 800,
            fontSize: 14,
            cursor: "pointer",
            boxShadow: "0 10px 24px color-mix(in srgb, var(--accent) 35%, transparent)",
          }}
        >
          Request Coaching
        </button>
      </div>
    </section>
  );
}
