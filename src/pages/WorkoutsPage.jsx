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
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";
import { FaChevronDown, FaChevronUp, FaEdit, FaTrash } from "react-icons/fa";

// Wrapper for drag items
function SortableItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    touchAction: "none",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

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

  // Confirm delete
  const [deleteWorkoutId, setDeleteWorkoutId] = useState(null);
  const [deleteExerciseData, setDeleteExerciseData] = useState(null);

  // Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Load user + workouts
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user);

      if (data?.user) {
        await loadWorkouts(data.user.id);
      }
      setLoading(false);
    })();
  }, []);

  async function loadWorkouts(uid) {
    const { data, error } = await supabase
      .from("workouts")
      .select("*")
      .eq("user_id", uid)
      .order("position", { ascending: true });

    if (error) console.error(error);

    setWorkouts(data || []);
  }

  async function loadExercises(workoutId) {
    const { data, error } = await supabase
      .from("exercises")
      .select("*")
      .eq("workout_id", workoutId)
      .order("position", { ascending: true });

    if (error) console.error(error);
    return data || [];
  }

  // Expand workout + load exercises
  async function toggleExpand(workoutId) {
    if (expandedExercises[workoutId]) {
      // collapse
      const copy = { ...expandedExercises };
      delete copy[workoutId];
      setExpandedExercises(copy);
    } else {
      // expand + load
      const ex = await loadExercises(workoutId);
      setExpandedExercises((prev) => ({ ...prev, [workoutId]: ex }));
    }
  }

  // Drag reorder workouts
  async function handleWorkoutDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = workouts.findIndex((w) => w.id === active.id);
    const newIndex = workouts.findIndex((w) => w.id === over.id);

    const reordered = arrayMove(workouts, oldIndex, newIndex);
    setWorkouts(reordered);

    reordered.forEach(async (w, i) => {
      await supabase.from("workouts").update({ position: i }).eq("id", w.id);
    });
  }

  // Drag reorder exercises
  async function handleExerciseDragEnd(workoutId, event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const list = expandedExercises[workoutId] || [];
    const oldIndex = list.findIndex((e) => e.id === active.id);
    const newIndex = list.findIndex((e) => e.id === over.id);

    const reordered = arrayMove(list, oldIndex, newIndex);

    reordered.forEach(async (ex, i) => {
      await supabase.from("exercises").update({ position: i }).eq("id", ex.id);
    });

    setExpandedExercises((prev) => ({
      ...prev,
      [workoutId]: reordered,
    }));
  }

  // Workout modal
  function openWorkoutModal(workout = null) {
    setEditingWorkout(workout);
    setWorkoutName(workout?.name || "");
    setWorkoutSchedule(
      workout?.scheduled_for ? workout.scheduled_for.slice(0, 16) : ""
    );
    setWorkoutModalOpen(true);
  }

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
      await supabase.from("workouts").update(payload).eq("id", editingWorkout.id);
    } else {
      payload.position = workouts.length;
      await supabase.from("workouts").insert(payload);
    }

    setWorkoutModalOpen(false);
    setEditingWorkout(null);
    await loadWorkouts(user.id);
  }

  // Delete workout confirm
  async function confirmDeleteWorkout() {
    await supabase.from("workouts").delete().eq("id", deleteWorkoutId);
    setDeleteWorkoutId(null);
    await loadWorkouts(user.id);
  }

  // Exercise modal
  function openExerciseModal(workoutId, ex = null) {
    setExerciseWorkoutId(workoutId);
    setEditingExercise(ex);
    setExerciseName(ex?.name || "");
    setExerciseSets(ex?.sets ?? "");
    setExerciseReps(ex?.reps ?? "");
    setExerciseWeight(ex?.weight ?? "");
    setExerciseModalOpen(true);
  }

  async function saveExercise() {
    if (!user || !exerciseWorkoutId) return;

    const payload = {
      user_id: user.id,
      workout_id: exerciseWorkoutId,
      name: exerciseName || "Exercise",
      sets: exerciseSets === "" ? null : Number(exerciseSets),
      reps: exerciseReps === "" ? null : Number(exerciseReps),
      weight: exerciseWeight || null,
    };

    if (editingExercise) {
      await supabase
        .from("exercises")
        .update(payload)
        .eq("id", editingExercise.id);
    } else {
      payload.position = expandedExercises[exerciseWorkoutId]?.length || 0;
      await supabase.from("exercises").insert(payload);
    }

    const refreshed = await loadExercises(exerciseWorkoutId);

    setExpandedExercises((prev) => ({
      ...prev,
      [exerciseWorkoutId]: refreshed,
    }));

    setExerciseModalOpen(false);
    setEditingExercise(null);
  }

  // Delete exercise
  async function confirmDeleteExercise() {
    const { id, workoutId } = deleteExerciseData;

    await supabase.from("exercises").delete().eq("id", id);

    const refreshed = await loadExercises(workoutId);

    setExpandedExercises((prev) => ({
      ...prev,
      [workoutId]: refreshed,
    }));

    setDeleteExerciseData(null);
  }

  function formatSchedule(value) {
    if (!value) return "Not scheduled";
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div style={{ padding: "20px 16px 90px", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>
        Workouts
      </h1>

      <button
        onClick={() => openWorkoutModal(null)}
        style={{
          padding: "10px 20px",
          background: "#ff2f2f",
          borderRadius: 999,
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

      {loading ? (
        <p style={{ opacity: 0.7 }}>Loading workouts...</p>
      ) : workouts.length === 0 ? (
        <p style={{ opacity: 0.7 }}>No workouts yet. Add one!</p>
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
            {workouts.map((w) => {
              const exercises = expandedExercises[w.id] || null;

              return (
                <SortableItem key={w.id} id={w.id}>
                  <div
                    style={{
                      background: "#0f0f0f",
                      padding: 14,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.08)",
                      marginBottom: 10,
                    }}
                  >
                    {/* Header */}
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
                        onClick={() => toggleExpand(w.id)}
                      >
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                          {w.name}
                        </p>
                        <p style={{ margin: 0, fontSize: 11, opacity: 0.7 }}>
                          {formatSchedule(w.scheduled_for)}
                        </p>
                      </div>

                      <FaEdit
                        style={{ cursor: "pointer", fontSize: 14 }}
                        onClick={() => openWorkoutModal(w)}
                      />

                      <FaTrash
                        style={{
                          cursor: "pointer",
                          fontSize: 14,
                          color: "#ff4d4d",
                        }}
                        onClick={() => setDeleteWorkoutId(w.id)}
                      />

                      {exercises ? (
                        <FaChevronUp style={{ fontSize: 12 }} />
                      ) : (
                        <FaChevronDown style={{ fontSize: 12 }} />
                      )}
                    </div>

                    {/* Exercises */}
                    {exercises && (
                      <div style={{ marginTop: 10 }}>
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={(e) =>
                            handleExerciseDragEnd(w.id, e)
                          }
                        >
                          <SortableContext
                            items={exercises.map((e) => e.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {exercises.map((ex) => (
                              <SortableItem key={ex.id} id={ex.id}>
                                <div
                                  style={{
                                    background: "#151515",
                                    border: "1px solid rgba(255,255,255,0.06)",
                                    borderRadius: 10,
                                    padding: 10,
                                    marginBottom: 8,
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
                                          (ex.weight
                                            ? ` — ${ex.weight}`
                                            : "")}
                                      </p>
                                    </div>

                                    <FaEdit
                                      style={{ cursor: "pointer", fontSize: 13 }}
                                      onClick={() =>
                                        openExerciseModal(w.id, ex)
                                      }
                                    />

                                    <FaTrash
                                      style={{
                                        cursor: "pointer",
                                        fontSize: 13,
                                        color: "#ff4d4d",
                                      }}
                                      onClick={() =>
                                        setDeleteExerciseData({
                                          id: ex.id,
                                          workoutId: w.id,
                                        })
                                      }
                                    />
                                  </div>
                                </div>
                              </SortableItem>
                            ))}
                          </SortableContext>
                        </DndContext>

                        <button
                          onClick={() => openExerciseModal(w.id, null)}
                          style={{
                            width: "100%",
                            padding: 8,
                            borderRadius: 999,
                            border: "1px solid rgba(255,255,255,0.14)",
                            background: "transparent",
                            color: "#ccc",
                            fontSize: 12,
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

      {/* Workout modal */}
      {workoutModalOpen && (
        <div style={modalBackdrop} onClick={() => setWorkoutModalOpen(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2>{editingWorkout ? "Edit Workout" : "New Workout"}</h2>

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

      {/* Exercise modal */}
      {exerciseModalOpen && (
        <div style={modalBackdrop} onClick={() => setExerciseModalOpen(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2>{editingExercise ? "Edit Exercise" : "New Exercise"}</h2>

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
              placeholder="225 lb"
            />

            <button style={primaryBtn} onClick={saveExercise}>
              Save Exercise
            </button>
          </div>
        </div>
      )}

      {/* Workout Delete */}
      {deleteWorkoutId && (
        <div style={modalBackdrop} onClick={() => setDeleteWorkoutId(null)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: "#ff4d4d" }}>Confirm Delete?</h2>

            <button
              onClick={() => setDeleteWorkoutId(null)}
              style={secondaryBtn}
            >
              Cancel
            </button>

            <button onClick={confirmDeleteWorkout} style={primaryBtn}>
              Delete Workout
            </button>
          </div>
        </div>
      )}

      {/* Exercise Delete */}
      {deleteExerciseData && (
        <div style={slideUpContainer}>
          <p style={{ color: "#ff4d4d", marginBottom: 10 }}>
            Delete this exercise?
          </p>

          <button
            onClick={() => setDeleteExerciseData(null)}
            style={secondaryBtn}
          >
            Cancel
          </button>

          <button onClick={confirmDeleteExercise} style={primaryBtn}>
            Delete Exercise
          </button>
        </div>
      )}
    </div>
  );
}

//
// Styles
//
const modalBackdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 999,
};

const modalCard = {
  background: "#111",
  borderRadius: 12,
  padding: 18,
  width: "100%",
  maxWidth: 420,
};

const inputStyle = {
  width: "100%",
  padding: 8,
  borderRadius: 8,
  background: "#000",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "white",
  marginBottom: 10,
};

const labelStyle = { fontSize: 12, opacity: 0.8, marginBottom: 4 };

const primaryBtn = {
  width: "100%",
  padding: 10,
  background: "#ff2f2f",
  borderRadius: 10,
  border: "none",
  color: "white",
  fontWeight: 600,
  marginTop: 8,
};

const secondaryBtn = {
  width: "100%",
  padding: 10,
  background: "#333",
  borderRadius: 10,
  border: "none",
  color: "white",
  marginBottom: 10,
};

const slideUpContainer = {
  position: "fixed",
  bottom: 0,
  left: 0,
  width: "100%",
  background: "#111",
  padding: 16,
  borderTop: "1px solid rgba(255,255,255,0.15)",
  zIndex: 999,
};
