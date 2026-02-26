import React from "react";
import { createPortal } from "react-dom";
import { FaCheck, FaEye } from "react-icons/fa";

const MS_KEYFRAMES = `
@keyframes msGlow{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--accent) 30%,transparent)}50%{box-shadow:0 0 10px 2px color-mix(in srgb,var(--accent) 20%,transparent)}}
`;

export function getSelectStyle(isActive, isSelected) {
  if (!isActive) return {};
  if (isSelected) {
    return {
      border: "2px solid var(--accent)",
      background: "color-mix(in srgb, var(--accent) 8%, var(--card))",
      animation: "msGlow 2s ease-in-out infinite",
    };
  }
  return { opacity: 0.6 };
}

export function SelectCheck({ show }) {
  if (!show) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        width: 24,
        height: 24,
        borderRadius: 999,
        background: "var(--accent)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10,
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      }}
    >
      <FaCheck style={{ fontSize: 11, color: "#fff" }} />
    </div>
  );
}

export function ViewBtn({ onClick }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: "var(--card-2)",
        color: "var(--text)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        flexShrink: 0,
      }}
      title="View"
    >
      <FaEye style={{ fontSize: 13 }} />
    </button>
  );
}

export function SelectionBar({ count, onDelete, onCancel }) {
  return createPortal(
    <>
      <style>{MS_KEYFRAMES}</style>
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 10000,
          background: "var(--card)",
          borderTop: "2px solid var(--accent)",
          padding: "12px 16px",
          paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          boxShadow: "0 -4px 24px rgba(0,0,0,0.4)",
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>
          {count} selected
        </span>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={barGhostBtn}>
            Cancel
          </button>
          <button
            onClick={onDelete}
            disabled={count === 0}
            style={{
              ...barAccentBtn,
              opacity: count > 0 ? 1 : 0.5,
              cursor: count > 0 ? "pointer" : "not-allowed",
            }}
          >
            Delete ({count})
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

export function DoubleConfirmModal({
  count,
  step,
  onCancel,
  onContinue,
  onConfirm,
  deleting,
}) {
  if (!step) return null;
  return createPortal(
    <div
      style={cfmBackdrop}
      onClick={deleting ? undefined : onCancel}
    >
      <div style={cfmCard} onClick={(e) => e.stopPropagation()}>
        {step === 1 && (
          <>
            <h2 style={{ marginTop: 0, fontSize: 20, fontWeight: 900, color: "var(--text)" }}>
              Delete selected?
            </h2>
            <p style={{ opacity: 0.7, fontSize: 14, marginBottom: 20 }}>
              Delete {count} item{count !== 1 ? "s" : ""}?
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onCancel} style={cfmGhostBtn}>
                Cancel
              </button>
              <button onClick={onContinue} style={cfmAccentBtn}>
                Continue
              </button>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h2 style={{ marginTop: 0, fontSize: 20, fontWeight: 900, color: "var(--accent)" }}>
              Permanent delete
            </h2>
            <p style={{ opacity: 0.7, fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
              These items will be permanently deleted and cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={onCancel}
                disabled={deleting}
                style={{ ...cfmGhostBtn, opacity: deleting ? 0.5 : 1 }}
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={deleting}
                style={{ ...cfmAccentBtn, opacity: deleting ? 0.7 : 1 }}
              >
                {deleting ? "Deleting…" : "Confirm Delete"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

const barGhostBtn = {
  padding: "10px 18px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text)",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};

const barAccentBtn = {
  padding: "10px 18px",
  borderRadius: 10,
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  fontWeight: 800,
  fontSize: 13,
};

const cfmBackdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.7)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: 20,
  zIndex: 10001,
};

const cfmCard = {
  background: "var(--card)",
  borderRadius: 16,
  border: "1px solid var(--border)",
  padding: 22,
  width: "100%",
  maxWidth: 400,
};

const cfmGhostBtn = {
  flex: 1,
  padding: 12,
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text)",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 14,
};

const cfmAccentBtn = {
  flex: 1,
  padding: 12,
  borderRadius: 12,
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
  fontSize: 14,
};
