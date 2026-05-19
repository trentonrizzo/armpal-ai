import React from "react";

const NOTICE =
  "Progress photos currently use device-local storage and may not persist reliably in browser mode. For best reliability, use the ArmPal iOS app.";

/**
 * Informational banner for web/Safari users (hidden in native ArmPal iOS app).
 */
export default function ProgressPhotosBrowserNotice() {
  return (
    <div
      role="note"
      style={{
        marginBottom: 14,
        padding: "12px 14px",
        borderRadius: 12,
        background: "var(--card-2)",
        border: "1px solid var(--border)",
        fontSize: 13,
        lineHeight: 1.5,
        color: "var(--text-dim)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
      }}
    >
      {NOTICE}
    </div>
  );
}
