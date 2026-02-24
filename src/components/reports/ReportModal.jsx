import React, { useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";

const REASONS = [
  { id: "harassment", label: "Harassment" },
  { id: "spam", label: "Spam" },
  { id: "fraud", label: "Fraud" },
  { id: "inappropriate content", label: "Inappropriate content" },
  { id: "impersonation", label: "Impersonation" },
  { id: "other", label: "Other" },
];

export default function ReportModal({ open, onClose, targetType, targetId, targetLabel }) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const title = useMemo(() => {
    const t = targetType === "program" ? "program" : "profile";
    return `Report ${t}`;
  }, [targetType]);

  if (!open) return null;

  async function submit() {
    if (!reason) {
      setError("Select a reason.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        setError("You must be signed in to report.");
        return;
      }
      const payload = {
        reporter_id: userId,
        target_type: targetType,
        target_id: targetId,
        reason,
        notes: notes.trim() ? notes.trim() : null,
      };
      const { error: insErr } = await supabase.from("reports").insert(payload);
      if (insErr) throw insErr;
      onClose?.();
      alert("Report submitted. Thank you.");
    } catch (e) {
      console.error("Report submit failed", e);
      setError(e?.message || "Failed to submit report.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={styles.title}>{title}</div>
          <button type="button" onClick={onClose} style={styles.closeBtn} aria-label="Close">
            ✕
          </button>
        </div>

        {targetLabel ? (
          <div style={styles.target}>
            Reporting: <strong style={{ color: "var(--text)" }}>{targetLabel}</strong>
          </div>
        ) : null}

        <label style={styles.label}>
          Reason <span style={{ color: "#f55" }}>*</span>
        </label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={styles.select}
        >
          <option value="">Select…</option>
          {REASONS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>

        <label style={styles.label}>Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any context…"
          rows={4}
          style={styles.textarea}
        />

        {error ? <div style={styles.error}>{error}</div> : null}

        <button type="button" onClick={submit} disabled={submitting} style={styles.submitBtn}>
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.72)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    border: "1px solid var(--border)",
    background: "var(--card)",
    padding: 16,
    boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  title: { fontSize: 16, fontWeight: 900, color: "var(--text)" },
  closeBtn: {
    border: "1px solid var(--border)",
    background: "var(--card-2)",
    color: "var(--text)",
    borderRadius: 10,
    padding: "6px 10px",
    cursor: "pointer",
  },
  target: {
    fontSize: 13,
    color: "var(--text-dim)",
    marginBottom: 10,
  },
  label: { display: "block", fontSize: 12, color: "var(--text-dim)", margin: "10px 0 6px" },
  select: {
    width: "100%",
    padding: 10,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--card-2)",
    color: "var(--text)",
    fontSize: 14,
  },
  textarea: {
    width: "100%",
    padding: 10,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--card-2)",
    color: "var(--text)",
    fontSize: 14,
    resize: "vertical",
    boxSizing: "border-box",
  },
  error: {
    marginTop: 10,
    fontSize: 13,
    color: "#f55",
    fontWeight: 700,
  },
  submitBtn: {
    marginTop: 12,
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "none",
    background: "var(--accent)",
    color: "var(--text)",
    fontWeight: 900,
    cursor: "pointer",
  },
};

