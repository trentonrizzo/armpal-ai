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

// Draggable wrapper
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

  // CONFIRM DELETE: Workouts (full modal)
  const [deleteWorkoutId, setDeleteWorkoutId] = useState(null);

  // CONFIRM DELETE: Exercises (small slide-up)
  const [deleteExerciseData, setDeleteExerciseData] = useState(null);
  // deleteExerciseData = { id: X, workoutId: Y }

  // Drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Initial load
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

    if (error) {
      console.error("Error loading workouts:", error.message);
      return;
    }
    setWorkouts(data || []);
  }

  async function loadExercises(workoutId) {
    const { data, error } = await supabase
      .from("exercises")
      .select("*")
      .eq("workout_id", workoutId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading exercises:", error.message);
      return [];
    }
    return data || [];
  }

  // Expand workout
  async function toggleExpand(workoutId) {
    if (expandedExercises[workoutId]) {
      const copy = { ...expandedExercises };
      delete copy[workoutId];
      setExpandedExercises(copy);
    } else {
      const ex = await loadExercises(workoutId);
      setExpandedExercises((prev) => ({ ...prev, [workoutId]: ex }));
    }
  }

  // Drag end for workouts
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

  // Drag end for exercises
  async function handleExerciseDragEnd(workoutId, event) {
    const list = expandedExercises[workoutId] || [];
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = list.findIndex((e) => e.id === active.id);
    const newIndex = list.findIndex((e) => e.id === over.id);
    const reordered = arrayMove(list, oldIndex, newIndex);

    for (let i = 0; i < reordered.length; i++) {
      await supabase
        .from("exercises")
        .update({ position: i })
        .eq("id", reordered[i].id);
    }

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

  // WORKOUT DELETE (modal confirm)
  async function confirmDeleteWorkout() {
    await supabase.from("workouts").delete().eq("id", deleteWorkoutId);
    setDeleteWorkoutId(null);
    if (user) await loadWorkouts(user.id);
  }

  // EXERCISE DELETE (slide-up)
  async function confirmDeleteExercise() {
    if (!deleteExerciseData) return;

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
    const d = new Date(value);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div
      style={{
        padding: "20px 16px 90px",
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      <h1
        style={{
          fontSize: 22,
          fontWeight: 700,
          marginBottom: 16,
        }}
      >
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
                <SortableItem key={workout.id} id={workout.id}>
                  <div
                    style={{
                      background: "#0f0f0f",
                      borderRadius: 12,
                      padding: 14,
                      border: "1px solid rgba(255,255,255,0.08)",
                      marginBottom: 10,
                    }}
                  >
                    {/* Header row */}
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
                        <p
                          style={{
                            margin: 0,
                            fontSize: 15,
                            fontWeight: 600,
                          }}
                        >
                          {workout.name || "Workout"}
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 11,
                            opacity: 0.7,
                          }}
                        >
                          {formatSchedule(workout.scheduled_for)}
                        </p>
                      </div>

                      <FaEdit
                        style={{ fontSize: 14, cursor: "pointer" }}
                        onClick={() => openWorkoutModal(workout)}
                      />

                      {/* DELETE triggers modal */}
                      <FaTrash
                        style={{
                          fontSize: 14,
                          cursor: "pointer",
                          color: "#ff4d4d",
                        }}
                        onClick={() => setDeleteWorkoutId(workout.id)}
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
                          onDragEnd={(event) =>
                            handleExerciseDragEnd(workout.id, event)
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
                                    borderRadius: 10,
                                    padding: 10,
                                    marginBottom: 8,
                                    border: "1px solid rgba(255,255,255,0.06)",
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
                                      style={{
                                        fontSize: 13,
                                        cursor: "pointer",
                                      }}
                                      onClick={() =>
                                        openExerciseModal(workout.id, ex)
                                      }
                                    />

                                    {/* DELETE -> slide-up confirm */}
                                    <FaTrash
                                      style={{
                                        fontSize: 13,
                                        cursor: "pointer",
                                        color: "#ff4d4d",
                                      }}
                                      onClick={() =>
                                        setDeleteExerciseData({
                                          id: ex.id,
                                          workoutId: workout.id,
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
                          onClick={() => openExerciseModal(workout.id, null)}
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
                </SortableItem>
              );
            })}
          </SortableContext>
        </DndContext>
      )}

      {/* WORKOUT MODAL */}
      {workoutModalOpen && (
        <div
          style={modalBackdrop}
          onClick={() => {
            setWorkoutModalOpen(false);
            setEditingWorkout(null);
          }}
        >
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>
              {editingWorkout ? "Edit Workout" : "New Workout"}
            </h2>

            <label style={labelStyle}>Name</label>
            <input
              style={inputStyle}
              value={workoutName}
              onChange={(e) => setWorkoutName(e.target.value)}
              placeholder="Push Day, Pull Day, Legs, etc."
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
              placeholder="Bench Press, Squat, etc."
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
              placeholder="e.g. 225 lb"
            />

            <button style={primaryBtn} onClick={saveExercise}>
              Save Exercise
            </button>
          </div>
        </div>
      )}

      {/* WORKOUT DELETE CONFIRM (FULL MODAL) */}
      {deleteWorkoutId && (
        <div style={modalBackdrop} onClick={() => setDeleteWorkoutId(null)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, color: "#ff4d4d" }}>
              Confirm Delete?
            </h2>

            <p style={{ opacity: 0.8, marginBottom: 16 }}>
              This action cannot be undone.
            </p>

            <button
              onClick={() => setDeleteWorkoutId(null)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 10,
                background: "#333",
                border: "none",
                color: "white",
                marginBottom: 10,
              }}
            >
              Cancel
            </button>

            <button
              onClick={confirmDeleteWorkout}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 10,
                background: "#ff2f2f",
                border: "none",
                color: "white",
                fontWeight: 600,
              }}
            >
              Delete Workout
            </button>
          </div>
        </div>
      )}

      {/* EXERCISE DELETE CONFIRM (SMALL SLIDE-UP) */}
      {deleteExerciseData && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            width: "100%",
            background: "#111",
            borderTop: "1px solid rgba(255,255,255,0.15)",
            padding: 16,
            zIndex: 999,
          }}
        >
          <p style={{ margin: 0, marginBottom: 10, color: "#ff4d4d" }}>
            Delete this exercise?
          </p>

          <button
            onClick={() => setDeleteExerciseData(null)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              background: "#333",
              border: "none",
              color: "white",
              marginBottom: 10,
            }}
          >
            Cancel
          </button>

          <button
            onClick={confirmDeleteExercise}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              background: "#ff2f2f",
              border: "none",
              color: "white",
              fontWeight: 600,
            }}
          >
            Delete Exercise
          </button>
        </div>
      )}
    </div>
  );
}

// Shared styles
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
