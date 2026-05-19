import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../supabaseClient";
import { useToast } from "../ToastProvider";
import { submitCoachingRequest } from "../../services/coachingRequests";

const EXPERIENCE_LEVELS = ["Beginner", "Intermediate", "Advanced"];
const SUBMIT_COOLDOWN_MS = 4000;

const OVERLAY = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.78)",
  zIndex: 10002,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "calc(16px + env(safe-area-inset-top)) 16px calc(16px + env(safe-area-inset-bottom))",
  animation: "coachingOverlayIn 0.22s ease-out",
};

const MODAL = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 18,
  padding: 20,
  maxWidth: 440,
  width: "100%",
  maxHeight: "min(92dvh, 720px)",
  overflowY: "auto",
  color: "var(--text)",
  boxShadow: "0 24px 64px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)",
  animation: "coachingModalIn 0.26s cubic-bezier(0.22, 1, 0.36, 1)",
};

const LABEL = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "var(--text-dim)",
  marginBottom: 6,
  letterSpacing: 0.2,
};

const INPUT = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--card-2)",
  color: "var(--text)",
  fontSize: 15,
  marginBottom: 14,
};

const BTN_PRIMARY = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 14,
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  fontSize: 15,
  fontWeight: 800,
  cursor: "pointer",
  marginTop: 4,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
};

const EMPTY_FORM = {
  name: "",
  instagram: "",
  goal: "",
  experience: "",
  notes: "",
};

export default function CoachingRequestModal({ open, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldError, setFieldError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submitInFlightRef = useRef(false);
  const lastSubmitAtRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY_FORM);
    setFieldError("");
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !submitting) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, submitting]);

  if (!open) return null;

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (fieldError) setFieldError("");
  }

  function validate() {
    if (!form.name.trim()) return "Name is required.";
    if (!form.instagram.trim()) return "Instagram username is required.";
    if (!form.goal.trim()) return "Main goal is required.";
    if (!form.experience) return "Experience level is required.";
    return "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitInFlightRef.current || submitting) return;

    const validationMessage = validate();
    if (validationMessage) {
      setFieldError(validationMessage);
      return;
    }

    const now = Date.now();
    if (now - lastSubmitAtRef.current < SUBMIT_COOLDOWN_MS) {
      setFieldError("Please wait a moment before sending another request.");
      return;
    }

    submitInFlightRef.current = true;
    setSubmitting(true);
    setFieldError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        toast.error("Something went wrong. Please try again.");
        return;
      }

      await submitCoachingRequest({
        userId,
        name: form.name,
        instagram: form.instagram,
        goal: form.goal,
        experience: form.experience,
        notes: form.notes,
      });

      lastSubmitAtRef.current = Date.now();
      toast.success("Request submitted. Trent will contact you soon.");
      onClose?.();
    } catch (err) {
      console.error("[coaching] submit failed", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      submitInFlightRef.current = false;
      setSubmitting(false);
    }
  }

  return createPortal(
    <>
      <style>{`
        @keyframes coachingOverlayIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes coachingModalIn {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes coachingSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div
        style={OVERLAY}
        onClick={() => {
          if (!submitting) onClose?.();
        }}
        role="presentation"
      >
        <div
          style={MODAL}
          role="dialog"
          aria-modal="true"
          aria-labelledby="coaching-request-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 8,
            }}
          >
            <h2
              id="coaching-request-title"
              style={{ fontSize: 22, fontWeight: 900, margin: 0, lineHeight: 1.2 }}
            >
              Request Coaching
            </h2>
            <button
              type="button"
              onClick={() => !submitting && onClose?.()}
              aria-label="Close"
              disabled={submitting}
              style={{
                border: "none",
                background: "transparent",
                color: "var(--text-dim)",
                fontSize: 20,
                lineHeight: 1,
                cursor: submitting ? "not-allowed" : "pointer",
                padding: 4,
              }}
            >
              ✕
            </button>
          </div>

          <p
            style={{
              margin: "0 0 18px",
              fontSize: 14,
              lineHeight: 1.5,
              color: "var(--text-dim)",
            }}
          >
            Tell me a little about your goals and Trent will follow up if coaching is a good fit.
          </p>

          {fieldError ? (
            <div
              style={{
                marginBottom: 14,
                padding: "10px 12px",
                borderRadius: 10,
                background: "color-mix(in srgb, var(--accent) 18%, transparent)",
                border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {fieldError}
            </div>
          ) : null}

          <form onSubmit={handleSubmit}>
            <label style={LABEL} htmlFor="coaching-name">
              Name <span style={{ color: "var(--accent)" }}>*</span>
            </label>
            <input
              id="coaching-name"
              type="text"
              autoComplete="name"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              style={INPUT}
              disabled={submitting}
            />

            <label style={LABEL} htmlFor="coaching-instagram">
              Instagram Username <span style={{ color: "var(--accent)" }}>*</span>
            </label>
            <input
              id="coaching-instagram"
              type="text"
              autoComplete="username"
              placeholder="@yourhandle"
              value={form.instagram}
              onChange={(e) => setField("instagram", e.target.value)}
              style={INPUT}
              disabled={submitting}
            />

            <label style={LABEL} htmlFor="coaching-goal">
              Main Goal <span style={{ color: "var(--accent)" }}>*</span>
            </label>
            <input
              id="coaching-goal"
              type="text"
              placeholder="Strength, muscle gain, fat loss, accountability…"
              value={form.goal}
              onChange={(e) => setField("goal", e.target.value)}
              style={INPUT}
              disabled={submitting}
            />

            <label style={LABEL} htmlFor="coaching-experience">
              Experience Level <span style={{ color: "var(--accent)" }}>*</span>
            </label>
            <select
              id="coaching-experience"
              value={form.experience}
              onChange={(e) => setField("experience", e.target.value)}
              style={{ ...INPUT, marginBottom: 14 }}
              disabled={submitting}
            >
              <option value="">Select level…</option>
              {EXPERIENCE_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>

            <label style={LABEL} htmlFor="coaching-notes">
              Notes
            </label>
            <textarea
              id="coaching-notes"
              rows={4}
              placeholder="Anything else you'd like Trent to know (optional)"
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              style={{
                ...INPUT,
                resize: "vertical",
                minHeight: 96,
                marginBottom: 16,
              }}
              disabled={submitting}
            />

            <button type="submit" style={BTN_PRIMARY} disabled={submitting}>
              {submitting ? (
                <>
                  <span
                    aria-hidden
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      border: "2px solid rgba(255,255,255,0.35)",
                      borderTopColor: "#fff",
                      animation: "coachingSpin 0.7s linear infinite",
                    }}
                  />
                  Sending…
                </>
              ) : (
                "Send Request"
              )}
            </button>
          </form>
        </div>
      </div>
    </>,
    document.body
  );
}
