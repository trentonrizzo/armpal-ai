import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import WorkoutModal from "../components/WorkoutModal.jsx";
import "../flames.css";

import { checkUsageCap } from "../utils/usageCaps";
import {
  getWorkoutsWithExercises,
  addWorkout as addWorkoutApi,
  updateWorkout as updateWorkoutApi,
  deleteWorkout as deleteWorkoutApi,
} from "../api/workouts";

import {
  addExercise as addExerciseApi,
  deleteExercise as deleteExerciseApi,
} from "../api/exercises";

export default function WorkoutLogger() {
  const [user, setUser] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newWorkout, setNewWorkout] = useState("");
  const [modalWorkout, setModalWorkout] = useState(null);
  const [capMessage, setCapMessage] = useState("");

  // LOAD WORKOUTS
  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      setUser(user);

      const data = await getWorkoutsWithExercises(user.id);
      setWorkouts(data);
      setLoading(false);
    };

    load();
  }, []);

  // ADD WORKOUT
  const handleAddWorkout = async () => {
    if (!newWorkout.trim() || !user) return;

    const cap = await checkUsageCap(user.id, "workouts");
    if (!cap.allowed) {
      setCapMessage(`Workout limit reached (${cap.limit}). Go Pro for more!`);
      return;
    }
    setCapMessage("");

    const created = await addWorkoutApi({
      userId: user.id,
      name: newWorkout.trim(),
    });

    if (created) {
      setWorkouts((prev) => [
        { ...created, exercises: [] },
        ...prev,
      ]);
      setNewWorkout("");
    }
  };

  // DELETE WORKOUT
  const handleDeleteWorkout = async (id) => {
    await deleteWorkoutApi(id);
    setWorkouts((prev) => prev.filter((w) => w.id !== id));
  };

  // ADD EXERCISE FROM MODAL
  const handleAddExerciseWithinModal = async (name) => {
    if (!modalWorkout || !user) return;
    if (!name.trim()) return;

    const created = await addExerciseApi({
      userId: user.id,
      workoutId: modalWorkout.id,
      name: name.trim(),
      sets: null,
      reps: null,
      weight: "",
    });

    if (!created) return;

    // UPDATE UI
    setWorkouts((prev) =>
      prev.map((w) =>
        w.id === modalWorkout.id
          ? { ...w, exercises: [...w.exercises, created] }
          : w
      )
    );

    setModalWorkout((prev) => ({
      ...prev,
      exercises: [...prev.exercises, created],
    }));
  };

  // DELETE EXERCISE
  const handleDeleteExerciseWithinModal = async (exId) => {
    await deleteExerciseApi(exId);

    setWorkouts((prev) =>
      prev.map((w) =>
        w.id === modalWorkout.id
          ? { ...w, exercises: w.exercises.filter((e) => e.id !== exId) }
          : w
      )
    );

    setModalWorkout((prev) => ({
      ...prev,
      exercises: prev.exercises.filter((e) => e.id !== exId),
    }));
  };

  if (loading) {
    return (
      <div className="p-6 text-white text-lg">
        Loading your workouts...
      </div>
    );
  }

  return (
    <div className="p-6 text-white">

      <h1 className="text-3xl font-bold mb-4 text-red-500">
        Your Workouts
      </h1>

      <div className="flex gap-2 mb-5">
        <input
          type="text"
          placeholder="New workout (e.g. Push Day)"
          value={newWorkout}
          onChange={(e) => setNewWorkout(e.target.value)}
          className="flex-1 bg-neutral-900 text-white p-3 rounded-xl border border-neutral-700"
        />
        <button
          onClick={handleAddWorkout}
          className="bg-red-600 hover:bg-red-700 px-4 rounded-xl font-semibold"
        >
          Add
        </button>
      </div>
      {capMessage ? <p className="text-red-400 text-sm mb-2">{capMessage}</p> : null}

      {workouts.length === 0 ? (
        <p className="text-gray-400">No workouts yet.</p>
      ) : (
        <div className="space-y-4">
          {workouts.map((w) => (
            <div
              key={w.id}
              className="bg-neutral-800 p-4 rounded-xl border border-neutral-700 hover:border-red-600 transition cursor-pointer"
              onClick={() => setModalWorkout(w)}
            >
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-red-400">
                  {w.name}
                </h2>

                <button
                  className="text-gray-400 hover:text-red-500 text-xl"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteWorkout(w.id);
                  }}
                >
                  ✖
                </button>
              </div>

              <p className="text-neutral-400 mt-1 text-sm">
                {w.exercises?.length || 0} exercises
              </p>
            </div>
          ))}
        </div>
      )}

      {modalWorkout && (
        <WorkoutModal
          workout={modalWorkout}
          onClose={() => setModalWorkout(null)}
          onAddExercise={handleAddExerciseWithinModal}
          onDeleteExercise={handleDeleteExerciseWithinModal}
        />
      )}

    </div>
  );
}
