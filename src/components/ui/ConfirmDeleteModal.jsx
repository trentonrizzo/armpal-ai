import React from "react";
import { createPortal } from "react-dom";

const OVERLAY = {
  position: "fixed",
  inset: 0,
  zIndex: 10000,
  background: "rgba(0,0,0,0.75)",
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  boxSizing: "border-box",
};

const MODAL = {
  background: "#0a0a0a",
  borderRadius: 16,
  padding: 20,
  maxWidth: 360,
  width: "100%",
  boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  border: "1px solid rgba(255,255,255,0.1)",
};

const TITLE = {
  fontSize: 18,
  fontWeight: 800,
  color: "#fff",
  margin: "0 0 8px",
};

const BODY = {
  fontSize: 14,
  color: "rgba(255,255,255,0.7)",
  margin: "0 0 20px",
  lineHeight: 1.5,
};

const ROW = {
  display: "flex",
  gap: 10,
  justifyContent: "flex-end",
  flexWrap: "wrap",
};

const BTN_CANCEL = {
  padding: "10px 18px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "transparent",
  color: "rgba(255,255,255,0.8)",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

const BTN_DELETE = {
  padding: "10px 18px",
  borderRadius: 10,
  border: "none",
  background: "#ff2b2b",
  color: "#fff",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

/**
 * Reusable ArmPal-themed delete confirmation modal.
 * Use instead of window.confirm / Alert.alert.
 */
export default function ConfirmDeleteModal({
  open,
  onClose,
  onConfirm,
  title = "Delete Entry?",
  body = "This will permanently remove the entry.",
}) {
  if (!open) return null;

  const handleConfirm = () => {
    onConfirm?.();
    onClose?.();
  };

  const content = (
    <div
      style={OVERLAY}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
    >
      <div style={MODAL} onClick={(e) => e.stopPropagation()}>
        <h2 id="confirm-delete-title" style={TITLE}>
          {title}
        </h2>
        <p style={BODY}>{body}</p>
        <div style={ROW}>
          <button type="button" style={BTN_CANCEL} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={BTN_DELETE} onClick={handleConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
