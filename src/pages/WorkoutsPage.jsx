// src/pages/WorkoutsPage.jsx
import React, { useEffect, useState } from "react";
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
import { FaChevronDown, FaChevronUp, FaEdit, FaTrash } from "react-icons/fa";

/* -------------------------------
   CUSTOM SORTABLE ITEM WRAPPER
   (We now split it into: 
   - left drag zone (40%)
   - right scroll/click zone (60%)
--------------------------------*/
function SortableItem({ id, leftContent, rightContent }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: "flex", width: "100%" }}>
        {/* LEFT DRAG 40% */}
        <div
          style={{
            width: "40%",
            paddingRight: 6,
            touchAction: "none",
            cursor: "grab",
            display: "flex",
            alignItems: "center",
          }}
          {...attributes}
          {...listeners}
        >
          {leftContent}
        </div>

        {/* RIGHT INTERACTION ZONE */}
        <div
          style={{
            width: "60%",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {rightContent}
        </div>
      </div>
    </div>
  );
}

/* ===========================================================
   MAIN PAGE — ALL LOGIC UNTOUCHED, ONLY DRAG ZONE FIXED
=========================================================== */
export default function WorkoutsPage() {
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

  // Drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Load user + workouts
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      if (user) await loadWorkouts(user.id);
      setLoading(false);
    })();
  }, []);

  async function loadWorkouts(uid) {
    const { data, error } = await supabase
      .from("workouts")
      .select("*")
      .eq("user_id", uid)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    if (!error) setWorkouts(data || []);
  }

  async function loadExercises(workoutId) {
    const { data, error } = await supabase
      .from("exercises")
      .select("*")
      .eq("workout_id", workoutId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    return error ? [] : data || [];
  }

  async function toggleExpand(workoutId) {
    if (expandedExercises[workoutId]) {
      const c = { ...expandedExercises };
      delete c[workoutId];
      setExpandedExercises(c);
    } else {
      const ex = await loadExercises(workoutId);
      setExpandedExercises((p) => ({ ...p, [workoutId]: ex }));
    }
  }

  // DRAG — WORKOUTS
  async function handleWorkoutDragEnd(e) {
    const { active, over } = e;
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

  // DRAG — EXERCISES
  async function handleExerciseDragEnd(workoutId, e) {
    const list = expandedExercises[workoutId] || [];
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const oldIndex = list.findIndex((x) => x.id === active.id);
    const newIndex = list.findIndex((x) => x.id === over.id);
    const reordered = arrayMove(list, oldIndex, newIndex);

    for (let i = 0; i < reordered.length; i++) {
      await supabase
        .from("exercises")
        .update({ position: i })
        .eq("id", reordered[i].id);
    }

    setExpandedExercises((p) => ({ ...p, [workoutId]: reordered }));
  }

  // Workout modal open
  function openWorkoutModal(workout = null) {
    setEditingWorkout(workout);
    setWorkoutName(workout?.name || "");
    setWorkoutSchedule(
      workout?.scheduled_for ? workout.scheduled_for.slice(0, 16) : ""
    );
    setWorkoutModalOpen(true);
  }

  // Save workout
  async function saveWorkout() {
    if (!user) return;
    const payload = {
      user_id: user.id,
      name: workoutName || "Workout",
      scheduled_for: workoutSchedule
        ? new Date(workoutSchedule).toISOString()
        : null,
    };

    if (editingWorkout) {
      await supabase
        .from("workouts")
        .update(payload)
        .eq("id", editingWorkout.id);
    } else {
      payload.position = workouts.length;
      await supabase.from("workouts").insert(payload);
    }

    setWorkoutModalOpen(false);
    setEditingWorkout(null);
    await loadWorkouts(user.id);
  }

  async function deleteWorkout(id) {
    await supabase.from("workouts").delete().eq("id", id);
    if (user) await loadWorkouts(user.id);
  }

  // Exercise modal open
  function openExerciseModal(workoutId, exercise = null) {
    setExerciseWorkoutId(workoutId);
    setEditingExercise(exercise);
    setExerciseName(exercise?.name || "");
    setExerciseSets(exercise?.sets ?? "");
    setExerciseReps(exercise?.reps ?? "");
    setExerciseWeight(exercise?.weight ?? "");
    setExerciseModalOpen(true);
  }

  // Save exercise
  async function saveExercise() {
    if (!user || !exerciseWorkoutId) return;

    const payload = {
      user_id: user.id,
      workout_id: exerciseWorkoutId,
      name: exerciseName || "Exercise",
      sets: exerciseSets === "" ? null : Number(exerciseSets),
      reps: exerciseReps === "" ? null : Number(exerciseReps),
      weight: exerciseWeight === "" ? null : exerciseWeight,
    };

    if (editingExercise) {
      await supabase
        .from("exercises")
        .update(payload)
        .eq("id", editingExercise.id);
    } else {
      const list = expandedExercises[exerciseWorkoutId] || [];
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

  function formatSchedule(v) {
    if (!v) return "Not scheduled";
    const d = new Date(v);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /* -------------------------------------------------------- */
  /*                         RENDER                           */
  /* -------------------------------------------------------- */
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
          background: "#ff2f2f",
          borderRadius: "999px",
          border: "none",
          fontSize: 14,
          fontWeight: 600,
          color: "white",
          marginBottom: 18,
          boxShadow: "0 0 14px rgba(255,47,47,0.35)",
        }}
      >
        + Add Workout
      </button>

      {/* LOADING */}
      {loading ? (
        <p style={{ opacity: 0.7 }}>Loading workouts...</p>
      ) : workouts.length === 0 ? (
        <p style={{ opacity: 0.7 }}>No workouts yet. Add your first one.</p>
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
                <SortableItem
                  key={workout.id}
                  id={workout.id}
                  leftContent={
                    <div
                      onClick={() => toggleExpand(workout.id)}
                      style={{ padding: 4 }}
                    >
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                        {workout.name || "Workout"}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, opacity: 0.7 }}>
                        {formatSchedule(workout.scheduled_for)}
                      </p>
                    </div>
                  }
                  rightContent={
                    <div
                      style={{
                        background: "#0f0f0f",
                        borderRadius: 12,
                        padding: 14,
                        border: "1px solid rgba(255,255,255,0.08)",
                        marginBottom: 10,
                      }}
                    >
                      {/* HEADER — RIGHT SIDE ONLY */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <FaEdit
                          style={{ fontSize: 14, cursor: "pointer" }}
                          onClick={() => openWorkoutModal(workout)}
                        />
                        <FaTrash
                          style={{
                            fontSize: 14,
                            cursor: "pointer",
                            color: "#ff4d4d",
                          }}
                          onClick={() => deleteWorkout(workout.id)}
                        />
                        {exercises ? (
                          <FaChevronUp style={{ marginLeft: 6, fontSize: 12 }} />
                        ) : (
                          <FaChevronDown
                            style={{ marginLeft: 6, fontSize: 12 }}
                          />
                        )}
                      </div>

                      {/* EXERCISES */}
                      {exercises && (
                        <div style={{ marginTop: 10 }}>
                          <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={(e) =>
                              handleExerciseDragEnd(workout.id, e)
                            }
                          >
                            <SortableContext
                              items={exercises.map((x) => x.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              {exercises.map((ex) => (
                                <SortableItem
                                  key={ex.id}
                                  id={ex.id}
                                  leftContent={
                                    <div style={{ padding: 4 }}>
                                      <p
                                        style={{
                                          margin: 0,
                                          fontSize: 14,
                                          fontWeight: 600,
                                        }}
                                      >
                                        {ex.name}
                                      </p>
                                      <p
                                        style={{
                                          margin: 0,
                                          fontSize: 11,
                                          opacity: 0.7,
                                        }}
                                      >
                                        {(ex.sets ?? "-") +
                                          " x " +
                                          (ex.reps ?? "-") +
                                          (ex.weight ? ` — ${ex.weight}` : "")}
                                      </p>
                                    </div>
                                  }
                                  rightContent={
                                    <div
                                      style={{
                                        background: "#151515",
                                        borderRadius: 10,
                                        padding: 10,
                                        marginBottom: 8,
                                        border:
                                          "1px solid rgba(255,255,255,0.06)",
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: "flex",
                                          justifyContent: "flex-end",
                                          alignItems: "center",
                                          gap: 10,
                                        }}
                                      >
                                        <FaEdit
                                          style={{
                                            fontSize: 13,
                                            cursor: "pointer",
                                          }}
                                          onClick={() =>
                                            openExerciseModal(workout.id, ex)
                                          }
                                        />
                                        <FaTrash
                                          style={{
                                            fontSize: 13,
                                            cursor: "pointer",
                                            color: "#ff4d4d",
                                          }}
                                          onClick={() =>
                                            deleteExercise(ex.id, workout.id)
                                          }
                                        />
                                      </div>
                                    </div>
                                  }
                                />
                              ))}
                            </SortableContext>
                          </DndContext>

                          <button
                            onClick={() =>
                              openExerciseModal(workout.id, null)
                            }
                            style={{
                              width: "100%",
                              padding: 8,
                              fontSize: 12,
                              background: "transparent",
                              borderRadius: 999,
                              border: "1px solid rgba(255,255,255,0.14)",
                              color: "#ccc",
                              marginTop: 4,
                            }}
                          >
                            + Add Exercise
                          </button>
                        </div>
                      )}
                    </div>
                  }
                />
              );
            })}
          </SortableContext>
        </DndContext>
      )}

      {/* Workout Modal */}
      {workoutModalOpen && (
        <div style={modalBackdrop} onClick={() => setWorkoutModalOpen(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>
              {editingWorkout ? "Edit Workout" : "New Workout"}
            </h2>

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

            <button style={primaryBtn} onClick={saveWorkout}>
              Save Workout
            </button>
          </div>
        </div>
      )}

      {/* EXERCISE MODAL */}
      {exerciseModalOpen && (
        <div style={modalBackdrop} onClick={() => setExerciseModalOpen(false)}>
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
              type="number"
              style={inputStyle}
              value={exerciseSets}
              onChange={(e) => setExerciseSets(e.target.value)}
            />

            <label style={labelStyle}>Reps</label>
            <input
              type="number"
              style={inputStyle}
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
    </div>
  );
}

/* ---------------- MODAL SHARED STYLES ---------------- */

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
  background: "#111",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  padding: 18,
  width: "100%",
  maxWidth: 420,
};

const inputStyle = {
  width: "100%",
  padding: 8,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "#000",
  color: "white",
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
  background: "#ff2f2f",
  color: "white",
  fontWeight: 600,
  marginTop: 8,
};
