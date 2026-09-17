import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PRO_FEATURES } from "../lib/entitlements";
import { REVENUE_EVENTS, trackRevenueEvent } from "../lib/revenueAnalytics";

export default function ProGate({
  feature = "voice",
  title,
  body,
  onClose,
}) {
  const navigate = useNavigate();
  const meta = PRO_FEATURES[feature] || PRO_FEATURES.voice;
  const heading = title || meta.title;
  const copy = body || meta.body;

  useEffect(() => {
    trackRevenueEvent(REVENUE_EVENTS.PAYWALL_VIEWED, { feature, surface: "gate" });
  }, [feature]);

  return (
    <div
      style={{
        padding: "24px 16px",
        maxWidth: 420,
        margin: "0 auto",
      }}
    >
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text)",
            opacity: 0.8,
            fontSize: 14,
            marginBottom: 16,
            cursor: "pointer",
          }}
        >
          ← Back
        </button>
      ) : null}
      <div
        style={{
          textAlign: "center",
          padding: "28px 18px",
          borderRadius: 20,
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--accent) 15%, var(--card)) 0%, var(--card) 100%)",
          border: "1px solid color-mix(in srgb, var(--accent) 30%, var(--border))",
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "4px 16px",
            borderRadius: 999,
            background: "var(--accent)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 900,
            letterSpacing: 1.5,
            marginBottom: 12,
          }}
        >
          PRO
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 8px", color: "var(--text)" }}>
          {heading}
        </h2>
        <p style={{ fontSize: 14, opacity: 0.8, margin: "0 0 20px", lineHeight: 1.5, color: "var(--text-dim)" }}>
          {copy}
        </p>
        <button
          type="button"
          onClick={() => {
            trackRevenueEvent(REVENUE_EVENTS.UPGRADE_INITIATED, { feature, surface: "gate" });
            navigate("/pro");
          }}
          style={{
            width: "100%",
            padding: "14px 18px",
            borderRadius: 14,
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            fontWeight: 800,
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          Upgrade to Pro
        </button>
      </div>
    </div>
  );
}
