import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
  const [programJson, setProgramJson] = useState({ splits: {} });
  const LEVELS = ["Beginner", "Intermediate", "Advanced", "Elite"];
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.id) setUserId(user.id);
    });
  }, []);

  // Load an existing program for edit when navigated with { state: { programId } }
  useEffect(() => {
    const state = location.state || {};
    const editProgramId = state.programId;
    if (!editProgramId) return;

    let alive = true;

    (async () => {
      const { data: prog, error } = await supabase
        .from("programs")
        .select("*")
        .eq("id", editProgramId)
        .maybeSingle();

      if (!alive) return;
      if (error || !prog) {
        console.error("[CreateProgram] Failed to load program for edit", error);
        return;
      }

      setProgramId(prog.id);
      setTitle(prog.title || "");
      setDescription(
        prog.preview_description || prog.program_json?.meta?.description || ""
      );
      setPriceInput(
        prog.price != null && !Number.isNaN(Number(prog.price))
          ? String(Number(prog.price).toFixed(2))
          : "0.00"
      );

      const meta = prog.program_json?.meta || {};
      if (meta.difficulty && LEVELS.includes(meta.difficulty)) {
        setDifficulty(meta.difficulty);
      }

      const existingJson = prog.program_json || {};
      let splits = existingJson.splits;

      if (!splits || typeof splits !== "object") {
        const legacyWeeks = Array.isArray(existingJson.weeks)
          ? existingJson.weeks
          : [];
        const inferredDays =
          legacyWeeks[0]?.days?.length ||
          existingJson.meta?.days_per_week ||
          daysPerWeek ||
          3;

        splits = {
          [String(inferredDays)]: {
            title: existingJson.meta?.title || `${inferredDays}-Day Split`,
            weeks:
              legacyWeeks.length > 0
                ? legacyWeeks
                : [
                    {
                      weekNumber: 1,
                      days: Array.from({ length: inferredDays }, (_v, i) => {
                        const dayNum = i + 1;
                        const name = `Day ${dayNum}`;
                        return {
                          dayNumber: dayNum,
                          title: name,
                          workout_card: { title: name, exercises: [] },
                        };
                      }),
                    },
                  ],
          },
        };
      }

      setProgramJson({
        ...existingJson,
        splits,
      });

      const splitKeys = Object.keys(splits);
      if (splitKeys.length) {
        const primary = Number(splitKeys[0]) || 3;
        setDaysPerWeek(primary);
      }
    })();

    return () => {
      alive = false;
    };
  }, [location.state, LEVELS, daysPerWeek]);

  function hasAnyContent(json) {
    const splits = json?.splits || {};
    return Object.values(splits).some(
      (split) =>
        Array.isArray(split.weeks) &&
        split.weeks.some(
          (w) => Array.isArray(w.days) && w.days.length > 0
        )
    );
  }

  function ensureSplit(days) {
    const key = String(days);
    setProgramJson((prev) => {
      const prevSplits = prev?.splits || {};
      if (prevSplits[key]) return prev;

      const newWeek = {
        weekNumber: 1,
        days: Array.from({ length: days }, (_v, i) => {
          const dayNum = i + 1;
          const name = `Day ${dayNum}`;
          return {
            dayNumber: dayNum,
            title: name,
            workout_card: { title: name, exercises: [] },
          };
        }),
      };

      return {
        ...prev,
        splits: {
          ...prevSplits,
          [key]: {
            title: `${days}-Day Split`,
            weeks: [newWeek],
          },
        },
      };
    });
  }

  function updateSplit(splitKey, updater) {
    setProgramJson((prev) => {
      if (!prev) return prev;
      const prevSplits = prev.splits || {};
      const existing = prevSplits[splitKey];
      if (!existing) return prev;
      const updated = updater(existing);
      return {
        ...prev,
        splits: {
          ...prevSplits,
          [splitKey]: updated,
        },
      };
    });
  }

  async function convertAI() {
    try {
      setIsConverting(true);
      setConvertError("");

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
      const weeks = Array.isArray(model.weeks) ? model.weeks : [];
      if (!weeks.length) {
        setConvertError("AI did not return any structured weeks.");
        return;
      }
      const inferredDays = weeks[0]?.days?.length || daysPerWeek || 3;
      const splitKey = String(inferredDays);

      setProgramJson((prev) => {
        const prevSplits = prev?.splits || {};
        return {
          ...prev,
          splits: {
            ...prevSplits,
            [splitKey]: {
              title: prevSplits[splitKey]?.title || `${inferredDays}-Day Split`,
              weeks,
            },
          },
        };
      });
      setDaysPerWeek(inferredDays);
      setConvertError("");
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
    if (!hasAnyContent(programJson)) {
      setErrorModal({
        title: "No workouts yet",
        message: "Configure at least one split with weeks, days, and exercises before saving.",
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
    const splits = programJson.splits || {};
    const splitKeys = Object.keys(splits);
    const primaryDays =
      splitKeys.length > 0 ? Number(splitKeys[0]) || daysPerWeek || 3 : daysPerWeek || 3;
    const programJsonWithMeta = {
      ...programJson,
      splits,
      meta: {
        ...(programJson.meta || {}),
        difficulty,
        tags: Array.isArray(programJson.meta?.tags) ? programJson.meta.tags : [],
        days_per_week: primaryDays,
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
          {[1, 2, 3, 4, 5, 6, 7].map((d) => {
            const key = String(d);
            const enabled = !!programJson.splits?.[key];
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  if (!enabled) {
                    setDaysPerWeek(d);
                    ensureSplit(d);
                    return;
                  }
                  setConfirmConfig({
                    title: `Remove ${d}-day split?`,
                    message: "This will delete this split and all its weeks and days from this program.",
                    onConfirm: () => {
                      setProgramJson((prev) => {
                        const prevSplits = prev?.splits || {};
                        const nextSplits = { ...prevSplits };
                        delete nextSplits[key];
                        return { ...prev, splits: nextSplits };
                      });
                      setConfirmConfig(null);
                    },
                  });
                }}
                style={{
                  ...S.splitToggleBtn,
                  ...(enabled ? S.splitToggleBtnActive : {}),
                }}
              >
                {d} {d === 1 ? "Day" : "Days"}
              </button>
            );
          })}
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
            const days = daysPerWeek || 3;
            ensureSplit(days);
            setConvertError("");
          }}
          style={S.secondaryBtn}
        >
          Start Blank Program
        </button>
        <button
          type="button"
          onClick={() => saveProgram(false)}
          disabled={!hasAnyContent(programJson) || saving}
          style={{ ...S.secondaryBtn, opacity: !hasAnyContent(programJson) ? 0.5 : 1 }}
        >
          {saving ? "Saving…" : "Save Draft"}
        </button>
        <button
          type="button"
          onClick={() => saveProgram(true)}
          disabled={!hasAnyContent(programJson) || saving}
          style={{ ...S.primaryBtn, opacity: !hasAnyContent(programJson) ? 0.5 : 1 }}
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

      {programJson && Object.keys(programJson.splits || {}).length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px", color: "var(--text)" }}>
            Splits — build each version side by side
          </h3>
          <div style={S.splitsRow} className="no-scrollbar">
            {Object.entries(programJson.splits)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([splitKey, split]) => {
                const weeks = Array.isArray(split.weeks) ? split.weeks : [];
                return (
                  <div key={splitKey} style={S.splitColumn}>
                    <div style={S.splitHeader}>
                      <div>
                        <div style={S.splitLabel}>{splitKey} Days / Week</div>
                        <input
                          style={S.splitTitleInput}
                          value={split.title ?? ""}
                          placeholder="Split title"
                          onChange={(e) => {
                            const value = e.target.value;
                            updateSplit(splitKey, (prevSplit) => ({
                              ...prevSplit,
                              title: value,
                            }));
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        style={S.splitRemoveBtn}
                        onClick={() => {
                          setConfirmConfig({
                            title: `Remove ${splitKey}-day split?`,
                            message: "This will delete this split and all its weeks and days.",
                            onConfirm: () => {
                              setProgramJson((prev) => {
                                const prevSplits = prev?.splits || {};
                                const nextSplits = { ...prevSplits };
                                delete nextSplits[splitKey];
                                return { ...prev, splits: nextSplits };
                              });
                              setConfirmConfig(null);
                            },
                          });
                        }}
                      >
                        Remove
                      </button>
                    </div>

                    <button
                      type="button"
                      style={S.smallAddBtn}
                      onClick={() => {
                        updateSplit(splitKey, (prevSplit) => {
                          const currentWeeks = Array.isArray(prevSplit.weeks)
                            ? prevSplit.weeks
                            : [];
                          const nextWeekNumber =
                            (currentWeeks[currentWeeks.length - 1]?.weekNumber ||
                              currentWeeks.length) + 1;
                          const baseDays =
                            currentWeeks[0]?.days?.length || Number(splitKey) || daysPerWeek || 3;
                          const newWeek = {
                            weekNumber: nextWeekNumber,
                            days: Array.from({ length: baseDays }, (_v, idx) => {
                              const dayNum = idx + 1;
                              const name = `Day ${dayNum}`;
                              return {
                                dayNumber: dayNum,
                                title: name,
                                workout_card: { title: name, exercises: [] },
                              };
                            }),
                          };
                          return {
                            ...prevSplit,
                            weeks: [...currentWeeks, newWeek],
                          };
                        });
                      }}
                    >
                      + Add Week
                    </button>

                    {weeks.map((week, wIdx) => (
                      <div key={week.weekNumber ?? wIdx} style={{ marginBottom: 16 }}>
                        <div style={S.weekRow}>
                          <div style={S.weekLabel}>Week {week.weekNumber ?? wIdx + 1}</div>
                          <button
                            type="button"
                            style={S.smallDangerOutlineBtn}
                            onClick={() => {
                              setConfirmConfig({
                                title: "Delete week?",
                                message: "This week and all its days will be removed from this split.",
                                onConfirm: () => {
                                  updateSplit(splitKey, (prevSplit) => {
                                    const currentWeeks = Array.isArray(prevSplit.weeks)
                                      ? prevSplit.weeks
                                      : [];
                                    return {
                                      ...prevSplit,
                                      weeks: currentWeeks.filter((_, idx) => idx !== wIdx),
                                    };
                                  });
                                  setConfirmConfig(null);
                                },
                              });
                            }}
                          >
                            Delete Week
                          </button>
                        </div>

                        {Array.isArray(week.days) &&
                          week.days.map((day, dIdx) => (
                            <div key={dIdx} style={S.dayCard}>
                              <div style={S.dayHeaderRow}>
                                <input
                                  style={S.dayTitleInput}
                                  value={day.title ?? ""}
                                  placeholder={`Day ${day.dayNumber ?? dIdx + 1}`}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    updateSplit(splitKey, (prevSplit) => {
                                      const weeksCopy = prevSplit.weeks.map((w, wi) => {
                                        if (wi !== wIdx) return w;
                                        const daysCopy = w.days.map((d, di) => {
                                          if (di !== dIdx) return d;
                                          return {
                                            ...d,
                                            title: value,
                                            workout_card: {
                                              ...(d.workout_card || {}),
                                              title: value || d.workout_card?.title,
                                            },
                                          };
                                        });
                                        return { ...w, days: daysCopy };
                                      });
                                      return { ...prevSplit, weeks: weeksCopy };
                                    });
                                  }}
                                />
                                <button
                                  type="button"
                                  style={S.smallDangerOutlineBtn}
                                  onClick={() => {
                                    setConfirmConfig({
                                      title: "Delete workout day?",
                                      message: "This workout day and its exercises will be removed.",
                                      onConfirm: () => {
                                        updateSplit(splitKey, (prevSplit) => {
                                          const weeksCopy = prevSplit.weeks.map((w, wi) => {
                                            if (wi !== wIdx) return w;
                                            return {
                                              ...w,
                                              days: w.days.filter((_, di) => di !== dIdx),
                                            };
                                          });
                                          return { ...prevSplit, weeks: weeksCopy };
                                        });
                                        setConfirmConfig(null);
                                      },
                                    });
                                  }}
                                >
                                  Delete Day
                                </button>
                              </div>

                              {Array.isArray(day.workout_card?.exercises) &&
                              day.workout_card.exercises.length > 0 ? (
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
                                          updateSplit(splitKey, (prevSplit) => {
                                            const weeksCopy = prevSplit.weeks.map((w, wi) => {
                                              if (wi !== wIdx) return w;
                                              const daysCopy = w.days.map((d, di) => {
                                                if (di !== dIdx) return d;
                                                const exercises = Array.isArray(
                                                  d.workout_card?.exercises
                                                )
                                                  ? d.workout_card.exercises.map((ex2, xi) =>
                                                      xi === eIdx ? { ...ex2, name: value } : ex2
                                                    )
                                                  : [];
                                                return {
                                                  ...d,
                                                  workout_card: {
                                                    ...(d.workout_card || {}),
                                                    exercises,
                                                  },
                                                };
                                              });
                                              return { ...w, days: daysCopy };
                                            });
                                            return { ...prevSplit, weeks: weeksCopy };
                                          });
                                        }}
                                      />
                                      <input
                                        type="number"
                                        style={S.smallInput}
                                        value={ex.sets ?? ""}
                                        placeholder="Sets"
                                        onChange={(e) => {
                                          const value =
                                            e.target.value === "" ? null : Number(e.target.value);
                                          updateSplit(splitKey, (prevSplit) => {
                                            const weeksCopy = prevSplit.weeks.map((w, wi) => {
                                              if (wi !== wIdx) return w;
                                              const daysCopy = w.days.map((d, di) => {
                                                if (di !== dIdx) return d;
                                                const exercises = Array.isArray(
                                                  d.workout_card?.exercises
                                                )
                                                  ? d.workout_card.exercises.map((ex2, xi) =>
                                                      xi === eIdx ? { ...ex2, sets: value } : ex2
                                                    )
                                                  : [];
                                                return {
                                                  ...d,
                                                  workout_card: {
                                                    ...(d.workout_card || {}),
                                                    exercises,
                                                  },
                                                };
                                              });
                                              return { ...w, days: daysCopy };
                                            });
                                            return { ...prevSplit, weeks: weeksCopy };
                                          });
                                        }}
                                      />
                                      <input
                                        type="number"
                                        style={S.smallInput}
                                        value={ex.reps ?? ""}
                                        placeholder="Reps"
                                        onChange={(e) => {
                                          const value =
                                            e.target.value === "" ? null : Number(e.target.value);
                                          updateSplit(splitKey, (prevSplit) => {
                                            const weeksCopy = prevSplit.weeks.map((w, wi) => {
                                              if (wi !== wIdx) return w;
                                              const daysCopy = w.days.map((d, di) => {
                                                if (di !== dIdx) return d;
                                                const exercises = Array.isArray(
                                                  d.workout_card?.exercises
                                                )
                                                  ? d.workout_card.exercises.map((ex2, xi) =>
                                                      xi === eIdx ? { ...ex2, reps: value } : ex2
                                                    )
                                                  : [];
                                                return {
                                                  ...d,
                                                  workout_card: {
                                                    ...(d.workout_card || {}),
                                                    exercises,
                                                  },
                                                };
                                              });
                                              return { ...w, days: daysCopy };
                                            });
                                            return { ...prevSplit, weeks: weeksCopy };
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
                                          updateSplit(splitKey, (prevSplit) => {
                                            const weeksCopy = prevSplit.weeks.map((w, wi) => {
                                              if (wi !== wIdx) return w;
                                              const daysCopy = w.days.map((d, di) => {
                                                if (di !== dIdx) return d;
                                                const exercises = Array.isArray(
                                                  d.workout_card?.exercises
                                                )
                                                  ? d.workout_card.exercises.map((ex2, xi) =>
                                                      xi === eIdx
                                                        ? { ...ex2, percentage: value }
                                                        : ex2
                                                    )
                                                  : [];
                                                return {
                                                  ...d,
                                                  workout_card: {
                                                    ...(d.workout_card || {}),
                                                    exercises,
                                                  },
                                                };
                                              });
                                              return { ...w, days: daysCopy };
                                            });
                                            return { ...prevSplit, weeks: weeksCopy };
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
                                          updateSplit(splitKey, (prevSplit) => {
                                            const weeksCopy = prevSplit.weeks.map((w, wi) => {
                                              if (wi !== wIdx) return w;
                                              const daysCopy = w.days.map((d, di) => {
                                                if (di !== dIdx) return d;
                                                const exercises = Array.isArray(
                                                  d.workout_card?.exercises
                                                )
                                                  ? d.workout_card.exercises.map((ex2, xi) =>
                                                      xi === eIdx ? { ...ex2, rpe: value } : ex2
                                                    )
                                                  : [];
                                                return {
                                                  ...d,
                                                  workout_card: {
                                                    ...(d.workout_card || {}),
                                                    exercises,
                                                  },
                                                };
                                              });
                                              return { ...w, days: daysCopy };
                                            });
                                            return { ...prevSplit, weeks: weeksCopy };
                                          });
                                        }}
                                      />
                                      <input
                                        type="text"
                                        style={S.smallInput}
                                        value={ex.weight ?? ""}
                                        placeholder="Weight"
                                        onChange={(e) => {
                                          const value = e.target.value;
                                          updateSplit(splitKey, (prevSplit) => {
                                            const weeksCopy = prevSplit.weeks.map((w, wi) => {
                                              if (wi !== wIdx) return w;
                                              const daysCopy = w.days.map((d, di) => {
                                                if (di !== dIdx) return d;
                                                const exercises = Array.isArray(
                                                  d.workout_card?.exercises
                                                )
                                                  ? d.workout_card.exercises.map((ex2, xi) =>
                                                      xi === eIdx ? { ...ex2, weight: value } : ex2
                                                    )
                                                  : [];
                                                return {
                                                  ...d,
                                                  workout_card: {
                                                    ...(d.workout_card || {}),
                                                    exercises,
                                                  },
                                                };
                                              });
                                              return { ...w, days: daysCopy };
                                            });
                                            return { ...prevSplit, weeks: weeksCopy };
                                          });
                                        }}
                                      />
                                      <input
                                        type="text"
                                        style={S.smallInput}
                                        value={ex.notes ?? ""}
                                        placeholder="Notes"
                                        onChange={(e) => {
                                          const value = e.target.value;
                                          updateSplit(splitKey, (prevSplit) => {
                                            const weeksCopy = prevSplit.weeks.map((w, wi) => {
                                              if (wi !== wIdx) return w;
                                              const daysCopy = w.days.map((d, di) => {
                                                if (di !== dIdx) return d;
                                                const exercises = Array.isArray(
                                                  d.workout_card?.exercises
                                                )
                                                  ? d.workout_card.exercises.map((ex2, xi) =>
                                                      xi === eIdx ? { ...ex2, notes: value } : ex2
                                                    )
                                                  : [];
                                                return {
                                                  ...d,
                                                  workout_card: {
                                                    ...(d.workout_card || {}),
                                                    exercises,
                                                  },
                                                };
                                              });
                                              return { ...w, days: daysCopy };
                                            });
                                            return { ...prevSplit, weeks: weeksCopy };
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
                                              updateSplit(splitKey, (prevSplit) => {
                                                const weeksCopy = prevSplit.weeks.map((w, wi) => {
                                                  if (wi !== wIdx) return w;
                                                  const daysCopy = w.days.map((d, di) => {
                                                    if (di !== dIdx) return d;
                                                    const exercises = Array.isArray(
                                                      d.workout_card?.exercises
                                                    )
                                                      ? d.workout_card.exercises.filter(
                                                          (_ex2, xi) => xi !== eIdx
                                                        )
                                                      : [];
                                                    return {
                                                      ...d,
                                                      workout_card: {
                                                        ...(d.workout_card || {}),
                                                        exercises,
                                                      },
                                                    };
                                                  });
                                                  return { ...w, days: daysCopy };
                                                });
                                                return { ...prevSplit, weeks: weeksCopy };
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
                                <p
                                  style={{
                                    fontSize: 13,
                                    color: "var(--text-dim)",
                                    margin: 0,
                                  }}
                                >
                                  No exercises listed.
                                </p>
                              )}

                              <button
                                type="button"
                                style={S.smallAddBtn}
                                onClick={() => {
                                  updateSplit(splitKey, (prevSplit) => {
                                    const weeksCopy = prevSplit.weeks.map((w, wi) => {
                                      if (wi !== wIdx) return w;
                                      const daysCopy = w.days.map((d, di) => {
                                        if (di !== dIdx) return d;
                                        const exercises = Array.isArray(
                                          d.workout_card?.exercises
                                        )
                                          ? [...d.workout_card.exercises]
                                          : [];
                                        exercises.push({
                                          name: "",
                                          sets: null,
                                          reps: null,
                                          weight: "",
                                          percentage: "",
                                          rpe: "",
                                          notes: "",
                                          input: "",
                                        });
                                        return {
                                          ...d,
                                          workout_card: {
                                            ...(d.workout_card || {}),
                                            exercises,
                                          },
                                        };
                                      });
                                      return { ...w, days: daysCopy };
                                    });
                                    return { ...prevSplit, weeks: weeksCopy };
                                  });
                                }}
                              >
                                + Add Exercise
                              </button>
                            </div>
                          ))}

                        <button
                          type="button"
                          style={S.smallAddBtn}
                          onClick={() => {
                            updateSplit(splitKey, (prevSplit) => {
                              const weeksCopy = prevSplit.weeks.map((w, wi) => {
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
                              return { ...prevSplit, weeks: weeksCopy };
                            });
                          }}
                        >
                          + Add Workout Day
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
          </div>
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
  splitToggleBtn: {
    padding: "8px 14px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "var(--card-2)",
    color: "var(--text-dim)",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    outline: "none",
    boxShadow: "none",
    WebkitTapHighlightColor: "transparent",
  },
  splitToggleBtnActive: {
    borderColor: "var(--accent)",
    color: "var(--accent)",
  },
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
  splitsRow: {
    display: "flex",
    gap: 12,
    overflowX: "auto",
    paddingBottom: 8,
  },
  splitColumn: {
    minWidth: 260,
    maxWidth: 320,
    background: "var(--card-2)",
    borderRadius: 14,
    border: "1px solid var(--border)",
    padding: 12,
  },
  splitHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 8,
  },
  splitLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "var(--accent)",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  splitTitleInput: {
    width: "100%",
    padding: 6,
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: "var(--text)",
    fontSize: 13,
  },
  splitRemoveBtn: {
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid var(--accent)",
    background: "transparent",
    color: "var(--accent)",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  },
  weekRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  dayHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6,
  },
  dayTitleInput: {
    flex: 1,
    padding: 6,
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: "var(--text)",
    fontSize: 13,
  },
};
