// src/pages/WorkoutsPage.jsx
// ============================================================
// ARM PAL — WORKOUTS PAGE (FULL FILE REPLACEMENT)
// ============================================================
// LOCKED REQUIREMENTS:
// ✅ KEEP YOUR EXISTING WORKOUTS PAGE LOGIC + MODALS + DRAG/DROP
// ✅ DO NOT BREAK THE EXISTING EXPAND/COLLAPSE WORKOUT VIEW
// ✅ ADD OPTIONAL “FOCUS MODE” (FULL SCREEN WORKOUT VIEW)
// ✅ INSIDE FOCUS MODE:
//    - Start / End workout session
//    - Total workout duration timer
//    - Adjustable rest timer (countdown) + optional stopwatch
//    - Set checkboxes per exercise (based on set count)
//    - End summary (duration, sets performed, avg rest)
// ✅ NO DB SCHEMA CHANGES REQUIRED FOR THIS FEATURE
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { achievementBus } from "../utils/achievementBus";
import { checkUsageCap } from "../utils/usageLimits";
import { supabase } from "../supabaseClient";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useToast } from "../components/ToastProvider";
import EmptyState from "../components/EmptyState";
import { SkeletonCard } from "../components/Skeleton";
import {
  FaChevronDown,
  FaChevronUp,
  FaEdit,
  FaTrash,
  FaExpandAlt,
  FaArrowLeft,
  FaPlay,
  FaStop,
  FaRegClock,
  FaStopwatch,
  FaMinus,
  FaPlus,
  FaCheck,
  FaTimes,
} from "react-icons/fa";

// ============================================================
// DRAGGABLE WRAPPER — LEFT drag handle only; RIGHT side scrolls
// ============================================================

function SortableItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: "relative",
  };

  return (
    <div ref={setNodeRef} style={style}>
      {/* LEFT drag zone only */}
      <div
        {...attributes}
        {...listeners}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "20%",
          height: "100%",
          zIndex: 5,
          touchAction: "none",
        }}
      />
      {/* RIGHT content: allow vertical scroll */}
      <div style={{ touchAction: "pan-y" }}>{children}</div>
    </div>
  );
}

