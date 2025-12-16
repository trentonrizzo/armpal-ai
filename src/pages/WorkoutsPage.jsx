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

/* ============================================================
   SECTION 1 — CORE WORKOUT PAGE
   - State
   - Loaders
   - Workout CRUD
   - Exercise CRUD
   - Drag & Drop
   - Expand / Collapse
   - UI (NO SHARE LOGIC YET)
============================================================ */

/* ------------------------------
   SORTABLE ITEM (SAFE HANDLE)
------------------------------ */
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
      <div
        {...attributes}
        {...listeners}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "40%",
          height: "100%",
          zIndex: 1,
          touchAction: "none",
        }}
      />
      {children}
    </div>
  );
}

export default function WorkoutsPage() {
  /* ------------------------------
     CORE STATE
  ------------------------------ */
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [workouts, setWorkouts] = useState([]);
  const [expandedExercises, setExpandedExercises] = useState({});

  /* ------------------------------
     WORKOUT MODAL STATE
  ------------------------------ */
  const [workoutModalOpen, setWorkoutModalOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState(null);
  const [workoutName, setWorkoutName] = useState("");
  const [workoutSchedule, setWorkoutSchedule] = useState("");

  /* ------------------------------
     EXERCISE MODAL STATE
  ------------------------------ */
  const [exerciseModalOpen, setExerciseModalOpen] = useState(false);
  const [exerciseWorkoutId, setExerciseWorkoutId] = useState(null);
  const [editingExercise, setEditingExercise] = useState(null);
  const [exerciseName, setExerciseName] = useState("");
  const [exerciseSets, setExerciseSets] = useState("");
  const [exerciseReps, setExerciseReps] = useState("");
  const [exerciseWeight, setExerciseWeight] = useState("");

  /* ------------------------------
     DELETE MODAL
  ------------------------------ */
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  /* ------------------------------
     DRAG SENSOR
  ------------------------------ */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  /* ============================================================
     LOAD USER + WORKOUTS
  ============================================================ */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user || null;
      setUser(u);

      if (u?.id) {
        await loadWorkouts(u.id);
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

  /* ============================================================
     EXPAND / COLLAPSE
  ============================================================ */
  function toggleExpand(workoutId) {
    if (expandedExercises[workoutId]) {
      const copy = { ...expandedExercises };
      delete copy[workoutId];
      setExpandedExercises(copy);
    } else {
      loadExercises(workoutId).then((list) => {
        setExpandedExercises((prev) => ({
          ...prev,
          [workoutId]: list,
        }));
      });
    }
  }

  /* ============================================================
     DRAG — WORKOUTS
  ============================================================ */
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

  /* ============================================================
     DRAG — EXERCISES
  ============================================================ */
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

  /* ============================================================
     WORKOUT CRUD
  ============================================================ */
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

  /* ============================================================
     EXERCISE CRUD
  ============================================================ */
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

  /* ============================================================
     UTIL
  ============================================================ */
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

  /* ============================================================
     UI — MAIN LIST
  ============================================================ */
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
        }}
      >
        + Add Workout
      </button>

      {loading ? (
        <p style={{ opacity: 0.7 }}>Loading workouts…</p>
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
            {workouts.map((w) => {
              const list = expandedExercises[w.id];

              return (
                <SortableItem key={w.id} id={w.id}>
                  <div
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
                        gap: 14,
                      }}
                    >
                      <div
                        onClick={() => toggleExpand(w.id)}
                        style={{ flex: 1, cursor: "pointer" }}
                      >
                        <p style={{ fontWeight: 600, margin: 0 }}>{w.name}</p>
                        <p style={{ fontSize: 11, opacity: 0.7, margin: 0 }}>
                          {formatSchedule(w.scheduled_for)}
                        </p>
                      </div>

                      <div style={{ display: "flex", gap: 14 }}>
                        <FaShare style={{ opacity: 0.4 }} />
                        <FaEdit
                          onClick={() => openWorkoutModal(w)}
                          style={{ cursor: "pointer" }}
                        />
                        <FaTrash
                          onClick={() => askDeleteWorkout(w.id)}
                          style={{ cursor: "pointer", color: "#ff4d4d" }}
                        />
                      </div>

                      {list ? <FaChevronUp /> : <FaChevronDown />}
                    </div>

                    {/* EXERCISES */}
                    {list && (
                      <div style={{ marginTop: 10 }}>
                        {/* exercise list continues in Part 2 */}
                      </div>
                    )}
                  </div>
                </SortableItem>
              );
            })}
          </SortableContext>
        </DndContext>
      )}

      {/* modals continue in Part 3 */}
    </div>
  );
}
/* ============================================================
   SECTION 2 — EXERCISES UI + SHARE SYSTEM
   - Exercise list rendering
   - Share icon click handler
   - Friends loader (accepted only)
   - Share modal UI
   - Workout + exercise cloning
============================================================ */

/* ------------------------------
   SHARE STATE
------------------------------ */
const [shareModalOpen, setShareModalOpen] = useState(false);
const [shareWorkout, setShareWorkout] = useState(null);
const [friends, setFriends] = useState([]);
const [selectedFriendId, setSelectedFriendId] = useState(null);
const [sending, setSending] = useState(false);

/* ------------------------------
   LOAD FRIENDS (ACCEPTED)
------------------------------ */
async function loadFriends(uid) {
  const { data } = await supabase
    .from("friends")
    .select(
      `
      id,
      friend_id,
      profiles:friend_id (
        id,
        username,
        display_name,
        handle
      )
    `
    )
    .eq("user_id", uid)
    .eq("status", "accepted");

  const mapped =
    data?.map((f) => ({
      id: f.profiles.id,
      username: f.profiles.username,
      display_name: f.profiles.display_name,
      handle: f.profiles.handle,
    })) || [];

  setFriends(mapped);
}

