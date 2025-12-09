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

// Drag wrapper WITH DRAG HANDLE (left side only)
function SortableItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="drag-wrapper">
      {/* left drag handle zone */}
      <div
        {...attributes}
        {...listeners}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "40%",
          height: "100%",
          zIndex: 5,
        }}
      ></div>

      {/* actual card content */}
      {children}
    </div>
  );
}

export default function WorkoutsPage() {
  const [user, setUser] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [expandedExercises, setExpandedExercises] = useState({});
  const [loading, setLoading] = useState(true);

  // workout modal
  const [workoutModalOpen, setWorkoutModalOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState(null);
  const [workoutName, setWorkoutName] = useState("");
  const [workoutSchedule, setWorkoutSchedule] = useState("");

  // exercise modal
  const [exerciseModalOpen, setExerciseModalOpen] = useState(false);
  const [exerciseWorkoutId, setExerciseWorkoutId] = useState(null);
  const [editingExercise, setEditingExercise] = useState(null);
  const [exerciseName, setExerciseName] = useState("");
  const [exerciseSets, setExerciseSets] = useState("");
  const [exerciseReps, setExerciseReps] = useState("");
  const [exerciseWeight, setExerciseWeight] = useState("");

  // delete confirm modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Load initial user + workouts
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
    const { data } = await supabase
      .from("exercises")
      .select("*")
      .eq("workout_id", workoutId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    return data || [];
  }

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
      await supabase.from("workouts").delete().eq("id", deleteTarget.id);
      if (user) await loadWorkouts(user.id);
    } else {
      await supabase
        .from("exercises")
        .delete()
        .eq("id", deleteTarget.id);

      const updated = await loadExercises(deleteTarget.workoutId);
      setExpandedExercises((prev) => ({
        ...prev,
        [deleteTarget.workoutId]: updated,
      }));
    }

    setDeleteTarget(null);
    setDeleteModalOpen(false);
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

  return (
    <div
      style={{
        padding: "20px 16px 90px",
        maxWidth: 900,
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
        <p style={{ opacity: 0.7 }}>Loading...</p>
      ) : workouts.length === 0 ? (
        <p style={{ opacity: 0.7 }}>No workouts yet.</p>
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
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {/* Workout header */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 10,
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
                          {workout.name}
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
                      <FaTrash
                        style={{
                          fontSize: 14,
                          cursor: "pointer",
                          color: "#ff4d4d",
                        }}
                        onClick={() => askDeleteWorkout(workout.id)}
                      />

                      {exercises ? (
                        <FaChevronUp style={{ marginLeft: 4, fontSize: 12 }} />
                      ) : (
                        <FaChevronDown
                          style={{ marginLeft: 4, fontSize: 12 }}
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
                            items={exercises.map((ex) => ex.id)}
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
                                    border:
                                      "1px solid rgba(255,255,255,0.06)",
                                    position: "relative",
                                    overflow: "hidden",
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
                                    <div style={{ flex: 1 }}>
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

                                    <FaTrash
                                      style={{
                                        fontSize: 13,
                                        cursor: "pointer",
                                        color: "#ff4d4d",
                                      }}
                                      onClick={() =>
                                        askDeleteExercise(
                                          ex.id,
                                          workout.id
                                        )
                                      }
                                    />
                                  </div>
                                </div>
                              </SortableItem>
                            ))}
                          </SortableContext>
                        </DndContext>

                        {/* ADD EXERCISE BUTTON */}
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
                            border:
                              "1px solid rgba(255,255,255,0.14)",
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
              placeholder="Push Day, Pull Day…"
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
              placeholder="225 lb"
            />

            <button style={primaryBtn} onClick={saveExercise}>
              Save Exercise
            </button>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteModalOpen && (
        <div style={modalBackdrop} onClick={() => setDeleteModalOpen(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, color: "#ff4d4d" }}>Confirm Delete?</h2>
            <p style={{ opacity: 0.7, marginBottom: 18 }}>
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

/* ---------- SHARED STYLES ---------- */

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

const secondaryBtn = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "transparent",
  color: "white",
  fontWeight: 600,
  marginTop: 8,
};