// ============================================================
// SMALL HELPERS
// ============================================================

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function formatHMS(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;

  if (hh > 0) {
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(
      2,
      "0"
    )}:${String(ss).padStart(2, "0")}`;
  }

  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function nowMs() {
  return Date.now();
}

// ============================================================
// MAIN
// ============================================================

export default function WorkoutsPage() {
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [expandedExercises, setExpandedExercises] = useState({});
  const [loading, setLoading] = useState(true);

  // Workout modal
  const [workoutModalOpen, setWorkoutModalOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState(null);
  const [workoutName, setWorkoutName] = useState("");
  const [workoutSchedule, setWorkoutSchedule] = useState("");

  // Exercise modal
  const [exerciseModalOpen, setExerciseModalOpen] = useState(false);
  const [exerciseWorkoutId, setExerciseWorkoutId] = useState(null);
  const [editingExercise, setEditingExercise] = useState(null);
  const [exerciseName, setExerciseName] = useState("");
  const [exerciseSets, setExerciseSets] = useState("");
  const [exerciseReps, setExerciseReps] = useState("");
  const [exerciseWeight, setExerciseWeight] = useState("");

  // Delete confirm modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ============================================================
  // NEW: FOCUS MODE (OPTIONAL FULL SCREEN WORKOUT VIEW)
  // ============================================================

  const [focusOpen, setFocusOpen] = useState(false);
  const [focusWorkout, setFocusWorkout] = useState(null);
  const [focusExercises, setFocusExercises] = useState([]);

  // session
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionStartedAt, setSessionStartedAt] = useState(null);
  const [sessionEndedAt, setSessionEndedAt] = useState(null);
  const [workoutSeconds, setWorkoutSeconds] = useState(0);
  const workoutTimerRef = useRef(null);

  // set checkboxes: { [exerciseId]: boolean[] }
  const [checksByExercise, setChecksByExercise] = useState({});

  // rest timer
  const [restMode, setRestMode] = useState("countdown"); // countdown | stopwatch
  const [restSeconds, setRestSeconds] = useState(90);
  const [restRunning, setRestRunning] = useState(false);
  const restTimerRef = useRef(null);

  // rest intervals (ms) for average rest
  const [restIntervalsMs, setRestIntervalsMs] = useState([]);
  const restStartRef = useRef(null);

  // summary
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [capMessage, setCapMessage] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // ============================================================
  // LOAD USER
  // ============================================================

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      if (data.user) await loadWorkouts(data.user.id);
      setLoading(false);
    })();
  }, []);

  async function loadWorkouts(uid) {
    const { data } = await supabase
      .from("workouts")
      .select("*")
      .eq("user_id", uid)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    setWorkouts(data || []);
  }

  async function loadExercises(workoutId) {
    const { data } = await supabase
      .from("exercises")
      .select("*")
      .eq("workout_id", workoutId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    return data || [];
  }

  // ============================================================
  // EXPAND / COLLAPSE
  // ============================================================

  async function toggleExpand(workoutId) {
    if (expandedExercises[workoutId]) {
      const copy = { ...expandedExercises };
      delete copy[workoutId];
      setExpandedExercises(copy);
    } else {
      const ex = await loadExercises(workoutId);
      setExpandedExercises((p) => ({ ...p, [workoutId]: ex }));
    }
  }

  // ============================================================
  // DRAG & DROP (UNCHANGED LOGIC)
  // ============================================================

  async function handleWorkoutDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = workouts.findIndex((w) => w.id === active.id);
    const newIndex = workouts.findIndex((w) => w.id === over.id);
    const reordered = arrayMove(workouts, oldIndex, newIndex);
    setWorkouts(reordered);

    for (let i = 0; i < reordered.length; i++) {
      await supabase
        .from("workouts")
        .update({ position: i })
        .eq("id", reordered[i].id);
    }
  }

  async function handleExerciseDragEnd(workoutId, event) {
    const list = expandedExercises[workoutId] || [];
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = list.findIndex((e) => e.id === active.id);
    const newIndex = list.findIndex((e) => e.id === over.id);
    const reordered = arrayMove(list, oldIndex, newIndex);
achievementBus.emit({ type: "FIRST_WORKOUT" });

    for (let i = 0; i < reordered.length; i++) {
      await supabase
        .from("exercises")
        .update({ position: i })
        .eq("id", reordered[i].id);
    }

    setExpandedExercises((p) => ({ ...p, [workoutId]: reordered }));
  }

  // ============================================================
  // WORKOUT MODAL (UNCHANGED)
  // ============================================================

  function openWorkoutModal(workout = null) {
    setEditingWorkout(workout);
    setWorkoutName(workout?.name || "");
    setWorkoutSchedule(
      workout?.scheduled_for ? workout.scheduled_for.slice(0, 16) : ""
    );
    setCapMessage("");
    setWorkoutModalOpen(true);
  }

  async function saveWorkout() {
    if (!user) return;

    const payload = {
      user_id: user.id,
      name: workoutName || "Workout",
      // ✅ FIX: do NOT force UTC via toISOString() (causes -6 hours)
      scheduled_for: workoutSchedule ? workoutSchedule : null,
    };

    try {
      if (editingWorkout) {
        const { error } = await supabase.from("workouts").update(payload).eq("id", editingWorkout.id);
        if (error) throw error;
      } else {
        const cap = await checkUsageCap(user.id, "workouts");
        if (!cap.allowed) {
          setCapMessage(`Workout limit reached (${cap.limit} for ${cap.isPro ? "Pro" : "free"}). Go Pro for more!`);
          return;
        }
        setCapMessage("");
        payload.position = workouts.length;
        const { error } = await supabase.from("workouts").insert(payload);
        if (error) throw error;
      }
      // FIRST WORKOUT ACHIEVEMENT
      if (!editingWorkout && workouts.length === 0) {
        const alreadyFired = localStorage.getItem("ach_first_workout");
        if (!editingWorkout && !alreadyFired) {
          achievementBus.emit({ type: "FIRST_WORKOUT" });
          localStorage.setItem("ach_first_workout", "1");
        }
      }
      setWorkoutModalOpen(false);
      setEditingWorkout(null);
      await loadWorkouts(user.id);
      toast.success("Saved");
    } catch (e) {
      console.error("saveWorkout failed", e);
      toast.error("Failed to save workout");
    }
  }

  async function deleteWorkout(id) {
    await supabase.from("workouts").delete().eq("id", id);
    if (user) await loadWorkouts(user.id);
  }

  // ============================================================
  // EXERCISE MODAL (UNCHANGED)
  // ============================================================

  function openExerciseModal(workoutId, exercise = null) {
    setExerciseWorkoutId(workoutId);
    setEditingExercise(exercise);
    setExerciseName(exercise?.name || "");
    setExerciseSets(exercise?.sets ?? "");
    setExerciseReps(exercise?.reps ?? "");
    setExerciseWeight(exercise?.weight ?? "");
    setExerciseModalOpen(true);
  }

  async function saveExercise() {
    if (!user || !exerciseWorkoutId) return;

    const list = expandedExercises[exerciseWorkoutId] || [];
    const payload = {
      user_id: user.id,
      workout_id: exerciseWorkoutId,
      name: exerciseName || "Exercise",
      sets: exerciseSets === "" ? null : Number(exerciseSets),
      reps: exerciseReps === "" ? null : Number(exerciseReps),
      weight: exerciseWeight === "" ? null : exerciseWeight,
    };

    if (editingExercise) {
      await supabase.from("exercises").update(payload).eq("id", editingExercise.id);
    } else {
      payload.position = list.length;
      await supabase.from("exercises").insert(payload);
    }

    const ex = await loadExercises(exerciseWorkoutId);
    setExpandedExercises((p) => ({ ...p, [exerciseWorkoutId]: ex }));

    setExerciseModalOpen(false);
    setEditingExercise(null);
  }

  async function deleteExercise(id, workoutId) {
    await supabase.from("exercises").delete().eq("id", id);
    const ex = await loadExercises(workoutId);
    setExpandedExercises((p) => ({ ...p, [workoutId]: ex }));
  }

  function askDeleteWorkout(id) {
    setDeleteTarget({ type: "workout", id });
    setDeleteModalOpen(true);
  }

  function askDeleteExercise(id, workoutId) {
    setDeleteTarget({ type: "exercise", id, workoutId });
    setDeleteModalOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.type === "workout") {
      await deleteWorkout(deleteTarget.id);
    } else {
      await deleteExercise(deleteTarget.id, deleteTarget.workoutId);
    }
    setDeleteTarget(null);
    setDeleteModalOpen(false);
  }

  // ============================================================
  // FORMAT SCHEDULE (UNCHANGED)
  // ============================================================

  function formatSchedule(value) {
    if (!value) return "Not scheduled";
    const d = new Date(value);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // ============================================================
  // FOCUS MODE: OPEN / CLOSE
  // ============================================================

  async function openFocusForWorkout(workout) {
    const ex = await loadExercises(workout.id);

    setFocusWorkout(workout);
    setFocusExercises(ex);

    // reset session state
    setSessionActive(false);
    setSessionStartedAt(null);
    setSessionEndedAt(null);
    setWorkoutSeconds(0);

    // reset checks to match exercise set counts
    const init = {};
    for (const e of ex) {
      const setsCount = clamp(safeNum(e.sets, 0), 0, 50);
      init[e.id] = Array.from({ length: setsCount }, () => false);
    }
    setChecksByExercise(init);

    // reset rest timer
    stopRestTimer(true);
    setRestMode("countdown");
    setRestSeconds(90);
    setRestIntervalsMs([]);
    restStartRef.current = null;

    // summary
    setSummaryOpen(false);

    // open overlay
    setFocusOpen(true);
  }

  function closeFocusMode() {
    endWorkoutSession(true);
    setFocusOpen(false);
    setFocusWorkout(null);
    setFocusExercises([]);
    setSummaryOpen(false);
  }

  // ============================================================
  // FOCUS MODE: SESSION TIMER
  // ============================================================

  function startWorkoutSession() {
    if (sessionActive) return;
    setSessionActive(true);
    setSessionStartedAt(nowMs());
    setSessionEndedAt(null);
    setSummaryOpen(false);

    if (workoutTimerRef.current) {
      clearInterval(workoutTimerRef.current);
      workoutTimerRef.current = null;
    }

    workoutTimerRef.current = setInterval(() => {
      setWorkoutSeconds((s) => s + 1);
    }, 1000);
  }

  function endWorkoutSession(silent = false) {
    if (workoutTimerRef.current) {
      clearInterval(workoutTimerRef.current);
      workoutTimerRef.current = null;
    }

    stopRestTimer(true);

    if (!silent) {
      setSessionEndedAt(nowMs());
      setSessionActive(false);
      setSummaryOpen(true);
      return;
    }

    setSessionActive(false);
  }

  useEffect(() => {
    // cleanup if user navigates away
    return () => {
      try {
        if (workoutTimerRef.current) clearInterval(workoutTimerRef.current);
        if (restTimerRef.current) clearInterval(restTimerRef.current);
      } catch {}
      workoutTimerRef.current = null;
      restTimerRef.current = null;
    };
  }, []);

  // ============================================================
  // FOCUS MODE: SET CHECKS
  // ============================================================

  function toggleSetCheck(exerciseId, setIndex) {
    if (!exerciseId) return;
    if (!Number.isFinite(setIndex)) return;

    setChecksByExercise((prev) => {
      const copy = { ...prev };
      const arr = Array.isArray(copy[exerciseId]) ? [...copy[exerciseId]] : [];
      if (setIndex < 0 || setIndex >= arr.length) return prev;
      arr[setIndex] = !arr[setIndex];
      copy[exerciseId] = arr;
      return copy;
    });

    // Optional UX: if session is active and you check a set, start rest
    // only when switching a set to TRUE.
    // We avoid auto-start if rest already running.
  }

  // ============================================================
  // FOCUS MODE: REST TIMER
  // ============================================================

  function bumpRestSeconds(delta) {
    setRestSeconds((s) => {
      const next = restMode === "stopwatch" ? Math.max(0, s) : clamp(s + delta, 5, 60 * 20);
      return next;
    });
  }

  function setRestPreset(seconds) {
    const s = clamp(Number(seconds || 0), 5, 60 * 20);
    setRestSeconds(s);
  }

  function startRestTimer() {
    if (restRunning) return;

    // record start
    restStartRef.current = nowMs();

    setRestRunning(true);

    if (restTimerRef.current) {
      clearInterval(restTimerRef.current);
      restTimerRef.current = null;
    }

    restTimerRef.current = setInterval(() => {
      setRestSeconds((s) => {
        if (restMode === "stopwatch") return s + 1;

        const next = s - 1;
        if (next <= 0) {
          // auto stop at zero
          stopRestTimer(false);
          return 0;
        }
        return next;
      });
    }, 1000);
  }

  function stopRestTimer(silent) {
    if (restTimerRef.current) {
      clearInterval(restTimerRef.current);
      restTimerRef.current = null;
    }

    if (!silent && restStartRef.current) {
      const elapsed = nowMs() - restStartRef.current;
      if (elapsed > 0) {
        setRestIntervalsMs((p) => [...p, elapsed]);
      }
    }

    restStartRef.current = null;
    setRestRunning(false);
  }

  function resetRestTimer() {
    stopRestTimer(true);
    if (restMode === "stopwatch") {
      setRestSeconds(0);
    } else {
      setRestSeconds(90);
    }
  }

  // ============================================================
  // SUMMARY COMPUTATIONS
  // ============================================================

  const setsPerformed = useMemo(() => {
    let total = 0;
    const values = Object.values(checksByExercise);
    for (const arr of values) {
      if (!Array.isArray(arr)) continue;
      total += arr.filter(Boolean).length;
    }
    return total;
  }, [checksByExercise]);

  const avgRestSeconds = useMemo(() => {
    if (!restIntervalsMs.length) return 0;
    const avg =
      restIntervalsMs.reduce((sum, v) => sum + (Number(v) || 0), 0) /
      restIntervalsMs.length;
    return Math.max(0, Math.round(avg / 1000));
  }, [restIntervalsMs]);

  const totalRestSeconds = useMemo(() => {
    if (!restIntervalsMs.length) return 0;
    const total = restIntervalsMs.reduce((sum, v) => sum + (Number(v) || 0), 0);
    return Math.max(0, Math.round(total / 1000));
  }, [restIntervalsMs]);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div
      style={{
        padding: "20px 16px 90px",
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>
        Workouts
      </h1>

      <button
        onClick={() => openWorkoutModal(null)}
        style={{
          padding: "10px 20px",
          background: "var(--accent)",
          borderRadius: "999px",
          border: "none",
          fontSize: 14,
          fontWeight: 600,
          color: "var(--text)",
          marginBottom: 18,
          boxShadow: "0 0 14px color-mix(in srgb, var(--accent) 90%, transparent)",
        }}
      >
        + Add Workout
      </button>

      {loading ? (
        <>
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} lines={2} style={{ marginBottom: 10 }} />
          ))}
        </>
      ) : workouts.length === 0 ? (
        <EmptyState
          icon="💪"
          message="No workouts yet — add your first one."
          ctaLabel="Add Workout"
          ctaOnClick={() => openWorkoutModal()}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleWorkoutDragEnd}
        >
          <SortableContext
            items={workouts.map((w) => w.id)}
            strategy={verticalListSortingStrategy}
          >
            {workouts.map((workout) => {
              const exercises = expandedExercises[workout.id] || null;

              return (
                <SortableItem key={workout.id} id={workout.id}>
                  <div
                    style={{
                      background: "var(--card)",
                      borderRadius: 12,
                      padding: 14,
                      border: "1px solid var(--border)",
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{ flex: 1, cursor: "pointer" }}
                        onClick={() => toggleExpand(workout.id)}
                      >
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                          {workout.name || "Workout"}
                        </p>
                        <p style={{ margin: 0, fontSize: 11, opacity: 0.7 }}>
                          {formatSchedule(workout.scheduled_for)}
                        </p>
                      </div>

                      {/* NEW: Focus Mode button (does NOT affect expand/collapse) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openFocusForWorkout(workout);
                        }}
                        style={focusBtn}
                        title="Focus Mode"
                      >
                        <FaExpandAlt style={{ fontSize: 14 }} />
                      </button>

                      <FaEdit
                        style={{ fontSize: 14, cursor: "pointer" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openWorkoutModal(workout);
                        }}
                      />
                      <FaTrash
                        style={{ fontSize: 14, cursor: "pointer", color: "var(--accent)" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          askDeleteWorkout(workout.id);
                        }}
                      />
                      {exercises ? (
                        <FaChevronUp style={{ marginLeft: 6, fontSize: 12 }} />
                      ) : (
                        <FaChevronDown style={{ marginLeft: 6, fontSize: 12 }} />
                      )}
                    </div>

                    {exercises && (
                      <div style={{ marginTop: 10 }}>
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={(e) => handleExerciseDragEnd(workout.id, e)}
                        >
                          <SortableContext
                            items={exercises.map((e) => e.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {exercises.map((ex) => (
                              <SortableItem key={ex.id} id={ex.id}>
                                <div
                                  style={{
                                    background: "var(--card-2)",
                                    borderRadius: 10,
                                    padding: 10,
                                    marginBottom: 8,
                                    border: "1px solid var(--border)",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      gap: 8,
                                    }}
                                  >
                                    <div>
                                      <p
                                        style={{ margin: 0, fontSize: 14, fontWeight: 600 }}
                                      >
                                        {ex.name}
                                      </p>
                                      <p style={{ margin: 0, fontSize: 11, opacity: 0.7 }}>
                                        {(ex.sets ?? "-") +
                                          " x " +
                                          (ex.reps ?? "-") +
                                          (ex.weight ? ` — ${ex.weight}` : "")}
                                      </p>
                                    </div>
                                    <FaEdit
                                      style={{ fontSize: 13, cursor: "pointer" }}
                                      onClick={() => openExerciseModal(workout.id, ex)}
                                    />
                                    <FaTrash
                                      style={{
                                        fontSize: 13,
                                        cursor: "pointer",
                                        color: "var(--accent)",
                                      }}
                                      onClick={() => askDeleteExercise(ex.id, workout.id)}
                                    />
                                  </div>
                                </div>
                              </SortableItem>
                            ))}
                          </SortableContext>
                        </DndContext>

                        <button
                          onClick={() => openExerciseModal(workout.id, null)}
                          style={{
                            width: "100%",
                            padding: 8,
                            fontSize: 12,
                            background: "transparent",
                            borderRadius: 999,
                            border: "1px solid var(--border)",
                            color: "var(--text-dim)",
                            marginTop: 4,
                          }}
                        >
                          + Add Exercise
                        </button>
                      </div>
                    )}
                  </div>
                </SortableItem>
              );
            })}
          </SortableContext>
        </DndContext>
      )}

      {/* ========================================================
          WORKOUT MODAL
      ======================================================== */}

      {workoutModalOpen && (
        <div
          style={modalBackdrop}
          onClick={() => {
            setWorkoutModalOpen(false);
            setEditingWorkout(null);
          }}
        >
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>{editingWorkout ? "Edit Workout" : "New Workout"}</h2>
            <label style={labelStyle}>Name</label>
            <input
              style={inputStyle}
              value={workoutName}
              onChange={(e) => setWorkoutName(e.target.value)}
            />
            <label style={labelStyle}>Scheduled For</label>
            <input
              type="datetime-local"
              style={inputStyle}
              value={workoutSchedule}
              onChange={(e) => setWorkoutSchedule(e.target.value)}
            />
            {capMessage ? (
              <p style={{ color: "var(--accent)", fontSize: 14, marginTop: 8 }}>{capMessage}</p>
            ) : null}
            <button style={primaryBtn} onClick={saveWorkout}>
              Save Workout
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          EXERCISE MODAL
      ======================================================== */}

      {exerciseModalOpen && (
        <div
          style={modalBackdrop}
          onClick={() => {
            setExerciseModalOpen(false);
            setEditingExercise(null);
          }}
        >
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>
              {editingExercise ? "Edit Exercise" : "New Exercise"}
            </h2>
            <label style={labelStyle}>Name</label>
            <input
              style={inputStyle}
              value={exerciseName}
              onChange={(e) => setExerciseName(e.target.value)}
            />
            <label style={labelStyle}>Sets</label>
            <input
              style={inputStyle}
              type="number"
              value={exerciseSets}
              onChange={(e) => setExerciseSets(e.target.value)}
            />
            <label style={labelStyle}>Reps</label>
            <input
              style={inputStyle}
              type="number"
              value={exerciseReps}
              onChange={(e) => setExerciseReps(e.target.value)}
            />
            <label style={labelStyle}>Weight</label>
            <input
              style={inputStyle}
              value={exerciseWeight}
              onChange={(e) => setExerciseWeight(e.target.value)}
            />
            <button style={primaryBtn} onClick={saveExercise}>
              Save Exercise
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          DELETE CONFIRM
      ======================================================== */}

      {deleteModalOpen && (
        <div style={modalBackdrop} onClick={() => setDeleteModalOpen(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, color: "var(--accent)" }}>Confirm Delete?</h2>
            <p style={{ opacity: 0.7, marginBottom: 18 }}>
              This action cannot be undone.
            </p>
            <button style={secondaryBtn} onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </button>
            <button style={primaryBtn} onClick={confirmDelete}>
              Delete
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          FOCUS MODE OVERLAY (NEW)
      ======================================================== */}

      {focusOpen && focusWorkout && (
        <div style={focusOverlay}>
          <div style={focusHeader}>
            <button style={focusBackBtn} onClick={closeFocusMode}>
              <FaArrowLeft style={{ fontSize: 16 }} />
              <span style={{ fontSize: 13, fontWeight: 800 }}>Back</span>
            </button>

            <div style={focusHeaderTextWrap}>
              <div style={focusTitle}>{focusWorkout.name || "Workout"}</div>
              <div style={focusSub}>{formatSchedule(focusWorkout.scheduled_for)}</div>
            </div>

            <div style={focusHeaderRight}>
              {!sessionActive ? (
                <button style={focusStartBtn} onClick={startWorkoutSession}>
                  <FaPlay style={{ fontSize: 14 }} />
                  <span>Start</span>
                </button>
              ) : (
                <button style={focusEndBtn} onClick={() => endWorkoutSession(false)}>
                  <FaStop style={{ fontSize: 14 }} />
                  <span>End</span>
                </button>
              )}
            </div>
          </div>

          <div style={focusBody}>
            <div style={focusTopStats}>
              <div style={statCard}>
                <div style={statLabel}>Workout Time</div>
                <div style={statValue}>{formatHMS(workoutSeconds)}</div>
              </div>

              <div style={statCard}>
                <div style={statLabel}>Sets Done</div>
                <div style={statValue}>{setsPerformed}</div>
              </div>

              <div style={statCard}>
                <div style={statLabel}>Avg Rest</div>
                <div style={statValue}>{avgRestSeconds ? `${formatHMS(avgRestSeconds)}` : "—"}</div>
              </div>
            </div>

            {/* EXERCISES */}
            <div style={focusExercisesWrap}>
              {focusExercises.length === 0 ? (
                <div style={focusEmpty}>No exercises yet. Add exercises to this workout.</div>
              ) : (
                focusExercises.map((ex) => {
                  const setsCount = clamp(safeNum(ex.sets, 0), 0, 50);
                  const checks = Array.isArray(checksByExercise[ex.id])
                    ? checksByExercise[ex.id]
                    : Array.from({ length: setsCount }, () => false);

                  return (
                    <div key={ex.id} style={focusExerciseCard}>
                      <div style={focusExerciseTopRow}>
                        <div style={{ flex: 1 }}>
                          <div style={focusExerciseName}>{ex.name || "Exercise"}</div>
                          <div style={focusExerciseMeta}>
                            {(ex.sets ?? "-") +
                              " x " +
                              (ex.reps ?? "-") +
                              (ex.weight ? ` — ${ex.weight}` : "")}
                          </div>
                        </div>

                        <div style={focusExerciseSetsPill}>
                          {setsCount ? `${setsCount} sets` : "No sets"}
                        </div>
                      </div>

                      {setsCount > 0 && (
                        <div style={setsGrid}>
                          {checks.map((isChecked, idx) => (
                            <button
                              key={idx}
                              style={isChecked ? setBoxChecked : setBox}
                              onClick={() => {
                                // Toggle
                                const was = !!isChecked;
                                toggleSetCheck(ex.id, idx);

                                // If turning ON (was false) and session active, auto start rest (optional)
                                // We only auto start when countdown mode.
                                if (sessionActive && !restRunning && !was && restMode === "countdown") {
                                  // keep whatever restSeconds currently is
                                  startRestTimer();
                                }
                              }}
                              disabled={!sessionActive}
                              title={`Set ${idx + 1}`}
                            >
                              {isChecked ? <FaCheck /> : idx + 1}
                            </button>
                          ))}
                        </div>
                      )}

                      {!sessionActive && (
                        <div style={focusExerciseHint}>
                          Start the workout to enable set checkoffs.
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* REST TIMER PANEL */}
            <div style={restPanel}>
              <div style={restPanelTop}>
                <div style={restTitleRow}>
                  <div style={restTitle}>
                    <FaRegClock style={{ fontSize: 14 }} />
                    <span>Rest Timer</span>
                  </div>

                  <div style={restModeRow}>
                    <button
                      style={restMode === "countdown" ? restModeBtnActive : restModeBtn}
                      onClick={() => {
                        stopRestTimer(true);
                        setRestMode("countdown");
                        setRestSeconds(90);
                      }}
                      disabled={restRunning}
                    >
                      Countdown
                    </button>

                    <button
                      style={restMode === "stopwatch" ? restModeBtnActive : restModeBtn}
                      onClick={() => {
                        stopRestTimer(true);
                        setRestMode("stopwatch");
                        setRestSeconds(0);
                      }}
                      disabled={restRunning}
                    >
                      <FaStopwatch style={{ fontSize: 12 }} /> Stopwatch
                    </button>
                  </div>
                </div>

                <div style={restDisplayRow}>
                  <div style={restBigTime}>{formatHMS(restSeconds)}</div>

                  <div style={restBtnsCol}>
                    {!restRunning ? (
                      <button
                        style={restActionBtn}
                        onClick={() => {
                          if (!sessionActive) return;
                          startRestTimer();
                        }}
                        disabled={!sessionActive}
                      >
                        <FaPlay style={{ fontSize: 12 }} /> Start
                      </button>
                    ) : (
                      <button
                        style={restActionBtnHot}
                        onClick={() => stopRestTimer(false)}
                      >
                        <FaStop style={{ fontSize: 12 }} /> Stop
                      </button>
                    )}

                    <button style={restGhostBtn} onClick={resetRestTimer} disabled={restRunning}>
                      Reset
                    </button>
                  </div>
                </div>

                {restMode === "countdown" && (
                  <div style={restAdjustRow}>
                    <button
                      style={restAdjustBtn}
                      onClick={() => bumpRestSeconds(-15)}
                      disabled={restRunning}
                    >
                      <FaMinus /> 15s
                    </button>
                    <button
                      style={restAdjustBtn}
                      onClick={() => bumpRestSeconds(15)}
                      disabled={restRunning}
                    >
                      <FaPlus /> 15s
                    </button>

                    <button
                      style={restPresetBtn}
                      onClick={() => setRestPreset(60)}
                      disabled={restRunning}
                    >
                      1:00
                    </button>
                    <button
                      style={restPresetBtn}
                      onClick={() => setRestPreset(90)}
                      disabled={restRunning}
                    >
                      1:30
                    </button>
                    <button
                      style={restPresetBtn}
                      onClick={() => setRestPreset(120)}
                      disabled={restRunning}
                    >
                      2:00
                    </button>
                  </div>
                )}

                <div style={restMetaRow}>
                  <div style={restMetaPill}>
                    Rest intervals: <strong>{restIntervalsMs.length}</strong>
                  </div>
                  <div style={restMetaPill}>
                    Total rest: <strong>{totalRestSeconds ? formatHMS(totalRestSeconds) : "—"}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div style={focusBottomPad} />
          </div>

          {/* SUMMARY MODAL */}
          {summaryOpen && (
            <div style={summaryOverlay} onClick={() => setSummaryOpen(false)}>
              <div style={summaryCard} onClick={(e) => e.stopPropagation()}>
                <div style={summaryTitle}>Workout Summary</div>

                <div style={summaryGrid}>
                  <div style={summaryItem}>
                    <div style={summaryLabel}>Duration</div>
                    <div style={summaryValue}>{formatHMS(workoutSeconds)}</div>
                  </div>

                  <div style={summaryItem}>
                    <div style={summaryLabel}>Sets Performed</div>
                    <div style={summaryValue}>{setsPerformed}</div>
                  </div>

                  <div style={summaryItem}>
                    <div style={summaryLabel}>Avg Rest</div>
                    <div style={summaryValue}>{avgRestSeconds ? formatHMS(avgRestSeconds) : "—"}</div>
                  </div>

                  <div style={summaryItem}>
                    <div style={summaryLabel}>Total Rest</div>
                    <div style={summaryValue}>{totalRestSeconds ? formatHMS(totalRestSeconds) : "—"}</div>
                  </div>
                </div>

                <div style={summaryBtnsRow}>
                  <button style={summaryGhostBtn} onClick={() => setSummaryOpen(false)}>
                    Close
                  </button>
                  <button
                    style={summaryHotBtn}
                    onClick={() => {
                      // Future feature: save to history table.
                      // For now: close summary only.
                      setSummaryOpen(false);
                    }}
                  >
                    Save Later
                  </button>
                </div>

                <button
                  style={summaryX}
                  onClick={() => setSummaryOpen(false)}
                  aria-label="Close"
                >
                  <FaTimes />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SHARED STYLES (BASE FILE)
// ============================================================
// NOTE:
// The sections below are intentionally verbose and expanded.
// ArmPal code style prefers explicit, long-form UI definitions
// over abstracted helpers for readability, future theming,
// and ease of iteration without refactors.
// ============================================================

const modalBackdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.7)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: 20,
  zIndex: 999,
};

const modalCard = {
  background: "var(--card-2)",
  borderRadius: 12,
  border: "1px solid var(--border)",
  padding: 18,
  width: "100%",
  maxWidth: 420,
};

const inputStyle = {
  width: "100%",
  padding: 8,
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  marginBottom: 10,
};

const labelStyle = {
  fontSize: 12,
  opacity: 0.85,
  marginBottom: 4,
};

const primaryBtn = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "none",
  background: "var(--accent)",
  color: "var(--text)",
  fontWeight: 600,
  marginTop: 8,
};

const secondaryBtn = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text)",
  fontWeight: 600,
  marginTop: 8,
};

// ============================================================
// NEW STYLES: FOCUS MODE
// ============================================================

const focusBtn = {
  width: 34,
  height: 34,
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--text)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const focusOverlay = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "var(--bg)",
  zIndex: 99999,
  display: "flex",
  flexDirection: "column",
};

const focusHeader = {
  height: 64,
  paddingLeft: 12,
  paddingRight: 12,
  background: "var(--accent)",
  color: "var(--text)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexShrink: 0,
};

const focusBackBtn = {
  height: 40,
  paddingLeft: 12,
  paddingRight: 12,
  borderRadius: 14,
  border: "1px solid var(--border)",
  background: "rgba(0,0,0,0.22)",
  color: "var(--text)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
};

const focusHeaderTextWrap = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "center",
  overflow: "hidden",
};

const focusTitle = {
  fontSize: 16,
  fontWeight: 900,
  lineHeight: "18px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const focusSub = {
  fontSize: 12,
  opacity: 0.9,
  lineHeight: "14px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const focusHeaderRight = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 10,
};

const focusStartBtn = {
  height: 40,
  paddingLeft: 14,
  paddingRight: 14,
  borderRadius: 14,
  border: "1px solid var(--border)",
  background: "rgba(0,0,0,0.22)",
  color: "var(--text)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  fontWeight: 900,
};

const focusEndBtn = {
  height: 40,
  paddingLeft: 14,
  paddingRight: 14,
  borderRadius: 14,
  border: "none",
  background: "var(--accent)",
  color: "var(--text)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  fontWeight: 900,
  boxShadow: "0 0 16px color-mix(in srgb, var(--accent) 90%, transparent)",
};

const focusBody = {
  flex: 1,
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
  paddingTop: 12,
  paddingRight: 12,
  paddingBottom: 12,
  paddingLeft: 12,
};

const focusTopStats = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 10,
  marginBottom: 12,
};

const statCard = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  paddingTop: 10,
  paddingRight: 10,
  paddingBottom: 10,
  paddingLeft: 10,
};

const statLabel = {
  fontSize: 11,
  opacity: 0.75,
  marginBottom: 4,
};

const statValue = {
  fontSize: 16,
  fontWeight: 900,
};

const focusExercisesWrap = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  marginBottom: 14,
};

const focusEmpty = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  paddingTop: 14,
  paddingRight: 14,
  paddingBottom: 14,
  paddingLeft: 14,
  opacity: 0.8,
};

const focusExerciseCard = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  paddingTop: 12,
  paddingRight: 12,
  paddingBottom: 12,
  paddingLeft: 12,
};

const focusExerciseTopRow = {
  display: "flex",
  flexDirection: "row",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
};

const focusExerciseName = {
  fontSize: 15,
  fontWeight: 900,
  marginBottom: 4,
};

const focusExerciseMeta = {
  fontSize: 12,
  opacity: 0.75,
};

const focusExerciseSetsPill = {
  paddingTop: 6,
  paddingRight: 10,
  paddingBottom: 6,
  paddingLeft: 10,
  borderRadius: 999,
  border: "1px solid var(--border)",
  background: "var(--border)",
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const setsGrid = {
  marginTop: 10,
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const setBox = {
  width: 42,
  height: 42,
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--card-2)",
  color: "var(--text)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  cursor: "pointer",
};

const setBoxChecked = {
  width: 42,
  height: 42,
  borderRadius: 12,
  border: "1px solid color-mix(in srgb, var(--accent) 90%, transparent)",
  background: "color-mix(in srgb, var(--accent) 90%, transparent)",
  color: "var(--text)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 0 10px color-mix(in srgb, var(--accent) 90%, transparent)",
};

const focusExerciseHint = {
  marginTop: 10,
  fontSize: 12,
  opacity: 0.7,
};

const restPanel = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  paddingTop: 12,
  paddingRight: 12,
  paddingBottom: 12,
  paddingLeft: 12,
};

const restPanelTop = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const restTitleRow = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const restTitle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: 8,
  fontWeight: 900,
};

const restModeRow = {
  display: "flex",
  gap: 8,
};

const restModeBtn = {
  height: 34,
  paddingLeft: 10,
  paddingRight: 10,
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--border)",
  fontSize: 12,
  fontWeight: 900,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
};

const restModeBtnActive = {
  height: 34,
  paddingLeft: 10,
  paddingRight: 10,
  borderRadius: 12,
  border: "1px solid color-mix(in srgb, var(--accent) 90%, transparent)",
  background: "color-mix(in srgb, var(--accent) 90%, transparent)",
  color: "var(--text)",
  fontSize: 12,
  fontWeight: 900,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
};

const restDisplayRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const restBigTime = {
  fontSize: 28,
  fontWeight: 900,
  letterSpacing: "0.5px",
};

const restBtnsCol = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const restActionBtn = {
  height: 38,
  paddingLeft: 12,
  paddingRight: 12,
  borderRadius: 14,
  border: "1px solid var(--border)",
  background: "var(--card-2)",
  color: "var(--text)",
  fontWeight: 900,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
};

const restActionBtnHot = {
  height: 38,
  paddingLeft: 12,
  paddingRight: 12,
  borderRadius: 14,
  border: "none",
  background: "var(--accent)",
  color: "var(--text)",
  fontWeight: 900,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  boxShadow: "0 0 14px color-mix(in srgb, var(--accent) 90%, transparent)",
};

const restGhostBtn = {
  height: 38,
  paddingLeft: 12,
  paddingRight: 12,
  borderRadius: 14,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--border)",
  fontWeight: 900,
};

const restAdjustRow = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 4,
};

const restAdjustBtn = {
  height: 34,
  paddingLeft: 10,
  paddingRight: 10,
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--card-2)",
  color: "var(--text)",
  fontWeight: 900,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
};

const restPresetBtn = {
  height: 34,
  paddingLeft: 12,
  paddingRight: 12,
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--border)",
  fontWeight: 900,
};

const restMetaRow = {
  marginTop: 8,
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const restMetaPill = {
  paddingTop: 6,
  paddingRight: 10,
  paddingBottom: 6,
  paddingLeft: 10,
  borderRadius: 999,
  border: "1px solid var(--border)",
  background: "var(--border)",
  fontSize: 12,
  opacity: 0.95,
};

const focusBottomPad = {
  height: 24,
};

const summaryOverlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.65)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 999999,
};

const summaryCard = {
  position: "relative",
  width: "100%",
  maxWidth: 420,
  background: "var(--card-2)",
  borderRadius: 16,
  border: "1px solid var(--border)",
  paddingTop: 18,
  paddingRight: 18,
  paddingBottom: 18,
  paddingLeft: 18,
  color: "var(--text)",
};

const summaryTitle = {
  fontSize: 18,
  fontWeight: 900,
  marginBottom: 12,
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const summaryItem = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  paddingTop: 10,
  paddingRight: 10,
  paddingBottom: 10,
  paddingLeft: 10,
};

const summaryLabel = {
  fontSize: 11,
  opacity: 0.75,
  marginBottom: 4,
};

const summaryValue = {
  fontSize: 16,
  fontWeight: 900,
};

const summaryBtnsRow = {
  display: "flex",
  gap: 10,
  marginTop: 14,
};

const summaryGhostBtn = {
  flex: 1,
  height: 42,
  borderRadius: 14,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text)",
  fontWeight: 900,
};

const summaryHotBtn = {
  flex: 1,
  height: 42,
  borderRadius: 14,
  border: "none",
  background: "var(--accent)",
  color: "var(--text)",
  fontWeight: 900,
  boxShadow: "0 0 14px color-mix(in srgb, var(--accent) 90%, transparent)",
};

const summaryX = {
  position: "absolute",
  top: 10,
  right: 10,
  width: 34,
  height: 34,
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "rgba(0,0,0,0.25)",
  color: "var(--text)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