/* ------------------------------
   OPEN SHARE MODAL
------------------------------ */
async function openShareModal(workout) {
  if (!user?.id) return;

  setShareWorkout(workout);
  setSelectedFriendId(null);
  setShareModalOpen(true);

  if (friends.length === 0) {
    await loadFriends(user.id);
  }
}

/* ------------------------------
   SEND WORKOUT TO FRIEND
------------------------------ */
async function sendWorkoutToFriend() {
  if (!shareWorkout || !selectedFriendId || sending) return;

  setSending(true);

  try {
    // load exercises to clone
    const exercises = await loadExercises(shareWorkout.id);

    // create workout for friend
    const { data: newWorkout, error: wErr } = await supabase
      .from("workouts")
      .insert({
        user_id: selectedFriendId,
        name: shareWorkout.name,
        scheduled_for: null,
        position: 999,
        source_user_id: user.id,
      })
      .select()
      .single();

    if (wErr) throw wErr;

    // clone exercises
    if (exercises.length > 0) {
      const cloned = exercises.map((ex, i) => ({
        user_id: selectedFriendId,
        workout_id: newWorkout.id,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight,
        position: i,
      }));

      const { error: eErr } = await supabase
        .from("exercises")
        .insert(cloned);

      if (eErr) throw eErr;
    }

    // reset + close
    setShareModalOpen(false);
    setShareWorkout(null);
    setSelectedFriendId(null);
  } catch (err) {
    console.error("Share failed:", err);
    alert("Failed to send workout.");
  } finally {
    setSending(false);
  }
}

/* ============================================================
   EXERCISE LIST UI (CONTINUATION)
============================================================ */

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
                border: "1px solid rgba(255,255,255,0.06)",
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
                  <p style={{ margin: 0, fontWeight: 600 }}>
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

                <div style={{ display: "flex", gap: 14 }}>
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
        border: "1px solid rgba(255,255,255,0.15)",
        color: "white",
        fontSize: 12,
      }}
    >
      + Add Exercise
    </button>
  </div>
)}

/* ============================================================
   SHARE MODAL UI
============================================================ */

{shareModalOpen && (
  <Modal onClose={() => setShareModalOpen(false)}>
    <h2 style={{ marginBottom: 10 }}>Send Workout</h2>

    <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 12 }}>
      Choose a friend to send a copy of this workout.
    </p>

    <div style={{ maxHeight: 260, overflowY: "auto" }}>
      {friends.length === 0 && (
        <p style={{ fontSize: 13, opacity: 0.6 }}>
          No friends yet.
        </p>
      )}

      {friends.map((f) => {
        const name =
          f.display_name || f.username || f.handle || "Friend";
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
                border: "1px solid rgba(255,255,255,0.15)",
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
          !selectedFriendId || sending ? "#444" : "#ff2f2f",
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
/* ============================================================
   SECTION 3 — MODALS + STYLES
   - Workout modal
   - Exercise modal
   - Delete confirmation modal
   - Modal component
   - Shared styles
============================================================ */

/* ============================================================
   WORKOUT MODAL
============================================================ */
{workoutModalOpen && (
  <Modal onClose={() => setWorkoutModalOpen(false)}>
    <h2 style={{ marginBottom: 12 }}>
      {editingWorkout ? "Edit Workout" : "New Workout"}
    </h2>

    <label style={labelStyle}>Workout Name</label>
    <input
      style={inputStyle}
      value={workoutName}
      onChange={(e) => setWorkoutName(e.target.value)}
      placeholder="Workout name"
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

/* ============================================================
   EXERCISE MODAL
============================================================ */
{exerciseModalOpen && (
  <Modal onClose={() => setExerciseModalOpen(false)}>
    <h2 style={{ marginBottom: 12 }}>
      {editingExercise ? "Edit Exercise" : "New Exercise"}
    </h2>

    <label style={labelStyle}>Exercise Name</label>
    <input
      style={inputStyle}
      value={exerciseName}
      onChange={(e) => setExerciseName(e.target.value)}
      placeholder="Exercise name"
    />

    <label style={labelStyle}>Sets</label>
    <input
      type="number"
      style={inputStyle}
      value={exerciseSets}
      onChange={(e) => setExerciseSets(e.target.value)}
      placeholder="Sets"
    />

    <label style={labelStyle}>Reps</label>
    <input
      type="number"
      style={inputStyle}
      value={exerciseReps}
      onChange={(e) => setExerciseReps(e.target.value)}
      placeholder="Reps"
    />

    <label style={labelStyle}>Weight</label>
    <input
      style={inputStyle}
      value={exerciseWeight}
      onChange={(e) => setExerciseWeight(e.target.value)}
      placeholder="Weight"
    />

    <button style={primaryBtn} onClick={saveExercise}>
      Save Exercise
    </button>
  </Modal>
)}

/* ============================================================
   DELETE CONFIRM MODAL
============================================================ */
{deleteModalOpen && (
  <Modal onClose={() => setDeleteModalOpen(false)}>
    <h2 style={{ color: "#ff4d4d", marginBottom: 8 }}>
      Confirm Delete
    </h2>

    <p style={{ fontSize: 13, opacity: 0.7 }}>
      This action cannot be undone.
    </p>

    <button style={secondaryBtn} onClick={() => setDeleteModalOpen(false)}>
      Cancel
    </button>

    <button style={primaryBtn} onClick={confirmDelete}>
      Delete
    </button>
  </Modal>
)}

/* ============================================================
   END OF MAIN COMPONENT
============================================================ */
}

/* ============================================================
   MODAL COMPONENT
============================================================ */
function Modal({ children, onClose }) {
  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div style={modalCard} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/* ============================================================
   STYLES
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
