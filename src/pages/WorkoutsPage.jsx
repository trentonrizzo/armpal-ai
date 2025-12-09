// src/pages/WorkoutsPage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";

import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import { FaChevronDown, FaChevronUp, FaEdit, FaTrash } from "react-icons/fa";

/* ============================================================
   DRAG WRAPPER
   ============================================================ */
function SortableItem({ id, dragOnly = false, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    touchAction: "none",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(dragOnly ? listeners : {})}
      {...(dragOnly ? attributes : {})}
    >
      {children}
    </div>
  );
}

/* ============================================================
   MAIN PAGE
   ============================================================ */
export default function WorkoutsPage() {
  const [user, setUser] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);

  // Modals (Workout + Exercise)
  const [workoutModal, setWorkoutModal] = useState(false);
  const [exerciseModal, setExerciseModal] = useState(false);

  const [editingWorkout, setEditingWorkout] = useState(null);
  const [editingExercise, setEditingExercise] = useState(null);

  const [workoutName, setWorkoutName] = useState("");
  const [workoutSchedule, setWorkoutSchedule] = useState("");

  const [exerciseWorkoutId, setExerciseWorkoutId] = useState(null);
  const [exerciseName, setExerciseName] = useState("");
  const [exerciseSets, setExerciseSets] = useState("");
  const [exerciseReps, setExerciseReps] = useState("");
  const [exerciseWeight, setExerciseWeight] = useState("");

  // Delete confirm modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: "workout"|"exercise", id, workoutId? }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  /* ============================================================
     LOAD USER + WORKOUTS
     ============================================================ */
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
    const { data } = await supabase
      .from("workouts")
      .select("*")
      .eq("user_id", uid)
      .order("position", { ascending: true });

    setWorkouts(data || []);
  }

  async function loadExercises(workoutId) {
    const { data } = await supabase
      .from("exercises")
      .select("*")
      .eq("workout_id", workoutId)
      .order("position", { ascending: true });

    return data || [];
  }

  /* ============================================================
     EXPAND / COLLAPSE WORKOUT
     ============================================================ */
  async function toggleExpand(id) {
    if (expanded[id]) {
      const copy = { ...expanded };
      delete copy[id];
      setExpanded(copy);
    } else {
      const ex = await loadExercises(id);
      setExpanded((prev) => ({ ...prev, [id]: ex }));
    }
  }

  /* ============================================================
     DRAG WORKOUT
     ============================================================ */
  async function handleWorkoutDragEnd(e) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const oldIndex = workouts.findIndex((w) => w.id === active.id);
    const newIndex = workouts.findIndex((w) => w.id === over.id);

    const reordered = arrayMove(workouts, oldIndex, newIndex);
    setWorkouts(reordered);

    // Save new positions
    for (let i = 0; i < reordered.length; i++) {
      await supabase
        .from("workouts")
        .update({ position: i })
        .eq("id", reordered[i].id);
    }
  }

  /* ============================================================
     DRAG EXERCISES
     ============================================================ */
  async function handleExerciseDragEnd(workoutId, e) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const exercises = expanded[workoutId] || [];
    const oldIndex = exercises.findIndex((ex) => ex.id === active.id);
    const newIndex = exercises.findIndex((ex) => ex.id === over.id);

    const reordered = arrayMove(exercises, oldIndex, newIndex);

    // Save new order
    for (let i = 0; i < reordered.length; i++) {
      await supabase
        .from("exercises")
        .update({ position: i })
        .eq("id", reordered[i].id);
    }

    setExpanded((prev) => ({ ...prev, [workoutId]: reordered }));
  }

  /* ============================================================
     DELETE (with confirm modal)
     ============================================================ */
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

    // Workout delete
    if (deleteTarget.type === "workout") {
      await supabase.from("workouts").delete().eq("id", deleteTarget.id);
      if (user) await loadWorkouts(user.id);
    }

    // Exercise delete
    if (deleteTarget.type === "exercise") {
      await supabase.from("exercises").delete().eq("id", deleteTarget.id);

      const ex = await loadExercises(deleteTarget.workoutId);
      setExpanded((prev) => ({
        ...prev,
        [deleteTarget.workoutId]: ex,
      }));
    }

    setDeleteTarget(null);
    setDeleteModalOpen(false);
  }

  /* ============================================================
     SAVE WORKOUT
     ============================================================ */
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

    setWorkoutModal(false);
    setEditingWorkout(null);
    await loadWorkouts(user.id);
  }

  /* ============================================================
     SAVE EXERCISE
     ============================================================ */
  async function saveExercise() {
    if (!user || !exerciseWorkoutId) return;

    const list = expanded[exerciseWorkoutId] || [];

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
      payload.position = list.length;
      await supabase.from("exercises").insert(payload);
    }

    const ex = await loadExercises(exerciseWorkoutId);
    setExpanded((prev) => ({ ...prev, [exerciseWorkoutId]: ex }));

    setExerciseModal(false);
    setEditingExercise(null);
  }

  /* ============================================================
     FORMAT DATE
     ============================================================ */
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

  /* ============================================================
     RENDER PAGE
     ============================================================ */
  return (
    <div style={{ padding: "20px 16px 90px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>
        Workouts
      </h1>

      {/* ADD WORKOUT */}
      <button
        onClick={() => {
          setEditingWorkout(null);
          setWorkoutName("");
          setWorkoutSchedule("");
          setWorkoutModal(true);
        }}
        style={{
          padding: "10px 20px",
          borderRadius: 999,
          border: "none",
          background: "#ff2f2f",
          color: "white",
          fontWeight: 600,
          marginBottom: 16,
          boxShadow: "0 0 14px rgba(255,47,47,0.35)",
        }}
      >
        + Add Workout
      </button>

      {loading ? (
        <p style={{ opacity: 0.6 }}>Loading...</p>
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
              const exercises = expanded[workout.id];

              return (
                <div
                  key={workout.id}
                  style={{
                    background: "#0f0f0f",
                    borderRadius: 12,
                    marginBottom: 12,
                    border: "1px solid rgba(255,255,255,0.08)",
                    padding: 14,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    {/* LEFT DRAG ZONE (invisible) */}
                    <SortableItem id={workout.id} dragOnly>
                      <div
                        style={{
                          width: "40%",
                          height: "100%",
                          position: "absolute",
                          top: 0,
                          left: 0,
                        }}
                      />
                    </SortableItem>

                    {/* NAME + SCHEDULE */}
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
                        {workout.name}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 11,
                          opacity: 0.6,
                        }}
                      >
                        {formatSchedule(workout.scheduled_for)}
                      </p>
                    </div>

                    <FaEdit
                      style={{ cursor: "pointer" }}
                      onClick={() => {
                        setEditingWorkout(workout);
                        setWorkoutName(workout.name);
                        setWorkoutSchedule(
                          workout.scheduled_for
                            ? workout.scheduled_for.slice(0, 16)
                            : ""
                        );
                        setWorkoutModal(true);
                      }}
                    />

                    <FaTrash
                      style={{ cursor: "pointer", color: "#ff4d4d" }}
                      onClick={() => askDeleteWorkout(workout.id)}
                    />

                    {exercises ? <FaChevronUp /> : <FaChevronDown />}
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
                          items={exercises.map((ex) => ex.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {exercises.map((ex) => (
                            <div
                              key={ex.id}
                              style={{
                                background: "#151515",
                                borderRadius: 10,
                                marginBottom: 8,
                                padding: 10,
                                border:
                                  "1px solid rgba(255,255,255,0.06)",
                                position: "relative",
                              }}
                            >
                              {/* DRAG ZONE */}
                              <SortableItem id={ex.id} dragOnly>
                                <div
                                  style={{
                                    width: "40%",
                                    height: "100%",
                                    position: "absolute",
                                    left: 0,
                                    top: 0,
                                  }}
                                />
                              </SortableItem>

                              {/* CONTENT */}
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  gap: 10,
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
                                      opacity: 0.6,
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
                                  style={{ cursor: "pointer" }}
                                  onClick={() => {
                                    setEditingExercise(ex);
                                    setExerciseWorkoutId(workout.id);
                                    setExerciseName(ex.name);
                                    setExerciseSets(ex.sets ?? "");
                                    setExerciseReps(ex.reps ?? "");
                                    setExerciseWeight(ex.weight ?? "");
                                    setExerciseModal(true);
                                  }}
                                />

                                <FaTrash
                                  style={{
                                    cursor: "pointer",
                                    color: "#ff4d4d",
                                  }}
                                  onClick={() =>
                                    askDeleteExercise(ex.id, workout.id)
                                  }
                                />
                              </div>
                            </div>
                          ))}
                        </SortableContext>
                      </DndContext>

                      <button
                        style={{
                          width: "100%",
                          borderRadius: 999,
                          border: "1px solid rgba(255,255,255,0.15)",
                          background: "transparent",
                          padding: 8,
                          color: "#ccc",
                          fontSize: 12,
                          marginTop: 4,
                        }}
                        onClick={() => {
                          setEditingExercise(null);
                          setExerciseWorkoutId(workout.id);
                          setExerciseName("");
                          setExerciseSets("");
                          setExerciseReps("");
                          setExerciseWeight("");
                          setExerciseModal(true);
                        }}
                      >
                        + Add Exercise
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </SortableContext>
        </DndContext>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteModalOpen && (
        <div
          style={modalBackdrop}
          onClick={() => setDeleteModalOpen(false)}
        >
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: "#ff4d4d", marginTop: 0 }}>Confirm Delete?</h2>
            <p style={{ opacity: 0.7, marginBottom: 20 }}>
              This action cannot be undone.
            </p>

            <button
              style={secondaryBtn}
              onClick={() => setDeleteModalOpen(false)}
            >
              Cancel
            </button>

            <button style={primaryBtn} onClick={confirmDelete}>
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   MODAL STYLES
   ============================================================ */
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
  padding: 20,
  borderRadius: 12,
  width: "100%",
  maxWidth: 380,
  border: "1px solid rgba(255,255,255,0.12)",
};

const primaryBtn = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  background: "#ff2f2f",
  border: "none",
  fontWeight: 600,
  color: "white",
  marginTop: 10,
};

const secondaryBtn = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  background: "#222",
  border: "1px solid rgba(255,255,255,0.12)",
  fontWeight: 600,
  color: "white",
  marginBottom: 6,
};
