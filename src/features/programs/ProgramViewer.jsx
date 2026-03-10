import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { getDisplayText, normalizeExerciseToFlexible } from "../../utils/displayText";

export default function ProgramViewer({ previewProgram = null, program: programProp = null }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [program, setProgram] = useState(null);
  const [owned, setOwned] = useState(false);
  const [selectedSplitKey, setSelectedSplitKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [aiVariant, setAiVariant] = useState(null);

  const preview =
    previewProgram ??
    (programProp?.program_json ? { ...programProp, program_json: programProp.program_json } : null);

  useEffect(() => {
    if (!preview) return;
    setProgram(preview);
    setOwned(true);
    setLoading(false);
    const splits = preview.program_json?.splits || {};
    const keys = Object.keys(splits);
    if (keys.length > 0) setSelectedSplitKey(keys.sort((a, b) => Number(a) - Number(b))[0]);
  }, [preview]);

  useEffect(() => {
    if (preview) return;
    let alive = true;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!id) {
        setLoading(false);
        return;
      }

      const { data: prog, error: progErr } = await supabase
        .from("programs")
        .select("*")
        .eq("id", id)
        .single();

      if (!alive) return;
      if (progErr || !prog) {
        setProgram(null);
        setLoading(false);
        return;
      }
      setProgram(prog);

      if (user?.id) {
        const isCreator = prog.creator_id === user.id;
        const { data: up } = await supabase
          .from("user_programs")
          .select("id")
          .eq("user_id", user.id)
          .eq("program_id", id)
          .maybeSingle();
        if (alive) setOwned(!!up || isCreator);
      }

      if (!alive) return;
      const splits = prog.program_json?.splits || {};
      const keys = Object.keys(splits);
      if (keys.length > 0) {
        setSelectedSplitKey(keys.sort((a, b) => Number(a) - Number(b))[0]);
      }
      setLoading(false);
    })();

    return () => { alive = false; };
  }, [id, preview]);

  async function modifyProgram(type) {
    const base = program?.parsed_program;
    if (!base) return;
    try {
      const res = await fetch("/api/modifyProgram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseProgram: base, modification: type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Modify failed");
      setAiVariant(data);
    } catch (e) {
      console.error(e);
      alert(e.message || "Modify failed");
    }
  }

  async function saveProgramWorkout(workout) {
    const { data } = await supabase.auth.getSession();
    const userId = data?.session?.user?.id;
    if (!userId) return;

    setSavingId(workout.name);
    try {
      const normalized = Array.isArray(workout.exercises)
        ? workout.exercises.map(normalizeExerciseToFlexible).filter(Boolean)
        : [];
      const flexExercises = normalized.map((ex, i) => ({
        id: `temp-${i}`,
        name: ex.name,
        input: ex.input,
      }));

      const { data: newWorkout, error: wErr } = await supabase
        .from("workouts")
        .insert({
          user_id: userId,
          name: workout.name,
          exercises: flexExercises,
        })
        .select("id")
        .single();

      if (wErr) throw wErr;
      const workoutId = newWorkout?.id;
      if (!workoutId) { setSavingId(null); return; }

      // Also insert into exercises table; upgrade JSONB with real IDs if possible
      if (normalized.length > 0) {
        const rows = normalized.map((ex, i) => ({
          user_id: userId,
          workout_id: workoutId,
          name: ex.name,
          sets: null,
          reps: null,
          weight: "",
          display_text: ex.input || null,
          position: i,
        }));
        try {
          const { data: insertedRows } = await supabase
            .from("exercises")
            .insert(rows)
            .select("id, name, display_text");
          if (insertedRows?.length) {
            const withRealIds = insertedRows.map((r) => ({
              id: r.id,
              name: r.name,
              input: r.display_text ?? "",
            }));
            await supabase.from("workouts").update({ exercises: withRealIds }).eq("id", workoutId);
          }
        } catch (exErr) {
          console.error("Exercise table insert failed (workout still has exercises):", exErr);
        }
      }
    } catch (e) {
      console.error("saveProgramWorkout failed", e);
    }
    setSavingId(null);
  }

  if (loading) {
    return (
      <div style={styles.wrap}>
        <div style={styles.loading}>Loading program…</div>
      </div>
    );
  }

  if (!program || !owned) {
    return (
      <div style={styles.wrap}>
        <p style={styles.loading}>Program not found or you don’t have access.</p>
        <button type="button" onClick={() => navigate("/programs")} style={styles.backBtn}>
          Back to Programs
        </button>
      </div>
    );
  }

  const splits = program?.program_json?.splits || {};
  const splitEntries = Object.entries(splits).sort(
    ([a], [b]) => Number(a) - Number(b)
  );
  const activeKey =
    selectedSplitKey && splits[selectedSplitKey]
      ? selectedSplitKey
      : splitEntries[0]?.[0] ?? null;

  return (
    <div style={styles.wrap}>
      <button
        type="button"
        onClick={() => navigate(id ? `/programs/${id}` : "/programs")}
        style={styles.backBtn}
        aria-label="Back to program"
      >
        ← Back
      </button>

      <h1 style={styles.title}>{program?.title ?? "Program"}</h1>
      {program?.parsed_program && (
        <div style={styles.aiVariantRow}>
          <button type="button" onClick={() => modifyProgram("beginner")} style={styles.aiVariantBtn}>Beginner</button>
          <button type="button" onClick={() => modifyProgram("strength")} style={styles.aiVariantBtn}>Strength</button>
          <button type="button" onClick={() => modifyProgram("short_sessions")} style={styles.aiVariantBtn}>Short Sessions</button>
          <button type="button" onClick={() => modifyProgram("hook_focus")} style={styles.aiVariantBtn}>Hook Focus</button>
        </div>
      )}

      {splitEntries.length > 0 && (
        <div style={styles.splitPickerRow}>
          <span style={styles.frequencyLabel}>Available splits</span>
          <div style={styles.frequencyButtons}>
            {splitEntries.map(([key]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedSplitKey(key)}
                style={{
                  ...styles.freqBtn,
                  ...(activeKey === key ? styles.freqBtnActive : {}),
                }}
              >
                {key}x
              </button>
            ))}
          </div>
        </div>
      )}

      {activeKey && splits[activeKey] && (
        <div style={styles.layout}>
          {splits[activeKey].title && (
            <div style={styles.summary}>{splits[activeKey].title}</div>
          )}

          {Array.isArray(splits[activeKey].weeks) &&
            splits[activeKey].weeks.map((week, wIdx) => (
              <div key={week.weekNumber ?? wIdx} style={styles.workoutBlock}>
                <h3 style={styles.workoutTitle}>
                  Week {week.weekNumber ?? wIdx + 1}
                </h3>
                {(week.days || []).map((day, dIdx) => {
                  const exList = Array.isArray(day.workout_card?.exercises)
                    ? day.workout_card.exercises
                    : [];
                  const workoutName =
                    day.title || day.workout_card?.title || `Day ${dIdx + 1}`;
                  return (
                    <div key={dIdx} style={{ marginBottom: 16 }}>
                      <h4 style={styles.dayTitle}>{workoutName}</h4>
                      {exList.map((exercise, ei) => (
                        <div key={ei} style={styles.exerciseRow}>
                          <span style={{ fontWeight: 600, color: "var(--text)" }}>
                            {getDisplayText(exercise)}
                          </span>
                        </div>
                      ))}
                      {exList.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            saveProgramWorkout({
                              name: workoutName,
                              exercises: exList,
                            })
                          }
                          disabled={!!savingId || !exList.length}
                          style={styles.saveBtn}
                        >
                          {savingId === workoutName
                            ? "Saving…"
                            : "Save as Workout Card"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: {
    padding: "16px 16px 90px",
    maxWidth: "560px",
    margin: "0 auto",
  },
  loading: {
    color: "var(--text-dim)",
    fontSize: 14,
  },
  backBtn: {
    marginBottom: 16,
    padding: "8px 0",
    background: "none",
    border: "none",
    color: "var(--text-dim)",
    fontSize: 14,
    cursor: "pointer",
  },
  title: {
    fontSize: 20,
    fontWeight: 800,
    margin: "0 0 16px",
    color: "var(--text)",
  },
  aiVariantRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  aiVariantBtn: {
    padding: "8px 14px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--card-2)",
    color: "var(--text)",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  },
  frequencyRow: {
    marginBottom: 20,
  },
  splitPickerRow: {
    marginBottom: 16,
  },
  frequencyLabel: {
    display: "block",
    fontSize: 12,
    color: "var(--text-dim)",
    marginBottom: 8,
  },
  frequencyButtons: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  freqBtn: {
    padding: "10px 16px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--card-2)",
    color: "var(--text)",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  freqBtnActive: {
    background: "var(--accent)",
    borderColor: "var(--accent)",
  },
  layout: {
    background: "var(--card-2)",
    borderRadius: 14,
    border: "1px solid var(--border)",
    padding: 16,
  },
  summary: {
    margin: "0 0 16px",
    fontSize: 14,
    lineHeight: 1.5,
    color: "var(--text-dim)",
  },
  workoutBlock: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottom: "1px solid var(--border)",
  },
  workoutTitle: {
    fontSize: 16,
    fontWeight: 700,
    margin: "0 0 4px",
    color: "var(--text)",
  },
  estimatedTime: {
    fontSize: 12,
    color: "var(--text-dim)",
    margin: "0 0 10px",
  },
  exerciseRow: {
    fontSize: 13,
    color: "var(--text-dim)",
    marginBottom: 6,
    paddingLeft: 8,
  },
  saveBtn: {
    marginTop: 12,
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid var(--accent)",
    background: "transparent",
    color: "var(--accent)",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  },
  layoutText: {
    margin: 0,
    fontSize: 14,
    color: "var(--text-dim)",
  },
  phaseBlock: {},
  phaseLabel: {
    fontSize: 12,
    color: "var(--text-dim)",
    marginBottom: 12,
  },
  phaseCard: {
    padding: 12,
    borderRadius: 10,
    border: "1px solid var(--border)",
    marginBottom: 10,
    background: "var(--card)",
  },
  phaseDesc: {
    margin: "6px 0 0",
    fontSize: 13,
    color: "var(--text-dim)",
  },
};
