// Lightweight toast system: success / error, auto-dismiss 2–3s.
// No new library; uses existing theme variables.

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

const ToastContext = createContext(null);

const TOAST_DURATION = 2500;

const containerStyle = {
  position: "fixed",
  bottom: "calc(env(safe-area-inset-bottom) + 80px)",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 99999,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  pointerEvents: "none",
  maxWidth: "min(90vw, 320px)",
};

const toastStyle = (type) => ({
  padding: "12px 18px",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 600,
  boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
  pointerEvents: "auto",
  background: type === "error" ? "var(--accent)" : "var(--card-2)",
  color: type === "error" ? "var(--text)" : "var(--text)",
  border: type === "error" ? "none" : "1px solid var(--border)",
  animation: "toastIn 0.2s ease-out",
});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((type, message) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => removeToast(id), TOAST_DURATION);
    return id;
  }, [removeToast]);

  const value = {
    toast,
    success: (msg) => toast("success", msg),
    error: (msg) => toast("error", msg),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div style={containerStyle} aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            style={toastStyle(t.type)}
            role={t.type === "error" ? "alert" : "status"}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { toast: () => {}, success: () => {}, error: () => {} };
  return ctx;
}
