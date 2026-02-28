import React, { useEffect } from "react";

const AUTO_HIDE_MS = 4000;

/**
 * Pure UI: top notification banner queue.
 * Controlled by props only. No Supabase.
 * Fixed top, high z-index, safe area. X to dismiss, auto-dismiss ~4s.
 */
export default function InAppBanner({ items, onDismiss, onClick }) {
  const item = items?.[0] ?? null;

  useEffect(() => {
    if (!item?.id) return;
    const t = setTimeout(() => {
      onDismiss?.(item.id);
    }, AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [item?.id, onDismiss]);

  if (!item) return null;

  const handleClick = () => {
    onClick?.(item);
  };

  const handleDismiss = (e) => {
    e.stopPropagation();
    onDismiss?.(item.id);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10000,
        pointerEvents: "auto",
        padding: "12px 16px",
        paddingTop: "max(12px, env(safe-area-inset-top))",
        background: "var(--card)",
        borderBottom: "1px solid var(--border)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              color: "var(--text)",
              fontWeight: 700,
              fontSize: 15,
              marginBottom: 2,
            }}
          >
            {item.title || "Notification"}
          </div>
          {item.body ? (
            <div
              style={{
                color: "var(--text-dim)",
                fontSize: 13,
                lineHeight: 1.3,
              }}
            >
              {item.body}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={handleDismiss}
          style={{
            flexShrink: 0,
            width: 28,
            height: 28,
            borderRadius: 999,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text-dim)",
            fontSize: 16,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
