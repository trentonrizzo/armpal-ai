import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { buildDisplayText } from "../../utils/displayText";
import { X, Check, Zap } from "lucide-react";

const PHASE = { INPUT: "INPUT", GENERATING: "GENERATING", COMPLETE: "COMPLETE" };

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const GEN_LABELS = [
  "Parsing program structure",
  "Generating workouts",
  "Assigning dates",
  "Saving workouts",
];

const KEYFRAMES = `
@keyframes wcSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes wcPulse{0%,100%{opacity:.3;transform:scale(.94)}50%{opacity:.55;transform:scale(1.06)}}
@keyframes wcFadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes wcDot{0%,80%,100%{opacity:.25}40%{opacity:1}}
`;

/* ============================================================
   STYLES
   ============================================================ */
const OVERLAY_BG = {
  position: "fixed", inset: 0, zIndex: 10000,
  background: "rgba(0,0,0,0.92)",
  backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
};
const PANEL = {
  position: "fixed", inset: 0, zIndex: 10001,
  overflowY: "auto", WebkitOverflowScrolling: "touch",
};
const INNER = {
  maxWidth: 520, width: "100%", margin: "0 auto",
  padding: "20px 16px",
  paddingTop: "calc(20px + env(safe-area-inset-top, 0px))",
  paddingBottom: "calc(40px + env(safe-area-inset-bottom, 0px))",
  minHeight: "100%", display: "flex", flexDirection: "column",
  position: "relative",
};
const CLOSE_BTN = {
  position: "absolute",
  top: "calc(16px + env(safe-area-inset-top, 0px))", right: 16,
  width: 36, height: 36, borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.15)",
  color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", zIndex: 10,
};
const CENTER = {
  flex: 1, display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center",
  textAlign: "center", padding: "40px 0",
};
const TITLE = { fontSize: 22, fontWeight: 800, color: "#fff", margin: "0 0 8px" };
const SUB = { fontSize: 14, color: "rgba(255,255,255,0.6)", margin: "0 0 24px", lineHeight: 1.5 };
const LABEL = { display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 6 };
const INPUT_TEXT = {
  width: "100%", boxSizing: "border-box",
  padding: "12px 14px", borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.06)", color: "#fff", fontSize: 14,
  resize: "vertical",
};
const PRIMARY_BTN = {
  width: "100%", padding: "14px 20px", borderRadius: 12,
  border: "none", background: "var(--accent)", color: "#fff",
  fontSize: 16, fontWeight: 700, cursor: "pointer",
};
const SECONDARY_BTN = {
  width: "100%", padding: "14px 20px", borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(255,255,255,0.06)", color: "#fff",
  fontSize: 15, fontWeight: 600, cursor: "pointer",
};
const ERROR_BOX = {
  width: "100%", padding: "12px 14px", borderRadius: 10,
  background: "rgba(255,80,80,0.12)", border: "1px solid rgba(255,80,80,0.3)",
  color: "#ff6b6b", fontSize: 13, fontWeight: 600, marginTop: 12, textAlign: "left",
};
const ICON_CIRCLE = {
  width: 72, height: 72, borderRadius: "50%",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  display: "flex", alignItems: "center", justifyContent: "center",
  marginBottom: 20,
};
const BTN_STACK = { display: "flex", flexDirection: "column", gap: 10, width: "100%", marginTop: 20 };

function buildWeightStr(ex) {
  const parts = [];
  if (ex.percentage) parts.push(ex.percentage);
  if (ex.rpe) parts.push(`RPE ${ex.rpe}`);
  if (ex.notes) parts.push(ex.notes);
  return parts.join(" · ");
}

