import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { addEntry } from "./nutritionService";
import imageCompression from "browser-image-compression";
import { Camera, X, ChevronLeft, Check, AlertTriangle } from "lucide-react";

const STEP = {
  PICK_IMAGE: "PICK_IMAGE",
  PREVIEW: "PREVIEW",
  ANALYZING: "ANALYZING",
  RESULTS: "RESULTS",
  EDIT: "EDIT",
};

const ANALYSIS_LABELS = [
  "Detecting foods",
  "Estimating portions",
  "Calculating macros",
];

/* ============================================================
   CSS KEYFRAMES (injected inside portal)
   ============================================================ */
const KEYFRAMES = `
@keyframes fsSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes fsPulse{0%,100%{opacity:.25;transform:scale(.92)}50%{opacity:.5;transform:scale(1.08)}}
@keyframes fsFadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes fsDot{0%,80%,100%{opacity:.25}40%{opacity:1}}
`;

/* ============================================================
   SHARED INLINE STYLES
   ============================================================ */
const OVERLAY_BG = {
  position: "fixed",
  inset: 0,
  zIndex: 10000,
  background: "rgba(0,0,0,0.92)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
};
const PANEL = {
  position: "fixed",
  inset: 0,
  zIndex: 10001,
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
};
const INNER = {
  maxWidth: 480,
  width: "100%",
  margin: "0 auto",
  padding: "20px 16px",
  paddingTop: "calc(20px + env(safe-area-inset-top, 0px))",
  paddingBottom: "calc(40px + env(safe-area-inset-bottom, 0px))",
  minHeight: "100%",
  display: "flex",
  flexDirection: "column",
  position: "relative",
};
const CLOSE_BTN = {
  position: "absolute",
  top: "calc(16px + env(safe-area-inset-top, 0px))",
  right: 16,
  width: 36,
  height: 36,
  borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.15)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  zIndex: 10,
};
const CENTER = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  padding: "40px 0",
};
const ICON_CIRCLE = {
  width: 72,
  height: 72,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 20,
};
const TITLE = {
  fontSize: 22,
  fontWeight: 800,
  color: "#fff",
  margin: "0 0 8px",
};
const SUB = {
  fontSize: 14,
  color: "rgba(255,255,255,0.6)",
  margin: "0 0 28px",
  lineHeight: 1.5,
  maxWidth: 300,
};
const BTN_STACK = { display: "flex", flexDirection: "column", gap: 10, width: "100%", marginTop: 16 };
const PRIMARY_BTN = {
  width: "100%",
  padding: "14px 20px",
  borderRadius: 12,
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
};
const SECONDARY_BTN = {
  width: "100%",
  padding: "14px 20px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
};
const ERROR_BOX = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  background: "rgba(255,80,80,0.12)",
  border: "1px solid rgba(255,80,80,0.3)",
  color: "#ff6b6b",
  fontSize: 13,
  fontWeight: 600,
  marginTop: 12,
  textAlign: "left",
};
const IMG_WRAP = {
  width: "100%",
  maxHeight: 320,
  borderRadius: 16,
  overflow: "hidden",
  marginBottom: 20,
  border: "1px solid rgba(255,255,255,0.1)",
};
const IMG_STYLE = {
  width: "100%",
  height: "100%",
  maxHeight: 320,
  objectFit: "cover",
  display: "block",
};
const CARD = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 14,
  padding: 14,
  marginBottom: 10,
};
const TOTALS_CARD = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 14,
  padding: "14px 16px",
  marginTop: 16,
};
const EDIT_INPUT = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  fontSize: 14,
};
const EDIT_LABEL = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "rgba(255,255,255,0.5)",
  marginBottom: 4,
};
const DISCLAIMER = {
  display: "flex",
  gap: 8,
  alignItems: "flex-start",
  fontSize: 12,
  color: "rgba(255,255,255,0.5)",
  marginTop: 12,
  padding: "10px 12px",
  borderRadius: 10,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
};

