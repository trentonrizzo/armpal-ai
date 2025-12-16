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
  FaShare,
} from "react-icons/fa";

/* -------------------------------------------------------
   SORTABLE ITEM — DRAG HANDLE IS LEFT 40%
   (RESTORED — does NOT block clicks)
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
      {/* Drag handle zone */}
      <div
        {...attributes}
        {...listeners}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "40%",
          height: "100%",
          zIndex: 2,
          touchAction: "none",
        }}
      />
      {children}
    </div>
  );
}

export default function WorkoutsPage() {
  /* -------------------------------------------------------
     STATE
  ------------------------------------------------------- */
  const [user, setUser] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [expandedExercises, setExpandedExercises] = useState({});
  const [loading, setLoading] = useState(true);

  /* WORKOUT MODAL */
  const [workoutModalOpen, setWorkoutModalOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState(null);
  const [workoutName, setWorkoutName] = useState("");
  const [workoutSchedule, setWorkoutSchedule] = useState("");

  /* EXERCISE MODAL */
  const [exerciseModalOpen, setExerciseModalOpen] = useState(false);
  const [exerciseWorkoutId, setExerciseWorkoutId] = useState(null);
  const [editingExercise, setEditingExercise] = useState(null);
  const [exerciseName, setExerciseName] = useState("");
  const [exerciseSets, setExerciseSets] = useState("");
  const [exerciseReps, setExerciseReps] = useState("");
  const [exerciseWeight, setExerciseWeight] = useState("");

  /* DELETE MODAL */
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  /* SHARE WORKOUT */
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareWorkout, setShareWorkout] = useState(null);

  /* LONG PRESS */
  const holdTimerRef = useRef(null);
  const movedRef = useRef(false);

  /* DRAG SENSOR */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  /* -------------------------------------------------------
     LOAD USER + WORKOUTS (RESTORED)
  ------------------------------------------------------- */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
      if (data?.user?.id) {
        await loadWorkouts(data.user.id);
      }
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

  function toggleExpand(workoutId) {
    if (expandedExercises[workoutId]) {
      const copy = { ...expandedExercises };
      delete copy[workoutId];
      setExpandedExercises(copy);
    } else {
      loadExercises(workoutId).then((ex) =>
        setExpandedExercises((prev) => ({ ...prev, [workoutId]: ex }))
      );
    }
  }

  /* -------------------------------------------------------
     DRAG — WORKOUTS (UNCHANGED / WORKING)
  ------------------------------------------------------- */
  async function handleWorkoutDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = workouts.findIndex((w) => w.id === active.id);
    const newIndex = workouts.findIndex((w) => w.id === over.id);
    const reordered = arrayMove(workouts, oldIndex, newIndex);

    setWorkouts(reordered);

    reordered.forEach((w, i) => {
      supabase.from("workouts").update({ position: i }).eq("id", w.id);
    });
  }

  /* -------------------------------------------------------
     DRAG — EXERCISES (FULLY RESTORED)
  ------------------------------------------------------- */
  async function handleExerciseDragEnd(workoutId, event) {
    const list = expandedExercises[workoutId] || [];
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = list.findIndex((e) => e.id === active.id);
    const newIndex = list.findIndex((e) => e.id === over.id);
    const reordered = arrayMove(list, oldIndex, newIndex);

    reordered.forEach((ex, i) => {
      supabase.from("exercises").update({ position: i }).eq("id", ex.id);
    });

    setExpandedExercises((prev) => ({
      ...prev,
      [workoutId]: reordered,
    }));
  }

  /* -------------------------------------------------------
     WORKOUT CRUD (RESTORED)
  ------------------------------------------------------- */
  function openWorkoutModal(workout = null) {
    setEditingWorkout(workout);
    setWorkoutName(workout?.name || "");
    setWorkoutSchedule(workout?.scheduled_for || "");
    setWorkoutModalOpen(true);
  }

  async function saveWorkout() {
    if (!user?.id) return;

    const payload = {
      user_id: user.id,
      name: workoutName || "Workout",
      scheduled_for: workoutSchedule || null,
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

  function askDeleteWorkout(id) {
    setDeleteTarget({ type: "workout", id });
    setDeleteModalOpen(true);
  }

  /* -------------------------------------------------------
     EXERCISE CRUD (RESTORED)
  ------------------------------------------------------- */
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
    if (!user?.id || !exerciseWorkoutId) return;

    const list = expandedExercises[exerciseWorkoutId] || [];

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

    const refreshed = await loadExercises(exerciseWorkoutId);
    setExpandedExercises((prev) => ({
      ...prev,
      [exerciseWorkoutId]: refreshed,
    }));

    setExerciseModalOpen(false);
    setEditingExercise(null);
  }

  function askDeleteExercise(id, workoutId) {
    setDeleteTarget({ type: "exercise", id, workoutId });
    setDeleteModalOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    if (deleteTarget.type === "workout") {
      await supabase.from("workouts").delete().eq("id", deleteTarget.id);
      await loadWorkouts(user.id);
    } else {
      await supabase.from("exercises").delete().eq("id", deleteTarget.id);
      const refreshed = await loadExercises(deleteTarget.workoutId);
      setExpandedExercises((prev) => ({
        ...prev,
        [deleteTarget.workoutId]: refreshed,
      }));
    }

    setDeleteTarget(null);
    setDeleteModalOpen(false);
  }

  /* -------------------------------------------------------
     LONG PRESS — SEND WORKOUT (NO INTERFERENCE)
  ------------------------------------------------------- */
  function startHold(workout) {
    movedRef.current = false;
    clearTimeout(holdTimerRef.current);

    holdTimerRef.current = setTimeout(() => {
      if (movedRef.current) return;
      setShareWorkout(workout);
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

      {/* ADD WORKOUT — RESTORED */}
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
                    {/* WORKOUT HEADER */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 14,
                      }}
                    >
                      <div
                        onClick={() => toggleExpand(w.id)}
                        style={{ flex: 1, cursor: "pointer" }}
                      >
                        <p
                          style={{
                            fontSize: 15,
                            margin: 0,
                            fontWeight: 600,
                          }}
                        >
                          {w.name}
                        </p>
                        <p
                          style={{
                            fontSize: 11,
                            margin: 0,
                            opacity: 0.7,
                          }}
                        >
                          {formatSchedule(w.scheduled_for)}
                        </p>
                      </div>

                      {/* EDIT / DELETE — SPACED */}
                      <div
                        style={{
                          display: "flex",
                          gap: 14,
                          alignItems: "center",
                        }}
                      >
                        <FaEdit
                          style={{ fontSize: 15, cursor: "pointer" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openWorkoutModal(w);
                          }}
                        />
                        <FaTrash
                          style={{
                            color: "#ff4d4d",
                            fontSize: 15,
                            cursor: "pointer",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            askDeleteWorkout(w.id);
                          }}
                        />
                      </div>

                      {list ? (
                        <FaChevronUp style={{ fontSize: 12 }} />
                      ) : (
                        <FaChevronDown style={{ fontSize: 12 }} />
                      )}
                    </div>

                    {/* EXERCISES */}
                    {list && (
                      <div style={{ marginTop: 10 }}>
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={(e) =>
                            handleExerciseDragEnd(w.id, e)
                          }
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
                                      gap: 14,
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

                                    {/* EDIT / DELETE — SPACED */}
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: 14,
                                        alignItems: "center",
                                      }}
                                    >
                                      <FaEdit
                                        style={{
                                          cursor: "pointer",
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openExerciseModal(w.id, ex);
                                        }}
                                      />
                                      <FaTrash
                                        style={{
                                          cursor: "pointer",
                                          color: "#ff4d4d",
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          askDeleteExercise(ex.id, w.id);
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </SortableItem>
                            ))}
                          </SortableContext>
                        </DndContext>

                        {/* ADD EXERCISE — RESTORED */}
                        <button
                          onClick={() =>
                            openExerciseModal(w.id, null)
                          }
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

      {/* SHARE WORKOUT MODAL — FRIEND SELECT COMES NEXT */}
      {shareModalOpen && (
        <Modal onClose={() => setShareModalOpen(false)}>
          <h2 style={{ marginBottom: 12 }}>Send Workout</h2>
          <p style={{ fontSize: 13, opacity: 0.7 }}>
            Choose a friend to send a copy of this workout.
          </p>

          {/* Friend list + confirm button added in Part 3 */}

          <button
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.25)",
              background: "transparent",
              color: "white",
              fontWeight: 600,
              marginTop: 14,
            }}
            onClick={() => setShareModalOpen(false)}
          >
            Cancel
          </button>
        </Modal>
      )}
  /* -------------------------------------------------------
     SHARE — FRIEND SELECTION + SEND
  ------------------------------------------------------- */
  const [friends, setFriends] = useState([]);
  const [selectedFriendId, setSelectedFriendId] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!shareModalOpen || !user?.id) return;

    // Load accepted friends (OPTION 1)
    (async () => {
      const { data: rows } = await supabase
        .from("friends")
        .select("user_id, friend_id, status")
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq("status", "accepted");

      const ids = (rows || []).map((r) =>
        r.user_id === user.id ? r.friend_id : r.user_id
      );

      if (ids.length === 0) {
        setFriends([]);
        return;
      }

      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", ids);

      setFriends(profs || []);
    })();
  }, [shareModalOpen, user?.id]);

  async function sendWorkoutToFriend() {
    if (!shareWorkout || !selectedFriendId || !user?.id) return;

    setSending(true);

    // Load exercises fresh (guaranteed latest order)
    const exercises = await loadExercises(shareWorkout.id);

    const payload = {
      type: "workout_share",
      workout: {
        name: shareWorkout.name,
        scheduled_for: shareWorkout.scheduled_for || null,
      },
      exercises: exercises.map((ex) => ({
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight,
        position: ex.position,
      })),
    };

    await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: selectedFriendId,
      payload,
    });

    setSending(false);
    setSelectedFriendId(null);
    setShareWorkout(null);
    setShareModalOpen(false);
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
     MODALS (RENDER)
  ------------------------------------------------------- */
  return (
    <>
      {/** main UI already returned above **/}

      {/* SHARE WORKOUT MODAL — COMPLETE */}
      {shareModalOpen && (
        <Modal onClose={() => setShareModalOpen(false)}>
          <h2 style={{ marginBottom: 10 }}>Send Workout</h2>
          <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 12 }}>
            Select a friend to send a copy of this workout.
          </p>

          <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {friends.map((f) => {
              const name =
                f.display_name || f.username || "Unknown";
              const selected = selectedFriendId === f.id;

              return (
                <div
                  key={f.id}
                  onClick={() => setSelectedFriendId(f.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 10,
                    borderRadius: 10,
                    cursor: "pointer",
                    marginBottom: 6,
                    background: selected
                      ? "rgba(255,47,47,0.25)"
                      : "rgba(255,255,255,0.05)",
                    border: selected
                      ? "1px solid rgba(255,47,47,0.6)"
                      : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "#000",
                      border:
                        "1px solid rgba(255,255,255,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                    }}
                  >
                    {name.charAt(0).toUpperCase()}
                  </div>

                  <span style={{ fontWeight: 600 }}>{name}</span>
                </div>
              );
            })}

            {friends.length === 0 && (
              <p style={{ fontSize: 13, opacity: 0.7 }}>
                You don’t have any friends yet.
              </p>
            )}
          </div>

          <button
            disabled={!selectedFriendId || sending}
            onClick={sendWorkoutToFriend}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "none",
              background:
                !selectedFriendId || sending
                  ? "#444"
                  : "#ff2f2f",
              color: "white",
              fontWeight: 700,
              marginTop: 14,
              cursor:
                !selectedFriendId || sending
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {sending ? "Sending…" : "Send Workout"}
          </button>

          <button
            onClick={() => setShareModalOpen(false)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.25)",
              background: "transparent",
              color: "white",
              fontWeight: 600,
              marginTop: 8,
            }}
          >
            Cancel
          </button>
        </Modal>
      )}
    </>
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
