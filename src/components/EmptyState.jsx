// Minimal empty state: icon, message, optional CTA (existing nav only).
// Use when array.length === 0; no business logic changes.

import React from "react";

const WRAP = {
  padding: "24px 20px",
  textAlign: "center",
  color: "var(--text-dim)",
  fontSize: 15,
};

const ICON = {
  fontSize: 40,
  marginBottom: 12,
  opacity: 0.8,
};

const MSG = {
  margin: "0 0 16px",
  lineHeight: 1.4,
};

const CTA = {
  display: "inline-block",
  padding: "10px 18px",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--accent)",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  transition: "background 0.15s ease, border-color 0.15s ease",
};

export default function EmptyState({ icon = "📭", message, ctaLabel, ctaOnClick }) {
  return (
    <div style={WRAP}>
      <div style={ICON}>{icon}</div>
      <p style={MSG}>{message}</p>
      {ctaLabel && ctaOnClick && (
        <button type="button" style={CTA} onClick={ctaOnClick}>
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
