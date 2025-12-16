// src/pages/WorkoutsPage.jsx
import React, { useEffect, useRef, useState } from "react";
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
import {
  FaChevronDown,
  FaChevronUp,
  FaEdit,
  FaTrash,
  FaCopy,
} from "react-icons/fa";

/* -------------------------------------------------------
   SORTABLE ITEM — LEFT 40% = DRAG HANDLE
------------------------------------------------------- */
function SortableItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        position: "relative",
      }}
    >
      {/* DRAG HANDLE (left 40%) */}
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
          touchAction: "none",
        }}
      />
      {children}
    </div>
  );
}

export default function WorkoutsPage() {
  const [user, setUser] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [expandedExercises, setExpandedExercises] = useState({});
  const [loading, setLoading] = useState(true);

  /* MODALS */
  const [workoutModalOpen, setWorkoutModalOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState(null);
  const [workoutName, setWorkoutName] = useState("");
  const [workoutSchedule, setWorkoutSchedule] = useState("");

  const [exerciseModalOpen, setExerciseModalOpen] = useState(false);
  const [exerciseWorkoutId, setExerciseWorkoutId] = useState(null);
  const [editingExercise, setEditingExercise] = useState(null);
  const [exerciseName, setExerciseName] = useState("");
  const [exerciseSets, setExerciseSets] = useState("");
  const [exerciseReps, setExerciseReps] = useState("");
  const [exerciseWeight, setExerciseWeight] = useState("");

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  /* 🔥 COPY / SHARE (NEW) */
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [sharePayload, setSharePayload] = useState(null);

  /* LONG PRESS */
  const holdTimerRef = useRef(null);
  const movedRef = useRef(false);

  /* DRAG SENSOR */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  /* LOAD USER + WORKOUTS */
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

  function toggleExpand(id) {
    if (expandedExercises[id]) {
      const copy = { ...expandedExercises };
      delete copy[id];
      setExpandedExercises(copy);
    } else {
      loadExercises(id).then((ex) =>
        setExpandedExercises((prev) => ({ ...prev, [id]: ex }))
      );
    }
  }

  /* DRAG — WORKOUTS */
  async function handleWorkoutDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = workouts.findIndex((w) => w.id === active.id);
    const newIndex = workouts.findIndex((w) => w.id === over.id);
    const reordered = arrayMove(workouts, oldIndex, newIndex);

    setWorkouts(reordered);

    reordered.forEach((w, i) =>
      supabase.from("workouts").update({ position: i }).eq("id", w.id)
    );
  }

  /* 🔥 LONG PRESS HANDLERS */
  function startHold(workout) {
    movedRef.current = false;
    clearTimeout(holdTimerRef.current);

    holdTimerRef.current = setTimeout(async () => {
      if (movedRef.current) return;

      const exercises = await loadExercises(workout.id);

      const payload = {
        workout: {
          name: workout.name,
          scheduled_for: workout.scheduled_for || null,
        },
        exercises: exercises.map((ex) => ({
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          weight: ex.weight,
          position: ex.position,
        })),
      };

      setSharePayload(payload);
      setShareModalOpen(true);
    }, 600);
  }

  function cancelHold() {
    clearTimeout(holdTimerRef.current);
  }

  function markMoved() {
    movedRef.current = true;
  }

  function formatSchedule(val) {
    if (!val) return "Not scheduled";
    const d = new Date(val);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /* -------------------------------------------------------
     UI
  ------------------------------------------------------- */
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
          color: "white",
          border: "none",
          marginBottom: 18,
          fontWeight: 600,
          boxShadow: "0 0 14px rgba(255,47,47,0.35)",
        }}
      >
        + Add Workout
      </button>

      {loading ? (
        <p style={{ opacity: 0.7 }}>Loading workouts…</p>
      ) : workouts.length === 0 ? (
        <p style={{ opacity: 0.7 }}>No workouts yet. Add one.</p>
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
              const list = expandedExercises[w.id];

              return (
                <SortableItem key={w.id} id={w.id}>
                  <div
                    onTouchStart={() => startHold(w)}
                    onTouchMove={markMoved}
                    onTouchEnd={cancelHold}
                    onTouchCancel={cancelHold}
                    style={{
                      background: "#0f0f0f",
                      borderRadius: 12,
                      padding: 14,
                      border: "1px solid rgba(255,255,255,0.08)",
                      marginBottom: 10,
                    }}
                  >
                    {/* HEADER */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div onClick={() => toggleExpand(w.id)} style={{ flex: 1 }}>
                        <p style={{ fontSize: 15, margin: 0, fontWeight: 600 }}>
                          {w.name}
                        </p>
                        <p style={{ fontSize: 11, margin: 0, opacity: 0.7 }}>
                          {formatSchedule(w.scheduled_for)}
                        </p>
                      </div>

                      <FaEdit
                        style={{ fontSize: 15, cursor: "pointer" }}
                        onClick={() => openWorkoutModal(w)}
                      />
                      <FaTrash
                        style={{
                          color: "#ff4d4d",
                          fontSize: 15,
                          cursor: "pointer",
                        }}
                        onClick={() => askDeleteWorkout(w.id)}
                      />

                      {list ? (
                        <FaChevronUp style={{ marginLeft: 6, fontSize: 12 }} />
                      ) : (
                        <FaChevronDown style={{ marginLeft: 6, fontSize: 12 }} />
                      )}
                    </div>

                    {/* EXERCISES */}
                    {list && (
                      <div style={{ marginTop: 10 }}>
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={(e) => handleExerciseDragEnd(w.id, e)}
                        >
                          <SortableContext
                            items={list.map((e) => e.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {list.map((ex) => (
                              <SortableItem key={ex.id} id={ex.id}>
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
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                    }}
                                  >
                                    <div>
                                      <p
                                        style={{
                                          margin: 0,
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
                                      style={{ cursor: "pointer" }}
                                      onClick={() =>
                                        openExerciseModal(w.id, ex)
                                      }
                                    />
                                    <FaTrash
                                      style={{
                                        cursor: "pointer",
                                        color: "#ff4d4d",
                                      }}
                                      onClick={() =>
                                        askDeleteExercise(ex.id, w.id)
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
                            marginTop: 6,
                            background: "transparent",
                            border:
                              "1px solid rgba(255,255,255,0.15)",
                            color: "white",
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

      {/* 🔥 SHARE / COPY MODAL */}
      {shareModalOpen && (
        <Modal onClose={() => setShareModalOpen(false)}>
          <h2 style={{ marginBottom: 12 }}>Copy / Share Workout</h2>

          <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 16 }}>
            This will copy the workout and all exercises so it can be shared
            or sent to a friend.
          </p>

          <button
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "none",
              background: "#ff2f2f",
              color: "white",
              fontWeight: 600,
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
            onClick={() => {
              console.log("WORKOUT SHARE PAYLOAD:", sharePayload);
              setShareModalOpen(false);
            }}
          >
            <FaCopy /> Copy Workout
          </button>

          <button
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.25)",
              background: "transparent",
              color: "white",
              fontWeight: 600,
            }}
            onClick={() => setShareModalOpen(false)}
          >
            Cancel
          </button>
        </Modal>
      )}
      {/* WORKOUT MODAL */}
      {workoutModalOpen && (
        <Modal onClose={() => setWorkoutModalOpen(false)}>
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
        </Modal>
      )}

      {/* EXERCISE MODAL */}
      {exerciseModalOpen && (
        <Modal onClose={() => setExerciseModalOpen(false)}>
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
          />

          <button style={primaryBtn} onClick={saveExercise}>
            Save Exercise
          </button>
        </Modal>
      )}

      {/* DELETE MODAL */}
      {deleteModalOpen && (
        <Modal onClose={() => setDeleteModalOpen(false)}>
          <h2 style={{ color: "#ff4d4d" }}>Confirm Delete?</h2>
          <p style={{ opacity: 0.7, marginBottom: 15 }}>
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
        </Modal>
      )}
    </div>
  );
}

/* -------------------------------------------------------
   SHARED MODAL COMPONENT
------------------------------------------------------- */
function Modal({ children, onClose }) {
  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div style={modalCard} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/* -------------------------------------------------------
   SHARED STYLES
------------------------------------------------------- */
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
  padding: 20,
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
  marginBottom: 12,
};

const labelStyle = {
  fontSize: 12,
  marginBottom: 4,
  opacity: 0.85,
};

const primaryBtn = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "none",
  background: "#ff2f2f",
  color: "white",
  fontWeight: 600,
  marginTop: 10,
};

const secondaryBtn = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "transparent",
  color: "white",
  fontWeight: 600,
  marginTop: 10,
};
