import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const AUTO_HIDE_MS = 4000;

/**
 * Global in-app notification banner.
 * Fixed top, slide-down, auto-hide 4s, click navigates to payload.link.
 * Does not block UI; pointer-events enabled.
 */
export default function InAppNotification({ queue, removeFirst }) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  const item = queue?.[0] ?? null;

  useEffect(() => {
    if (!item) {
      setVisible(false);
      setAnimating(false);
      return;
    }

    setAnimating(true);
    setVisible(true);

    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(() => {
        removeFirst?.();
        setAnimating(false);
      }, 300);
    }, AUTO_HIDE_MS);

    return () => clearTimeout(t);
  }, [item?.id, removeFirst]);

  if (!item) return null;

  const link = item.link || "/";

  const handleClick = () => {
    setVisible(false);
    setTimeout(() => {
      removeFirst?.();
      navigate(link);
    }, 100);
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
        transform: visible ? "translateY(0)" : "translateY(-100%)",
        transition: "transform 0.3s ease-out",
        padding: "12px 16px",
        paddingTop: "max(12px, env(safe-area-inset-top))",
        background: "var(--card)",
        borderBottom: "1px solid var(--border)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        cursor: "pointer",
      }}
    >
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
      {item.body && (
        <div
          style={{
            color: "var(--text-dim)",
            fontSize: 13,
            lineHeight: 1.3,
          }}
        >
          {item.body}
        </div>
      )}
    </div>
  );
}
