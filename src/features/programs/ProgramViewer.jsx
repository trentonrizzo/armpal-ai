import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";

export default function ProgramViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [program, setProgram] = useState(null);
  const [logic, setLogic] = useState(null);
  const [owned, setOwned] = useState(false);
  const [selectedFrequency, setSelectedFrequency] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const logicJson = logic?.logic_json ?? {};
  const frequencyRange = logicJson.frequency_range ?? [];
  const hasFrequencyRange = Array.isArray(frequencyRange) && frequencyRange.length > 0;
  const layout = hasFrequencyRange && selectedFrequency != null
    ? logicJson.layouts?.[selectedFrequency]
    : null;

  if (hasFrequencyRange && selectedFrequency != null && layout === undefined) {
    console.warn("Missing layout for frequency", selectedFrequency);
  }

  useEffect(() => {
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
        const { data: up } = await supabase
          .from("user_programs")
          .select("id")
          .eq("user_id", user.id)
          .eq("program_id", id)
          .maybeSingle();
        if (alive) setOwned(!!up);
      }

      const { data: logicRow, error: logicErr } = await supabase
        .from("program_logic")
        .select("logic_json")
        .eq("program_id", id)
        .maybeSingle();

      if (!alive) return;
      if (!logicErr && logicRow?.logic_json) {
        setLogic({ logic_json: logicRow.logic_json });
        const fr = logicRow.logic_json?.frequency_range;
        if (Array.isArray(fr) && fr.length > 0) {
          setSelectedFrequency(fr[0]);
        }
      } else {
        setLogic({ logic_json: {} });
      }
      setLoading(false);
    })();

    return () => { alive = false; };
  }, [id]);

  async function saveProgramWorkout(workout) {
    const { data } = await supabase.auth.getSession();
    const userId = data?.session?.user?.id;
    if (!userId) return;

    setSavingId(workout.name);
    try {
      const { data: newWorkout, error: wErr } = await supabase
        .from("workouts")
        .insert({
          user_id: userId,
          name: workout.name,
        })
        .select("id")
        .single();

      if (wErr) throw wErr;
      const workoutId = newWorkout?.id;
      if (!workoutId || !Array.isArray(workout.exercises)) {
        setSavingId(null);
        return;
      }

      for (let i = 0; i < workout.exercises.length; i++) {
        const ex = workout.exercises[i];
        await supabase.from("exercises").insert({
          user_id: userId,
          workout_id: workoutId,
          name: ex.name || "Exercise",
          sets: ex.sets != null ? String(ex.sets) : null,
          reps: ex.reps != null ? String(ex.reps) : null,
          weight: ex.intensity ?? null,
          position: i,
        });
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

  const workouts = layout?.days ?? layout?.workouts ?? [];

  return (
    <div style={styles.wrap}>
      <button
        type="button"
        onClick={() => navigate(`/programs/${id}`)}
        style={styles.backBtn}
        aria-label="Back to program"
      >
        ← Back
      </button>

      <h1 style={styles.title}>{program.title}</h1>

      {hasFrequencyRange && (
        <div style={styles.frequencyRow}>
          <span style={styles.frequencyLabel}>Days per week</span>
          <div style={styles.frequencyButtons}>
            {frequencyRange.map((freq) => (
              <button
                key={freq}
                type="button"
                onClick={() => setSelectedFrequency(freq)}
                className={selectedFrequency === freq ? "pill active" : "pill"}
                style={{
                  ...styles.freqBtn,
                  ...(selectedFrequency === freq ? styles.freqBtnActive : {}),
                }}
              >
                {freq}×
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={styles.layout}>
        {layout?.summary && (
          <div style={styles.summary}>{layout.summary}</div>
        )}

        {workouts.length > 0 && workouts.map((workout) => (
          <div key={workout.name || Math.random()} style={styles.workoutBlock}>
            <h3 style={styles.workoutTitle}>{workout.name}</h3>
            {workout.estimated_time && (
              <p style={styles.estimatedTime}>{workout.estimated_time}</p>
            )}
            {workout.exercises?.map((exercise) => (
              <div key={exercise.name || exercise} style={styles.exerciseRow}>
                {exercise.name} — {exercise.sets} × {exercise.reps}
                {exercise.intensity ? ` @ ${exercise.intensity}` : ""}
              </div>
            ))}
            <button
              type="button"
              onClick={() => saveProgramWorkout(workout)}
              disabled={!!savingId || !workout.exercises?.length}
              style={styles.saveBtn}
            >
              {savingId === workout.name ? "Saving…" : "Save as Workout Card"}
            </button>
          </div>
        ))}

        {!layout?.summary && workouts.length === 0 && logicJson.phases?.length > 0 && (
          <div style={styles.phaseBlock}>
            <div style={styles.phaseLabel}>
              {selectedFrequency != null ? `${selectedFrequency}×/week` : ""} · {logicJson.weeks ?? 1} week(s)
            </div>
            {logicJson.phases.map((phase, i) => (
              <div key={i} style={styles.phaseCard}>
                <strong>{phase.name ?? `Phase ${i + 1}`}</strong>
                {phase.description ? <p style={styles.phaseDesc}>{phase.description}</p> : null}
              </div>
            ))}
          </div>
        )}

        {!layout?.summary && workouts.length === 0 && !logicJson.phases?.length && (
          <p style={styles.layoutText}>
            No layout for {selectedFrequency != null ? `${selectedFrequency}×/week` : "this frequency"}.
          </p>
        )}
      </div>
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
  frequencyRow: {
    marginBottom: 20,
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