function confidenceColor(c) {
  if (c === "high") return "#4caf50";
  if (c === "medium") return "#ff9800";
  return "#f44336";
}

/* ============================================================
   COMPONENT
   ============================================================ */
export default function SmartFoodScanOverlay({
  open,
  onClose,
  userId,
  selectedDate,
  isPro,
  onSaved,
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState(STEP.PICK_IMAGE);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imagePath, setImagePath] = useState(null);
  const [results, setResults] = useState(null);
  const [editFoods, setEditFoods] = useState([]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [analysisIdx, setAnalysisIdx] = useState(0);
  const cameraRef = useRef(null);
  const libraryRef = useRef(null);

  // ---- reset on close ----
  useEffect(() => {
    if (open) return;
    const prev = imagePreview;
    setStep(STEP.PICK_IMAGE);
    setImageFile(null);
    setImagePreview(null);
    setImagePath(null);
    setResults(null);
    setEditFoods([]);
    setError(null);
    setSaving(false);
    setAnalysisIdx(0);
    if (prev) URL.revokeObjectURL(prev);
  }, [open]);

  // ---- ESC to close ----
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  // ---- analysis step ticker ----
  useEffect(() => {
    if (step !== STEP.ANALYZING) return;
    setAnalysisIdx(0);
    const iv = setInterval(() => {
      setAnalysisIdx((p) => (p < 2 ? p + 1 : p));
    }, 2200);
    return () => clearInterval(iv);
  }, [step]);

  /* ---- image select ---- */
  const handleImageSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(URL.createObjectURL(file));
    setImagePath(null);
    setStep(STEP.PREVIEW);
    setError(null);
    e.target.value = "";
  }, [imagePreview]);

  /* ---- use photo (upload + analyze) ---- */
  const handleUsePhoto = useCallback(async () => {
    if (!imageFile || !userId) return;
    setStep(STEP.ANALYZING);
    setError(null);

    try {
      let path = imagePath;

      if (!path) {
        const compressed = await imageCompression(imageFile, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        });
        const rand = Math.random().toString(36).slice(2, 10);
        const ext = compressed.type === "image/png" ? "png" : "jpg";
        path = `${userId}/${selectedDate}/${rand}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("food_scan_images")
          .upload(path, compressed, {
            contentType: compressed.type || "image/jpeg",
            upsert: false,
          });

        if (upErr) throw new Error("Image upload failed. " + upErr.message);
        setImagePath(path);
      }

      const res = await fetch(
        `${window.location.origin}/api/ai/food-scan`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imagePath: path, userId, mealDate: selectedDate }),
        }
      );

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || d.error || "Analysis failed");
      }

      const data = await res.json();
      setResults(data);
      setEditFoods(
        (data.foods || []).map((f, i) => ({
          ...f,
          _key: i,
          calories: Math.round(Number(f.calories) || 0),
          protein: Math.round(Number(f.protein) || 0),
          carbs: Math.round(Number(f.carbs) || 0),
          fat: Math.round(Number(f.fat) || 0),
        }))
      );
      setStep(STEP.RESULTS);
    } catch (err) {
      console.error("Food scan error:", err);
      setError(err.message || "Something went wrong. Please try again.");
      setStep(STEP.PREVIEW);
    }
  }, [imageFile, userId, selectedDate, imagePath]);

  /* ---- choose different ---- */
  const handleChooseDifferent = useCallback(() => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    setImagePath(null);
    setError(null);
    setStep(STEP.PICK_IMAGE);
  }, [imagePreview]);

  /* ---- compute totals from editFoods ---- */
  const computeTotals = useCallback(() => {
    const t = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    for (const f of editFoods) {
      t.calories += Math.round(Number(f.calories) || 0);
      t.protein += Math.round(Number(f.protein) || 0);
      t.carbs += Math.round(Number(f.carbs) || 0);
      t.fat += Math.round(Number(f.fat) || 0);
    }
    return t;
  }, [editFoods]);

  /* ---- edit helpers ---- */
  const handleEditField = useCallback((idx, field, val) => {
    setEditFoods((p) => p.map((f, i) => (i === idx ? { ...f, [field]: val } : f)));
  }, []);
  const handleRemoveFood = useCallback((idx) => {
    setEditFoods((p) => p.filter((_, i) => i !== idx));
  }, []);

  /* ---- save ---- */
  const handleSave = useCallback(async () => {
    if (!userId || !selectedDate || editFoods.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      for (const food of editFoods) {
        await addEntry({
          user_id: userId,
          date: selectedDate,
          food_name: food.name || "Unknown food",
          calories: Math.round(Number(food.calories) || 0),
          protein: Math.round(Number(food.protein) || 0),
          carbs: Math.round(Number(food.carbs) || 0),
          fat: Math.round(Number(food.fat) || 0),
          notes: `AI Scan${food.estimated_amount ? " · " + food.estimated_amount : ""}`,
        });
      }
      onSaved?.();
      onClose();
    } catch (err) {
      console.error("Save scan entries:", err);
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [userId, selectedDate, editFoods, onSaved, onClose]);

  /* ---- date label ---- */
  const dateLabel = (() => {
    const today = new Date().toISOString().slice(0, 10);
    if (selectedDate === today) return "Today";
    const d = new Date(selectedDate + "T12:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  })();

  if (!open) return null;

  /* ================================================================
     PRO GATE
     ================================================================ */
  if (!isPro) {
    return createPortal(
      <>
        <div style={OVERLAY_BG} onClick={onClose} />
        <div style={PANEL}>
          <div style={INNER}>
            <button style={CLOSE_BTN} onClick={onClose}><X size={18} /></button>
            <div style={CENTER}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
              <h2 style={TITLE}>Unlock Smart AI Food Scan</h2>
              <p style={{ ...SUB, marginBottom: 20 }}>
                Scan any meal with AI to instantly track nutrition
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", textAlign: "left", width: "100%" }}>
                {[
                  "Automatic food detection from photos",
                  "Instant calorie & macro estimation",
                  "One-tap nutrition logging",
                  "Save hours of manual entry",
                ].map((t) => (
                  <li key={t} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", fontSize: 14, color: "rgba(255,255,255,0.85)" }}>
                    <Check size={16} style={{ color: "var(--accent)", flexShrink: 0 }} />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <button
                style={PRIMARY_BTN}
                onClick={() => { onClose(); navigate("/pro"); }}
              >
                Upgrade to Pro
              </button>
            </div>
          </div>
        </div>
      </>,
      document.body,
    );
  }

  /* ================================================================
     SCAN FLOW
     ================================================================ */
  const totals = step === STEP.EDIT ? computeTotals() : results?.totals;

  return createPortal(
    <>
      <style>{KEYFRAMES}</style>
      <div style={OVERLAY_BG} onClick={step !== STEP.ANALYZING ? onClose : undefined} />
      <div style={PANEL} onClick={(e) => e.stopPropagation()}>
        <div style={INNER}>
          {/* hidden inputs */}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={cameraRef}
            onChange={handleImageSelect}
            style={{ display: "none" }}
          />
          <input
            type="file"
            accept="image/*"
            ref={libraryRef}
            onChange={handleImageSelect}
            style={{ display: "none" }}
          />

          {step !== STEP.ANALYZING && (
            <button style={CLOSE_BTN} onClick={onClose}><X size={18} /></button>
          )}

          {/* ======== PICK IMAGE ======== */}
          {step === STEP.PICK_IMAGE && (
            <div style={CENTER}>
              <div style={ICON_CIRCLE}>
                <Camera size={30} color="var(--accent)" />
              </div>
              <h2 style={TITLE}>Smart Food Scan</h2>
              <p style={SUB}>
                Take a photo of your meal and AI will estimate the nutrition instantly
              </p>
              {error && <div style={ERROR_BOX}>{error}</div>}
              <div style={BTN_STACK}>
                <button style={PRIMARY_BTN} onClick={() => cameraRef.current?.click()}>
                  📷&ensp;Take Photo
                </button>
                <button style={SECONDARY_BTN} onClick={() => libraryRef.current?.click()}>
                  🖼️&ensp;Choose from Library
                </button>
              </div>
            </div>
          )}

          {/* ======== PREVIEW ======== */}
          {step === STEP.PREVIEW && (
            <div style={{ ...CENTER, justifyContent: "flex-start", paddingTop: 56 }}>
              <h2 style={{ ...TITLE, marginBottom: 16 }}>Preview</h2>
              {imagePreview && (
                <div style={IMG_WRAP}>
                  <img src={imagePreview} alt="Food preview" style={IMG_STYLE} />
                </div>
              )}
              {error && <div style={ERROR_BOX}>{error}</div>}
              <div style={BTN_STACK}>
                <button style={PRIMARY_BTN} onClick={handleUsePhoto}>
                  ✓&ensp;Use This Photo
                </button>
                <button style={SECONDARY_BTN} onClick={handleChooseDifferent}>
                  ←&ensp;Choose Different
                </button>
              </div>
            </div>
          )}

          {/* ======== ANALYZING ======== */}
          {step === STEP.ANALYZING && (
            <div style={CENTER}>
              {/* spinner ring */}
              <div style={{ position: "relative", width: 80, height: 80, marginBottom: 32 }}>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    border: "3px solid transparent",
                    borderTopColor: "var(--accent)",
                    animation: "fsSpin 1s linear infinite",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: -8,
                    borderRadius: "50%",
                    border: "2px solid rgba(255,255,255,0.06)",
                    animation: "fsPulse 2.4s ease-in-out infinite",
                  }}
                />
                <div style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Camera size={24} color="var(--accent)" />
                </div>
              </div>

              <h2 style={{ ...TITLE, marginBottom: 24 }}>Analyzing your meal…</h2>

              <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%", maxWidth: 240 }}>
                {ANALYSIS_LABELS.map((label, i) => {
                  const done = i < analysisIdx;
                  const active = i === analysisIdx;
                  return (
                    <div
                      key={label}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        fontSize: 14,
                        fontWeight: 600,
                        color: done ? "var(--accent)" : active ? "#fff" : "rgba(255,255,255,0.3)",
                        transition: "color 0.4s ease, opacity 0.4s ease",
                        opacity: done || active ? 1 : 0.5,
                      }}
                    >
                      {done ? (
                        <Check size={16} />
                      ) : active ? (
                        <span style={{ display: "inline-block", width: 16, textAlign: "center", animation: "fsDot 1.4s infinite" }}>●</span>
                      ) : (
                        <span style={{ display: "inline-block", width: 16, textAlign: "center" }}>○</span>
                      )}
                      <span>{label}{active ? "…" : ""}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ======== RESULTS ======== */}
          {step === STEP.RESULTS && results && (
            <div style={{ paddingTop: 52, animation: "fsFadeUp .4s ease" }}>
              <h2 style={TITLE}>Results</h2>

              {results.confidence && (
                <span
                  style={{
                    display: "inline-block",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: 6,
                    background: `${confidenceColor(results.confidence)}22`,
                    color: confidenceColor(results.confidence),
                    marginBottom: 16,
                  }}
                >
                  {results.confidence.charAt(0).toUpperCase() + results.confidence.slice(1)} confidence
                </span>
              )}

              {/* food list */}
              <div style={{ marginTop: 8 }}>
                {editFoods.length === 0 && (
                  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>No foods detected.</p>
                )}
                {editFoods.map((food) => (
                  <div key={food._key} style={CARD}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2, color: "#fff" }}>
                      {food.name}
                    </div>
                    {food.estimated_amount && (
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>
                        {food.estimated_amount}
                      </div>
                    )}
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                      {food.calories} cal&ensp;·&ensp;P {food.protein}g&ensp;·&ensp;C {food.carbs}g&ensp;·&ensp;F {food.fat}g
                    </div>
                  </div>
                ))}
              </div>

              {/* totals */}
              {totals && (
                <div style={TOTALS_CARD}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
                    Totals
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    {[
                      { l: "Calories", v: totals.calories },
                      { l: "Protein", v: `${totals.protein}g` },
                      { l: "Carbs", v: `${totals.carbs}g` },
                      { l: "Fat", v: `${totals.fat}g` },
                    ].map((t) => (
                      <div key={t.l} style={{ textAlign: "center", minWidth: 60 }}>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>{t.l}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{t.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {results.notes && (
                <div style={DISCLAIMER}>
                  <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{results.notes}</span>
                </div>
              )}

              {error && <div style={ERROR_BOX}>{error}</div>}

              <div style={BTN_STACK}>
                <button
                  style={{ ...PRIMARY_BTN, opacity: saving || editFoods.length === 0 ? 0.6 : 1 }}
                  onClick={handleSave}
                  disabled={saving || editFoods.length === 0}
                >
                  {saving ? "Saving…" : `Save to ${dateLabel}`}
                </button>
                <button style={SECONDARY_BTN} onClick={() => setStep(STEP.EDIT)}>
                  Edit
                </button>
              </div>
            </div>
          )}

          {/* ======== EDIT ======== */}
          {step === STEP.EDIT && (
            <div style={{ paddingTop: 52, animation: "fsFadeUp .3s ease" }}>
              <button
                onClick={() => setStep(STEP.RESULTS)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  background: "none",
                  border: "none",
                  color: "var(--accent)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: 0,
                  marginBottom: 12,
                }}
              >
                <ChevronLeft size={18} /> Back
              </button>

              <h2 style={{ ...TITLE, marginBottom: 16 }}>Edit Foods</h2>

              {editFoods.length === 0 && (
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>All foods removed.</p>
              )}

              {editFoods.map((food, i) => (
                <div key={food._key} style={{ ...CARD, padding: 16 }}>
                  <div style={{ marginBottom: 10 }}>
                    <label style={EDIT_LABEL}>Name</label>
                    <input
                      type="text"
                      value={food.name}
                      onChange={(e) => handleEditField(i, "name", e.target.value)}
                      style={EDIT_INPUT}
                    />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={EDIT_LABEL}>Amount</label>
                    <input
                      type="text"
                      value={food.estimated_amount || ""}
                      onChange={(e) => handleEditField(i, "estimated_amount", e.target.value)}
                      style={EDIT_INPUT}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                    {[
                      { f: "calories", l: "Cal" },
                      { f: "protein", l: "Protein" },
                      { f: "carbs", l: "Carbs" },
                      { f: "fat", l: "Fat" },
                    ].map(({ f, l }) => (
                      <div key={f}>
                        <label style={EDIT_LABEL}>{l}</label>
                        <input
                          type="number"
                          min={0}
                          value={food[f]}
                          onChange={(e) => handleEditField(i, f, e.target.value)}
                          style={EDIT_INPUT}
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => handleRemoveFood(i)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,80,80,0.3)",
                      background: "rgba(255,80,80,0.08)",
                      color: "#ff6b6b",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}

              {/* live totals */}
              {editFoods.length > 0 && (() => {
                const t = computeTotals();
                return (
                  <div style={TOTALS_CARD}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
                      Totals
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                      {[
                        { l: "Cal", v: t.calories },
                        { l: "P", v: `${t.protein}g` },
                        { l: "C", v: `${t.carbs}g` },
                        { l: "F", v: `${t.fat}g` },
                      ].map((x) => (
                        <div key={x.l} style={{ textAlign: "center", minWidth: 50 }}>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 2 }}>{x.l}</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{x.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {error && <div style={ERROR_BOX}>{error}</div>}

              <div style={{ ...BTN_STACK, marginTop: 20 }}>
                <button
                  style={{ ...PRIMARY_BTN, opacity: saving || editFoods.length === 0 ? 0.6 : 1 }}
                  onClick={handleSave}
                  disabled={saving || editFoods.length === 0}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
