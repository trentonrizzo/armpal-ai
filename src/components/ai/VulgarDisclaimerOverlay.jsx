import React from "react";

/**
 * VulgarDisclaimerOverlay
 * Shows when user tries to enable Vulgar/Unhinged mode.
 * Accept -> call onAccept()
 * Cancel -> call onCancel()
 *
 * Styling uses CSS vars so it matches your theme:
 * --card, --card-2, --border, --text, --accent
 */
export default function VulgarDisclaimerOverlay({ onAccept, onCancel }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000000,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 12,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 760,
          background: "var(--card)",
          color: "var(--text)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
        }}
      >
        <div
          style={{
            padding: 14,
            background: "var(--card-2)",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>
              Vulgar / Unhinged Mode
            </div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
              Requires confirmation to enable.
            </div>
          </div>

          <button
            onClick={onCancel}
            style={{
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text)",
              borderRadius: 10,
              padding: "8px 10px",
              cursor: "pointer",
              opacity: 0.9,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 14, lineHeight: 1.45 }}>
          <p style={{ margin: "0 0 10px" }}>
            This mode can be <b>crude</b>, <b>sarcastic</b>, <b>aggressive</b>, and
            intentionally <b>offensive</b> for comedy.
          </p>

          <ul style={{ margin: "0 0 10px 18px", padding: 0, fontSize: 13, opacity: 0.95 }}>
            <li>It may use profanity and insulting language.</li>
            <li>It may roast you (e.g., calling you lazy or a “fat ass”).</li>
            <li>It may be chaotic / harsh / intense.</li>
            <li>Disable it anytime in the AI Coach section.</li>
          </ul>

          <div
            style={{
              marginTop: 12,
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={onCancel}
              style={{
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text)",
                borderRadius: 12,
                padding: "10px 14px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>

            <button
              onClick={onAccept}
              style={{
                border: "none",
                background: "var(--accent)",
                color: "var(--text)",
                borderRadius: 12,
                padding: "10px 14px",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              I understand — enable Vulgar Mode
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