function parseSetsNum(v) {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseRepsNum(v) {
  const s = String(v || "");
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* ============================================================
   COMPONENT
   ============================================================ */
export default function WorkoutConverterOverlay({ open, onClose, userId, isPro, onComplete }) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState(PHASE.INPUT);
  const [programText, setProgramText] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [trainingDays, setTrainingDays] = useState([1, 3, 5]);
  const [maxCards, setMaxCards] = useState(50);
  const [autoAssignDates, setAutoAssignDates] = useState(true);
  const [genStep, setGenStep] = useState(0);
  const [error, setError] = useState(null);
  const [createdCount, setCreatedCount] = useState(0);

  useEffect(() => {
    if (open) return;
    setPhase(PHASE.INPUT);
    setProgramText("");
    setStartDate(new Date().toISOString().slice(0, 10));
    setTrainingDays([1, 3, 5]);
    setMaxCards(50);
    setAutoAssignDates(true);
    setGenStep(0);
    setError(null);
    setCreatedCount(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape" && phase !== PHASE.GENERATING) onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose, phase]);

  const toggleDay = useCallback((day) => {
    setTrainingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!programText.trim() || !userId) return;
    setPhase(PHASE.GENERATING);
    setGenStep(0);
    setError(null);

    const stepTimer = setInterval(() => {
      setGenStep((p) => (p < 2 ? p + 1 : p));
    }, 2500);

    try {
      const res = await fetch(`${window.location.origin}/api/ai/workout-converter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_text: programText,
          start_date: autoAssignDates ? startDate : null,
          training_days: autoAssignDates ? trainingDays : null,
          max_cards: maxCards,
          userId,
        }),
      });

      clearInterval(stepTimer);

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || d.error || "Conversion failed");
      }

      const data = await res.json();
      const workouts = data.workouts || [];

      if (workouts.length === 0) {
        throw new Error("AI did not generate any workouts. Try rephrasing your program.");
      }

      setGenStep(3);

      const { count: existingCount } = await supabase
        .from("workouts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      const basePosition = existingCount || 0;
      let saved = 0;

      for (let i = 0; i < workouts.length; i++) {
        const w = workouts[i];
        const { data: inserted, error: wErr } = await supabase
          .from("workouts")
          .insert({
            user_id: userId,
            name: w.title || `Workout ${i + 1}`,
            scheduled_for: w.assigned_date || null,
            position: basePosition + i,
          })
          .select()
          .single();

        if (wErr || !inserted) {
          console.error("Workout insert error:", wErr);
          continue;
        }

        if (Array.isArray(w.exercises) && w.exercises.length > 0) {
          const rows = w.exercises.map((ex, j) => ({
            user_id: userId,
            workout_id: inserted.id,
            name: ex.name || "Exercise",
            sets: parseSetsNum(ex.sets),
            reps: parseRepsNum(ex.reps),
            weight: buildWeightStr(ex),
            display_text: ex.display_text ?? buildDisplayText(ex),
            position: j,
          }));

          const { error: exErr } = await supabase.from("exercises").insert(rows);
          if (exErr) console.error("Exercises insert error:", exErr);
        }

        saved++;
      }

      setCreatedCount(saved);
      setPhase(PHASE.COMPLETE);
    } catch (err) {
      clearInterval(stepTimer);
      console.error("Workout converter error:", err);
      setError(err.message || "Something went wrong. Please try again.");
      setPhase(PHASE.INPUT);
    }
  }, [programText, userId, autoAssignDates, startDate, trainingDays, maxCards]);

  const handleDone = useCallback(() => {
    onComplete?.();
    onClose();
  }, [onComplete, onClose]);

  if (!open) return null;

  /* ============ PRO GATE ============ */
  if (!isPro) {
    return createPortal(
      <>
        <div style={OVERLAY_BG} onClick={onClose} />
        <div style={PANEL}>
          <div style={INNER}>
            <button style={CLOSE_BTN} onClick={onClose}><X size={18} /></button>
            <div style={CENTER}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
              <h2 style={TITLE}>Unlock AI Workout Converter</h2>
              <p style={{ ...SUB, marginBottom: 20 }}>
                Paste any training program and convert it into structured workout cards automatically
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", textAlign: "left", width: "100%" }}>
                {[
                  "Converts full programs into workout cards",
                  "Supports percentages, RPE, rep ranges",
                  "Auto-assigns dates to training days",
                  "Bulk create up to 100 workouts at once",
                ].map((t) => (
                  <li key={t} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", fontSize: 14, color: "rgba(255,255,255,0.85)" }}>
                    <Check size={16} style={{ color: "var(--accent)", flexShrink: 0 }} />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <button style={PRIMARY_BTN} onClick={() => { onClose(); navigate("/pro"); }}>
                Upgrade to Pro
              </button>
            </div>
          </div>
        </div>
      </>,
      document.body,
    );
  }

  /* ============ GENERATING ============ */
  if (phase === PHASE.GENERATING) {
    return createPortal(
      <>
        <style>{KEYFRAMES}</style>
        <div style={OVERLAY_BG} />
        <div style={PANEL}>
          <div style={INNER}>
            <div style={CENTER}>
              <div style={{ position: "relative", width: 80, height: 80, marginBottom: 32 }}>
                <div style={{
                  position: "absolute", inset: 0, borderRadius: "50%",
                  border: "3px solid transparent", borderTopColor: "var(--accent)",
                  animation: "wcSpin 1s linear infinite",
                }} />
                <div style={{
                  position: "absolute", inset: -8, borderRadius: "50%",
                  border: "2px solid rgba(255,255,255,0.06)",
                  animation: "wcPulse 2.4s ease-in-out infinite",
                }} />
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Zap size={24} color="var(--accent)" />
                </div>
              </div>
              <h2 style={{ ...TITLE, marginBottom: 24 }}>Converting program…</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%", maxWidth: 260 }}>
                {GEN_LABELS.map((label, i) => {
                  const done = i < genStep;
                  const active = i === genStep;
                  return (
                    <div key={label} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      fontSize: 14, fontWeight: 600,
                      color: done ? "var(--accent)" : active ? "#fff" : "rgba(255,255,255,0.3)",
                      transition: "color 0.4s ease, opacity 0.4s ease",
                      opacity: done || active ? 1 : 0.5,
                    }}>
                      {done ? (
                        <Check size={16} />
                      ) : active ? (
                        <span style={{ display: "inline-block", width: 16, textAlign: "center", animation: "wcDot 1.4s infinite" }}>●</span>
                      ) : (
                        <span style={{ display: "inline-block", width: 16, textAlign: "center" }}>○</span>
                      )}
                      <span>{label}{active ? "…" : ""}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </>,
      document.body,
    );
  }

  /* ============ COMPLETE ============ */
  if (phase === PHASE.COMPLETE) {
    return createPortal(
      <>
        <style>{KEYFRAMES}</style>
        <div style={OVERLAY_BG} onClick={handleDone} />
        <div style={PANEL}>
          <div style={INNER}>
            <button style={CLOSE_BTN} onClick={handleDone}><X size={18} /></button>
            <div style={{ ...CENTER, animation: "wcFadeUp .4s ease" }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
              <h2 style={TITLE}>Workouts Created</h2>
              <p style={SUB}>
                {createdCount} workout{createdCount !== 1 ? "s" : ""} added to your list with exercises.
              </p>
              <div style={BTN_STACK}>
                <button style={PRIMARY_BTN} onClick={handleDone}>
                  View Workouts
                </button>
                <button style={SECONDARY_BTN} onClick={handleDone}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </>,
      document.body,
    );
  }

  /* ============ INPUT ============ */
  return createPortal(
    <>
      <style>{KEYFRAMES}</style>
      <div style={OVERLAY_BG} onClick={onClose} />
      <div style={PANEL} onClick={(e) => e.stopPropagation()}>
        <div style={INNER}>
          <button style={CLOSE_BTN} onClick={onClose}><X size={18} /></button>

          <div style={{ paddingTop: 52, animation: "wcFadeUp .3s ease" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <Zap size={20} color="var(--accent)" />
              <h2 style={{ ...TITLE, margin: 0 }}>AI Workout Converter</h2>
            </div>
            <p style={{ ...SUB, marginBottom: 20 }}>
              Paste a training program and convert it into workout cards
            </p>

            {/* Program text */}
            <div style={{ marginBottom: 16 }}>
              <label style={LABEL}>Program description</label>
              <textarea
                value={programText}
                onChange={(e) => setProgramText(e.target.value)}
                placeholder={"Week 1 — Bench Press 80% 5x5\nWeek 2 — Bench Press 82.5% 5x4\nSquat 3x8-12 RPE 7\nHammer Curls 3x10-15"}
                rows={8}
                style={{ ...INPUT_TEXT, minHeight: 140 }}
              />
            </div>

            {/* Auto assign toggle */}
            <div style={{ marginBottom: 16 }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 14px", borderRadius: 12,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>
                  Auto assign dates
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoAssignDates}
                  onClick={() => setAutoAssignDates((v) => !v)}
                  style={{
                    width: 48, height: 26, borderRadius: 999, padding: 2,
                    display: "flex", alignItems: "center",
                    justifyContent: autoAssignDates ? "flex-end" : "flex-start",
                    background: autoAssignDates ? "var(--accent)" : "rgba(255,255,255,0.1)",
                    border: autoAssignDates ? "1px solid var(--accent)" : "1px solid rgba(255,255,255,0.2)",
                    cursor: "pointer", transition: "background 0.2s, justify-content 0.2s",
                  }}
                >
                  <span style={{ width: 20, height: 20, borderRadius: 999, background: "#fff" }} />
                </button>
              </div>
            </div>

            {autoAssignDates && (
              <>
                {/* Start date */}
                <div style={{ marginBottom: 16 }}>
                  <label style={LABEL}>Start date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={INPUT_TEXT}
                  />
                </div>

                {/* Training days */}
                <div style={{ marginBottom: 16 }}>
                  <label style={LABEL}>Training days</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {DAY_NAMES.map((name, idx) => {
                      const selected = trainingDays.includes(idx);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleDay(idx)}
                          style={{
                            padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                            cursor: "pointer", transition: "all 0.15s",
                            border: selected ? "1px solid var(--accent)" : "1px solid rgba(255,255,255,0.18)",
                            background: selected ? "var(--accent)" : "rgba(255,255,255,0.06)",
                            color: selected ? "#fff" : "rgba(255,255,255,0.6)",
                          }}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Max cards */}
            <div style={{ marginBottom: 16 }}>
              <label style={LABEL}>Max workouts to generate</label>
              <input
                type="number"
                min={1}
                max={100}
                value={maxCards}
                onChange={(e) => setMaxCards(Math.min(100, Math.max(1, Number(e.target.value) || 50)))}
                style={{ ...INPUT_TEXT, maxWidth: 120 }}
              />
            </div>

            {error && <div style={ERROR_BOX}>{error}</div>}

            <div style={BTN_STACK}>
              <button
                style={{
                  ...PRIMARY_BTN,
                  opacity: !programText.trim() ? 0.5 : 1,
                }}
                disabled={!programText.trim()}
                onClick={handleGenerate}
              >
                Generate Workouts
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
