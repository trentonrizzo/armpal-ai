import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { getDisplayText } from "../../utils/displayText";

function workoutsToProgramModel(workouts) {
  // Flatten workouts into weeks/days; if no explicit week/day info,
  // map sequentially.
  const weeks = [];
  let currentWeek = { weekNumber: 1, days: [] };
  workouts.forEach((w, index) => {
    const day = {
      dayNumber: index + 1,
      title: w.title || w.day_label || `Day ${index + 1}`,
      workout_card: {
        title: w.title || w.day_label || `Day ${index + 1}`,
        exercises: Array.isArray(w.exercises) ? w.exercises.map((ex) => ({ ...ex })) : [],
      },
    };
    currentWeek.days.push(day);
  });
  if (currentWeek.days.length) weeks.push(currentWeek);
  return { weeks };
}

export default function CreateProgram() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rawContent, setRawContent] = useState("");
  const [programModel, setProgramModel] = useState(null);
  const [convertError, setConvertError] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [priceInput, setPriceInput] = useState("15.99");
  const [userId, setUserId] = useState(null);
  const [difficulty, setDifficulty] = useState("Intermediate");
  const [saving, setSaving] = useState(false);
  const [programId, setProgramId] = useState(null);
  const [errorModal, setErrorModal] = useState(null);
  const [confirmConfig, setConfirmConfig] = useState(null);
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const LEVELS = ["Beginner", "Intermediate", "Advanced", "Elite"];

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.id) setUserId(user.id);
    });
  }, []);

  async function convertAI() {
    try {
      setIsConverting(true);
      setConvertError("");
      setProgramModel(null);

      const res = await fetch(`${window.location.origin}/api/ai/workout-converter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_text: rawContent,
          start_date: null,
          training_days: null,
          max_cards: 100,
          userId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || data?.message || "Convert failed");

      const workouts = data?.workouts;
      if (!Array.isArray(workouts) || workouts.length === 0) {
        setConvertError("No workouts detected. Try rephrasing your program.");
        return;
      }
      const model = workoutsToProgramModel(workouts);
      setProgramModel(model);
    } catch (e) {
      console.error(e);
      setConvertError(e.message || "Conversion failed");
    } finally {
      setIsConverting(false);
    }
  }

  function handlePriceChange(e) {
    let val = e.target.value;
    if (val === "") { setPriceInput(""); return; }
    if (!/^\d*\.?\d*$/.test(val)) return;
    const parts = val.split(".");
    parts[0] = parts[0].replace(/^0+(?=\d)/, "0");
    if (parts[0].length > 1 && parts[0].startsWith("0")) {
      parts[0] = parts[0].replace(/^0+/, "0");
    }
    setPriceInput(parts.join("."));
  }

  async function saveProgram(asPublish = false) {
    if (!title.trim()) {
      setErrorModal({
        title: "Missing title",
        message: "Enter a program title before saving.",
      });
      return;
    }
    if (!programModel || !Array.isArray(programModel.weeks) || programModel.weeks.length === 0) {
      setErrorModal({
        title: "No workouts yet",
        message: "Run Convert With AI and review the workouts before saving.",
      });
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) {
      setErrorModal({
        title: "Sign in required",
        message: "Sign in to save or publish your program.",
      });
      return;
    }

    const price = Number(priceInput) || 0;
    const programJsonWithMeta = {
      ...programModel,
      meta: {
        difficulty,
        tags: programModel.meta?.tags ?? [],
        days_per_week: daysPerWeek,
      },
    };

    setSaving(true);
    try {
      let result;
      if (!programId) {
        // First save: insert row
        const { data, error: insErr } = await supabase
          .from("programs")
          .insert({
            title,
            preview_description: description || null,
            parsed_program: null,
            program_json: programJsonWithMeta,
            is_ai_parsed: true,
            price,
            creator_id: uid,
            is_published: asPublish === true,
            is_draft: !asPublish,
            deleted: false,
          })
          .select("*")
          .single();
        if (insErr) throw insErr;
        result = data;
      } else {
        // Subsequent saves: update existing program
        const payload = {
          title,
          preview_description: description || null,
          program_json: programJsonWithMeta,
          price,
        };
        if (asPublish) {
          payload.is_draft = false;
          payload.is_published = true;
        } else {
          payload.is_draft = true;
        }
        const { data, error: updErr } = await supabase
          .from("programs")
          .update(payload)
          .eq("id", programId)
          .select("*")
          .single();
        if (updErr) throw updErr;
        result = data;
      }

      if (result?.id && !programId) {
        setProgramId(result.id);
      }

      window.dispatchEvent(new CustomEvent("ap_toast", {
        detail: {
          title: asPublish ? "Program published" : "Draft saved",
          body: "View in My Programs",
          action: { label: "Open", href: "/programs/my" },
        },
      }));
      navigate("/programs/my");
    } catch (e) {
      console.error("[CreateProgram] Save failed:", e?.message ?? e, e);
      setErrorModal({
        title: "Save failed",
        message: e?.message || "Something went wrong while saving your program.",
      });
    } finally {
      setSaving(false);
    }
  }

  const weeks = programModel?.weeks ?? [];

  return (
    <div style={{ padding: "16px 16px 90px", maxWidth: 560, margin: "0 auto" }}>
      <button type="button" onClick={() => navigate("/programs")} style={S.backBtn}>
        ← Programs
      </button>

      <h2 style={S.heading}>Create Program</h2>

      <input
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={S.input}
      />
      <input
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={S.input}
      />
      <div style={S.levelRow}>
        <span style={S.levelLabel}>Level</span>
        <div style={S.levelOptions}>
          {LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setDifficulty(l)}
              style={{ ...S.levelBtn, ...(difficulty === l ? S.levelBtnActive : {}) }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div style={S.levelRow}>
        <span style={S.levelLabel}>Days per week</span>
        <div style={S.levelOptions}>
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDaysPerWeek(d)}
              style={{
                ...S.levelBtn,
                ...(daysPerWeek === d ? S.levelBtnActive : {}),
              }}
            >
              {d} {d === 1 ? "Day" : "Days"}
            </button>
          ))}
        </div>
      </div>
      <input
        inputMode="decimal"
        value={priceInput}
        onChange={handlePriceChange}
        placeholder="Price"
        style={S.input}
      />

      {(() => {
        const platformFeePercent = 0.20;
        const stripePercent = 0.029;
        const stripeFixed = 0.30;
        const p = Number(priceInput) || 0;
        const stripeFee = p * stripePercent + stripeFixed;
        const platformFee = p * platformFeePercent;
        const creatorEarnings = p - stripeFee - platformFee;
        return (
          <div style={S.earningsBox}>
            <p style={{ margin: "0 0 6px", color: "var(--text)" }}>You set price: ${p.toFixed(2)}</p>
            <p style={{ margin: "0 0 6px", color: "var(--text-dim)" }}>ArmPal fee (20%): ${platformFee.toFixed(2)}</p>
            <p style={{ margin: "0 0 6px", color: "var(--text-dim)" }}>Stripe fee (est): ${stripeFee.toFixed(2)}</p>
            <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "10px 0" }} />
            <p style={{ margin: 0, color: "var(--text)" }}><strong>You earn ≈ ${creatorEarnings.toFixed(2)} per sale</strong></p>
          </div>
        );
      })()}

      <textarea
        placeholder={"Paste program here...\n\nSupports: rep ranges (8-12), percentages (80%), RPE, AMRAP, supersets, tempo, notes, multi-week layouts"}
        value={rawContent}
        onChange={(e) => setRawContent(e.target.value)}
        style={S.textarea}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <button
          type="button"
          onClick={convertAI}
          disabled={isConverting || !rawContent.trim()}
          style={{ ...S.primaryBtn, opacity: isConverting || !rawContent.trim() ? 0.6 : 1 }}
        >
          {isConverting ? "Converting…" : "Convert With AI ⚡"}
        </button>
        <button
          type="button"
          onClick={() => {
            // Start a blank manual program: one week, one empty day
            setProgramModel({
              weeks: [
                {
                  weekNumber: 1,
                  days: [
                    {
                      dayNumber: 1,
                      title: "Day 1",
                      workout_card: { title: "Day 1", exercises: [] },
                    },
                  ],
                },
              ],
            });
            setConvertError("");
          }}
          style={S.secondaryBtn}
        >
          Start Blank Program
        </button>
        <button
          type="button"
          onClick={() => saveProgram(false)}
          disabled={!programModel?.weeks?.length || saving}
          style={{ ...S.secondaryBtn, opacity: !programModel?.weeks?.length ? 0.5 : 1 }}
        >
          {saving ? "Saving…" : "Save Draft"}
        </button>
        <button
          type="button"
          onClick={() => saveProgram(true)}
          disabled={!programModel?.weeks?.length || saving}
          style={{ ...S.primaryBtn, opacity: !programModel?.weeks?.length ? 0.5 : 1 }}
        >
          {saving ? "Saving…" : "Publish"}
        </button>
      </div>

      {isConverting && (
        <div style={S.convertingOverlay}>
          <div style={S.convertingBox}>
            <p style={S.convertingText}>Converting…</p>
            <p style={S.convertingSub}>AI is structuring your program</p>
          </div>
        </div>
      )}

      {convertError && (
        <p style={{ margin: "0 0 12px", color: "var(--danger, #f55)", fontSize: 13 }}>
          {convertError}
        </p>
      )}

      {programModel && weeks.length > 0 && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px", color: "var(--text)" }}>
            Live Preview — {weeks.reduce((acc, w) => acc + w.days.length, 0)} workout day(s)
          </h3>

          {weeks.map((week, wIdx) => (
            <div key={week.weekNumber} style={{ marginBottom: 20 }}>
              <div style={S.weekLabel}>Week {week.weekNumber}</div>
              {week.days.map((day, dIdx) => (
                <div key={dIdx} style={S.dayCard}>
                  <h4 style={S.dayTitle}>{day.title}</h4>
                  {Array.isArray(day.workout_card?.exercises) && day.workout_card.exercises.length > 0 ? (
                    day.workout_card.exercises.map((ex, eIdx) => (
                      <div key={eIdx} style={S.exRow}>
                        <div style={S.exName}>{getDisplayText(ex)}</div>
                        <div style={S.editRow}>
                          <input
                            style={S.smallInput}
                            value={ex.name ?? ""}
                            placeholder="Exercise name"
                            onChange={(e) => {
                              const value = e.target.value;
                              setProgramModel((prev) => {
                                if (!prev) return prev;
                                const weeksCopy = prev.weeks.map((w, wi) => {
                                  if (wi !== wIdx) return w;
                                  const days = w.days.map((d, di) => {
                                    if (di !== dIdx) return d;
                                    const exercises = Array.isArray(d.workout_card?.exercises)
                                      ? d.workout_card.exercises.map((ex2, xi) =>
                                          xi === eIdx ? { ...ex2, name: value } : ex2
                                        )
                                      : [];
                                    return {
                                      ...d,
                                      workout_card: { ...(d.workout_card || {}), exercises },
                                    };
                                  });
                                  return { ...w, days };
                                });
                                return { ...prev, weeks: weeksCopy };
                              });
                            }}
                          />
                          <input
                            type="number"
                            style={S.smallInput}
                            value={ex.sets ?? ""}
                            placeholder="Sets"
                            onChange={(e) => {
                              const value = e.target.value === "" ? null : Number(e.target.value);
                              setProgramModel((prev) => {
                                if (!prev) return prev;
                                const weeksCopy = prev.weeks.map((w, wi) => {
                                  if (wi !== wIdx) return w;
                                  const days = w.days.map((d, di) => {
                                    if (di !== dIdx) return d;
                                    const exercises = Array.isArray(d.workout_card?.exercises)
                                      ? d.workout_card.exercises.map((ex2, xi) =>
                                          xi === eIdx ? { ...ex2, sets: value } : ex2
                                        )
                                      : [];
                                    return {
                                      ...d,
                                      workout_card: { ...(d.workout_card || {}), exercises },
                                    };
                                  });
                                  return { ...w, days };
                                });
                                return { ...prev, weeks: weeksCopy };
                              });
                            }}
                          />
                          <input
                            type="number"
                            style={S.smallInput}
                            value={ex.reps ?? ""}
                            placeholder="Reps"
                            onChange={(e) => {
                              const value = e.target.value === "" ? null : Number(e.target.value);
                              setProgramModel((prev) => {
                                if (!prev) return prev;
                                const weeksCopy = prev.weeks.map((w, wi) => {
                                  if (wi !== wIdx) return w;
                                  const days = w.days.map((d, di) => {
                                    if (di !== dIdx) return d;
                                    const exercises = Array.isArray(d.workout_card?.exercises)
                                      ? d.workout_card.exercises.map((ex2, xi) =>
                                          xi === eIdx ? { ...ex2, reps: value } : ex2
                                        )
                                      : [];
                                    return {
                                      ...d,
                                      workout_card: { ...(d.workout_card || {}), exercises },
                                    };
                                  });
                                  return { ...w, days };
                                });
                                return { ...prev, weeks: weeksCopy };
                              });
                            }}
                          />
                          <input
                            type="text"
                            style={S.smallInput}
                            value={ex.percentage ?? ""}
                            placeholder="%"
                            onChange={(e) => {
                              const value = e.target.value;
                              setProgramModel((prev) => {
                                if (!prev) return prev;
                                const weeksCopy = prev.weeks.map((w, wi) => {
                                  if (wi !== wIdx) return w;
                                  const days = w.days.map((d, di) => {
                                    if (di !== dIdx) return d;
                                    const exercises = Array.isArray(d.workout_card?.exercises)
                                      ? d.workout_card.exercises.map((ex2, xi) =>
                                          xi === eIdx ? { ...ex2, percentage: value } : ex2
                                        )
                                      : [];
                                    return {
                                      ...d,
                                      workout_card: { ...(d.workout_card || {}), exercises },
                                    };
                                  });
                                  return { ...w, days };
                                });
                                return { ...prev, weeks: weeksCopy };
                              });
                            }}
                          />
                          <input
                            type="text"
                            style={S.smallInput}
                            value={ex.rpe ?? ""}
                            placeholder="RPE"
                            onChange={(e) => {
                              const value = e.target.value;
                              setProgramModel((prev) => {
                                if (!prev) return prev;
                                const weeksCopy = prev.weeks.map((w, wi) => {
                                  if (wi !== wIdx) return w;
                                  const days = w.days.map((d, di) => {
                                    if (di !== dIdx) return d;
                                    const exercises = Array.isArray(d.workout_card?.exercises)
                                      ? d.workout_card.exercises.map((ex2, xi) =>
                                          xi === eIdx ? { ...ex2, rpe: value } : ex2
                                        )
                                      : [];
                                    return {
                                      ...d,
                                      workout_card: { ...(d.workout_card || {}), exercises },
                                    };
                                  });
                                  return { ...w, days };
                                });
                                return { ...prev, weeks: weeksCopy };
                              });
                            }}
                          />
                          <button
                            type="button"
                      style={S.smallDangerBtn}
                      onClick={() => {
                        setConfirmConfig({
                          title: "Delete exercise?",
                          message: "This exercise will be removed from the day.",
                          onConfirm: () => {
                            setProgramModel((prev) => {
                              if (!prev) return prev;
                              const weeksCopy = prev.weeks.map((w, wi) => {
                                if (wi !== wIdx) return w;
                                const days = w.days.map((d, di) => {
                                  if (di !== dIdx) return d;
                                  const exercises = Array.isArray(d.workout_card?.exercises)
                                    ? d.workout_card.exercises.filter((_, xi) => xi !== eIdx)
                                    : [];
                                  return {
                                    ...d,
                                    workout_card: { ...(d.workout_card || {}), exercises },
                                  };
                                });
                                return { ...w, days };
                              });
                              return { ...prev, weeks: weeksCopy };
                            });
                            setConfirmConfig(null);
                          },
                        });
                      }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p style={{ fontSize: 13, color: "var(--text-dim)", margin: 0 }}>No exercises listed.</p>
                  )}
                  <button
                    type="button"
                    style={S.smallAddBtn}
                    onClick={() => {
                      setProgramModel((prev) => {
                        if (!prev) return prev;
                        const weeksCopy = prev.weeks.map((w, wi) => {
                          if (wi !== wIdx) return w;
                          const days = w.days.map((d, di) => {
                            if (di !== dIdx) return d;
                            const exercises = Array.isArray(d.workout_card?.exercises)
                              ? [...d.workout_card.exercises]
                              : [];
                            exercises.push({
                              name: "",
                              sets: null,
                              reps: null,
                              weight: null,
                              input: "",
                            });
                            return {
                              ...d,
                              workout_card: { ...(d.workout_card || {}), exercises },
                            };
                          });
                          return { ...w, days };
                        });
                        return { ...prev, weeks: weeksCopy };
                      });
                    }}
                  >
                    + Add Exercise
                  </button>
                  <button
                    type="button"
                    style={S.smallDangerOutlineBtn}
                    onClick={() => {
                      setConfirmConfig({
                        title: "Delete workout day?",
                        message: "This workout day and its exercises will be removed.",
                        onConfirm: () => {
                          setProgramModel((prev) => {
                            if (!prev) return prev;
                            const weeksCopy = prev.weeks.map((w, wi) => {
                              if (wi !== wIdx) return w;
                              const days = w.days.filter((_, di) => di !== dIdx);
                              return { ...w, days };
                            });
                            return { ...prev, weeks: weeksCopy };
                          });
                          setConfirmConfig(null);
                        },
                      });
                    }}
                  >
                    Delete Day
                  </button>
                </div>
              ))}
              <button
                type="button"
                style={S.smallAddBtn}
                onClick={() => {
                  setProgramModel((prev) => {
                    if (!prev) return prev;
                    const weeksCopy = prev.weeks.map((w, wi) => {
                      if (wi !== wIdx) return w;
                      const nextDayNumber =
                        (w.days[w.days.length - 1]?.dayNumber || w.days.length) + 1;
                      const title = `Day ${nextDayNumber}`;
                      const newDay = {
                        dayNumber: nextDayNumber,
                        title,
                        workout_card: { title, exercises: [] },
                      };
                      return { ...w, days: [...w.days, newDay] };
                    });
                    return { ...prev, weeks: weeksCopy };
                  });
                }}
              >
                + Add Workout Day
              </button>
            </div>
          ))}
        </div>
      )}

      {errorModal && (
        <div style={S.modalBackdrop} onClick={() => setErrorModal(null)}>
          <div style={S.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={S.modalTitle}>{errorModal.title}</h3>
            <p style={S.modalBody}>{errorModal.message}</p>
            <button
              type="button"
              style={S.primaryBtn}
              onClick={() => setErrorModal(null)}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {confirmConfig && (
        <div style={S.modalBackdrop} onClick={() => setConfirmConfig(null)}>
          <div style={S.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={S.modalTitle}>{confirmConfig.title}</h3>
            <p style={S.modalBody}>{confirmConfig.message}</p>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                type="button"
                style={S.secondaryBtn}
                onClick={() => setConfirmConfig(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                style={S.primaryBtn}
                onClick={() => {
                  confirmConfig.onConfirm?.();
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  backBtn: { marginBottom: 16, background: "none", border: "none", color: "var(--text-dim)", fontSize: 14, cursor: "pointer" },
  heading: { fontSize: 20, fontWeight: 800, margin: "0 0 16px", color: "var(--text)" },
  levelRow: { marginBottom: 16 },
  levelLabel: { display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-dim)", marginBottom: 8 },
  levelOptions: { display: "flex", flexWrap: "wrap", gap: 8 },
  levelBtn: { padding: "8px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--card-2)", color: "var(--text)", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  levelBtnActive: { background: "var(--accent)", borderColor: "var(--accent)" },
  convertingOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 },
  convertingBox: { background: "var(--card)", borderRadius: 16, padding: 24, border: "1px solid var(--border)", textAlign: "center", minWidth: 200 },
  convertingText: { margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "var(--text)" },
  convertingSub: { margin: 0, fontSize: 13, color: "var(--text-dim)" },
  input: { width: "100%", padding: 10, marginBottom: 12, background: "var(--card-2)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 14, boxSizing: "border-box" },
  textarea: { width: "100%", padding: 10, marginBottom: 12, minHeight: 140, background: "var(--card-2)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 14, boxSizing: "border-box", resize: "vertical" },
  earningsBox: { marginBottom: 24, padding: 14, background: "var(--card-2)", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14 },
  primaryBtn: { padding: "12px 18px", borderRadius: 12, border: "none", background: "var(--accent)", color: "var(--text)", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  secondaryBtn: { padding: "12px 18px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--card-2)", color: "var(--text)", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  weekLabel: { fontSize: 14, fontWeight: 800, color: "var(--accent)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  dayCard: { marginBottom: 12, padding: 14, borderRadius: 14, border: "1px solid var(--border)", background: "var(--card-2)" },
  dayTitle: { margin: "0 0 8px", fontSize: 15, fontWeight: 700, color: "var(--text)" },
  exRow: { marginBottom: 6, paddingLeft: 8, borderLeft: "2px solid var(--border)" },
  supersetRow: { borderLeftColor: "var(--accent)", background: "color-mix(in srgb, var(--accent) 6%, transparent)", borderRadius: 6, padding: "4px 8px", marginLeft: 0 },
  exName: { fontSize: 14, fontWeight: 600, color: "var(--text)" },
  exDetail: { fontSize: 12, color: "var(--text-dim)", marginTop: 2 },
  editRow: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 },
  smallInput: { flex: "1 0 80px", minWidth: 80, padding: 6, borderRadius: 8, border: "1px solid var(--border)", background: "var(--card-2)", color: "var(--text)", fontSize: 12 },
  smallAddBtn: { marginTop: 8, padding: "6px 10px", borderRadius: 999, border: "1px solid var(--border)", background: "var(--card-2)", color: "var(--text)", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  smallDangerBtn: { padding: "6px 10px", borderRadius: 999, border: "1px solid var(--accent)", background: "transparent", color: "var(--accent)", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  smallDangerOutlineBtn: { marginTop: 8, padding: "6px 10px", borderRadius: 999, border: "1px solid var(--accent)", background: "transparent", color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  modalBackdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 10001 },
  modalCard: { background: "var(--card-2)", borderRadius: 16, border: "1px solid var(--border)", padding: 20, maxWidth: 360, width: "100%", boxShadow: "0 18px 40px rgba(0,0,0,0.6)" },
  modalTitle: { margin: "0 0 8px", fontSize: 16, fontWeight: 800, color: "var(--text)" },
  modalBody: { margin: "0 0 14px", fontSize: 13, color: "var(--text-dim)" },
};
