import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import ReorderableList from "../components/ReorderableListDndKit.jsx";

import {
  getWorkoutsWithExercises,
  addWorkout as addWorkoutApi,
  updateWorkout as updateWorkoutApi,
  deleteWorkout as deleteWorkoutApi,
} from "../api/workouts";

import {
  addExercise as addExerciseApi,
  updateExercise as updateExerciseApi,
  deleteExercise as deleteExerciseApi,
} from "../api/exercises";

export default function WorkoutsPage() {
  console.log("DEBUG — WorkoutsPage is LOADED");
  const [user, setUser] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newWorkout, setNewWorkout] = useState("");
  const [exerciseForms, setExerciseForms] = useState({});
  const [editingWorkout, setEditingWorkout] = useState(null);
  const [editingExercise, setEditingExercise] = useState({});
  const [confirmDelete, setConfirmDelete] = useState({});

  // Load workouts + exercises from Supabase
  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        setLoading(false);
        return;
      }

      setUser(userData.user);

      const data = await getWorkoutsWithExercises(userData.user.id);
      setWorkouts(data);
      setLoading(false);
    };

    load();
  }, []);

  // Confirm delete
  const confirmDeleteClick = async (type, id, workoutId = null) => {
    const key = `${type}-${id}-${workoutId || ""}`;

    if (confirmDelete[key]) {
      if (type === "workout") {
        await deleteWorkoutApi(id);
        setWorkouts((prev) => prev.filter((w) => w.id !== id));
      } else {
        await deleteExerciseApi(id);
        setWorkouts((prev) =>
          prev.map((w) =>
            w.id === workoutId
              ? {
                  ...w,
                  exercises: w.exercises.filter((ex) => ex.id !== id),
                }
              : w
          )
        );
      }

      setConfirmDelete((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    } else {
      setConfirmDelete((prev) => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setConfirmDelete((prev) => {
          const copy = { ...prev };
          delete copy[key];
          return copy;
        });
      }, 3000);
    }
  };

  // Add workout
  const handleAddWorkout = async () => {
    if (!newWorkout.trim() || !user) return;

    const created = await addWorkoutApi({
      userId: user.id,
      name: newWorkout.trim(),
    });

    if (created) {
      setWorkouts((prev) => [{ ...created, exercises: [] }, ...prev]);
      setNewWorkout("");
    }
  };

  // Add exercise
  const handleAddExercise = async (workoutId) => {
    const form = exerciseForms[workoutId];
    if (!user || !form?.name) return;

    const created = await addExerciseApi({
      userId: user.id,
      workoutId,
      name: form.name.trim(),
      sets: form.sets,
      reps: form.reps,
      weight: form.weight,
    });

    if (created) {
      setWorkouts((prev) =>
        prev.map((w) =>
          w.id === workoutId
            ? {
                ...w,
                exercises: [...w.exercises, created],
              }
            : w
        )
      );

      setExerciseForms((prev) => ({
        ...prev,
        [workoutId]: { name: "", sets: "", reps: "", weight: "" },
      }));
    }
  };

  // Exercise input typing
  const handleChange = (workoutId, e) => {
    const { name, value } = e.target;
    setExerciseForms((prev) => ({
      ...prev,
      [workoutId]: { ...prev[workoutId], [name]: value },
    }));
  };

  // Rename workout
  const handleWorkoutNameChange = (workoutId, value) => {
    setWorkouts((prev) =>
      prev.map((w) => (w.id === workoutId ? { ...w, name: value } : w))
    );
  };

  const handleWorkoutNameBlur = async (workoutId, value) => {
    setEditingWorkout(null);
    const trimmed = value.trim();
    if (!trimmed) return;
    await updateWorkoutApi(workoutId, { name: trimmed });
  };

  // Edit exercise label
  const handleExerciseEditChange = (workoutId, exId, value) => {
    setWorkouts((prev) =>
      prev.map((w) =>
        w.id === workoutId
          ? {
              ...w,
              exercises: w.exercises.map((ex) =>
                ex.id === exId ? { ...ex, name: value } : ex
              ),
            }
          : w
      )
    );
  };

  const handleExerciseEditBlur = async (exId, value) => {
    setEditingExercise((prev) => {
      const copy = { ...prev };
      delete copy[exId];
      return copy;
    });

    const trimmed = value.trim();
    if (!trimmed) return;

    await updateExerciseApi(exId, { name: trimmed });
  };

  if (loading) return <div className="p-6 text-white">Loading…</div>;

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold text-red-500 mb-3">Workouts</h1>

      {/* Add Workout */}
      <div className="flex gap-2 mb-5">
        <input
          type="text"
          placeholder="Workout name (e.g. Push Day)"
          value={newWorkout}
          onChange={(e) => setNewWorkout(e.target.value)}
          className="flex-1 bg-neutral-900 text-white p-2 rounded-lg border border-neutral-700"
        />
        <button
          onClick={handleAddWorkout}
          className="bg-red-600 hover:bg-red-700 transition px-4 rounded-lg font-semibold"
        >
          Add
        </button>
      </div>

      {workouts.length === 0 ? (
        <p className="text-gray-400">No workouts yet. Add one above!</p>
      ) : (
        <ReorderableList
          items={workouts}
          type="workouts"
          onReorder={(updated) => setWorkouts(updated)} // local reorder only
          renderItem={(w) => (
            <div key={w.id} className="bg-neutral-800 p-4 rounded-xl mb-4 shadow-lg">
              {/* Workout Header */}
              <div className="flex justify-between items-center mb-3">
                {editingWorkout === w.id ? (
                  <input
                    value={w.name}
                    onChange={(e) =>
                      handleWorkoutNameChange(w.id, e.target.value)
                    }
                    onBlur={(e) =>
                      handleWorkoutNameBlur(w.id, e.target.value)
                    }
                    className="bg-neutral-900 text-white p-2 rounded w-full"
                    autoFocus
                  />
                ) : (
                  <h2
                    className="text-lg font-semibold text-red-400 cursor-pointer"
                    onClick={() => setEditingWorkout(w.id)}
                  >
                    {w.name}
                  </h2>
                )}
                <button
                  onClick={() => confirmDeleteClick("workout", w.id)}
                  className={`text-sm ml-3 transition ${
                    confirmDelete[`workout-${w.id}-`]
                      ? "text-red-500 font-semibold"
                      : "text-gray-400 hover:text-red-500"
                  }`}
                >
                  {confirmDelete[`workout-${w.id}-`] ? "Confirm?" : "🗑"}
                </button>
              </div>

              {/* Exercises */}
              {w.exercises?.length > 0 ? (
                <ReorderableList
                  items={w.exercises}
                  type={`exercises-${w.id}`}
                  onReorder={(updated) =>
                    setWorkouts((prev) =>
                      prev.map((x) =>
                        x.id === w.id ? { ...x, exercises: updated } : x
                      )
                    )
                  }
                  renderItem={(ex) => (
                    <div
                      key={ex.id}
                      className="bg-neutral-900 p-2 rounded flex justify-between items-center mb-2"
                    >
                      {editingExercise[ex.id] ? (
                        <input
                          value={ex.name}
                          onChange={(e) =>
                            handleExerciseEditChange(
                              w.id,
                              ex.id,
                              e.target.value
                            )
                          }
                          onBlur={(e) =>
                            handleExerciseEditBlur(ex.id, e.target.value)
                          }
                          className="bg-neutral-800 text-white w-full p-1 rounded"
                          autoFocus
                        />
                      ) : (
                        <span
                          onClick={() =>
                            setEditingExercise((prev) => ({
                              ...prev,
                              [ex.id]: true,
                            }))
                          }
                          className="text-gray-200 cursor-pointer"
                        >
                          {ex.name}
                          {ex.sets && ex.reps && ex.weight
                            ? ` — ${ex.sets}×${ex.reps} @ ${ex.weight}`
                            : ""}
                        </span>
                      )}
                      <button
                        onClick={() =>
                          confirmDeleteClick("exercise", ex.id, w.id)
                        }
                        className={`text-xs ml-2 transition ${
                          confirmDelete[`exercise-${ex.id}-${w.id}`]
                            ? "text-red-500 font-semibold"
                            : "text-gray-400 hover:text-red-500"
                        }`}
                      >
                        {confirmDelete[`exercise-${ex.id}-${w.id}`]
                          ? "Confirm?"
                          : "✖"}
                      </button>
                    </div>
                  )}
                />
              ) : (
                <p className="text-gray-500 text-sm italic mb-2">
                  No exercises yet.
                </p>
              )}

              {/* Add Exercise Form */}
              <div className="flex gap-2 mt-3 flex-wrap">
                <input
                  type="text"
                  name="name"
                  placeholder="Exercise"
                  value={exerciseForms[w.id]?.name || ""}
                  onChange={(e) => handleChange(w.id, e)}
                  className="flex-1 bg-neutral-900 text-white p-2 rounded"
                />
                <input
                  type="text"
                  name="sets"
                  placeholder="Sets"
                  value={exerciseForms[w.id]?.sets || ""}
                  onChange={(e) => handleChange(w.id, e)}
                  className="w-20 bg-neutral-900 text-white p-2 rounded"
                />
                <input
                  type="text"
                  name="reps"
                  placeholder="Reps"
                  value={exerciseForms[w.id]?.reps || ""}
                  onChange={(e) => handleChange(w.id, e)}
                  className="w-20 bg-neutral-900 text-white p-2 rounded"
                />
                <input
                  type="text"
                  name="weight"
                  placeholder="Weight"
                  value={exerciseForms[w.id]?.weight || ""}
                  onChange={(e) => handleChange(w.id, e)}
                  className="w-24 bg-neutral-900 text-white p-2 rounded"
                />
                <button
                  onClick={() => handleAddExercise(w.id)}
                  className="bg-red-600 hover:bg-red-700 px-3 rounded font-semibold"
                >
                  ➕
                </button>
              </div>
            </div>
          )}
        />
      )}
    </div>
  );
}
