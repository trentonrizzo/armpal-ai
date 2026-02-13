import React, { useContext, useState, useEffect } from "react";
import { AppContext } from "../context/AppContext";
import { checkUsageCap, FREE_CAP } from "../utils/usageLimits";

const Workouts = () => {
  const { workouts, setWorkouts, user } = useContext(AppContext);
  const [workoutTitle, setWorkoutTitle] = useState("");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [cap, setCap] = useState(null);

  const [activeWorkoutId, setActiveWorkoutId] = useState(null);
  const [exerciseName, setExerciseName] = useState("");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    checkUsageCap(user.id, "workouts").then(setCap);
  }, [user?.id, workouts?.length]);

  const handleAddWorkout = async () => {
    if (!workoutTitle) {
      alert("Please enter a workout title!");
      return;
    }
    if (!user?.id) return;
    const limitCheck = await checkUsageCap(user.id, "workouts");
    if (!limitCheck.allowed) {
      setShowUpgrade(true);
      return;
    }

    const newWorkout = {
      id: Date.now(),
      title: workoutTitle,
      exercises: [],
    };

    setWorkouts([...workouts, newWorkout]);
    setWorkoutTitle("");
  };

  const handleDeleteWorkout = (id) => {
    setWorkouts(workouts.filter((w) => w.id !== id));
    if (activeWorkoutId === id) setActiveWorkoutId(null);
  };

  const handleAddExercise = (workoutId) => {
    if (!exerciseName || !sets || !reps) {
      alert("Please fill in exercise name, sets, and reps!");
      return;
    }

    const newExercise = {
      id: Date.now(),
      name: exerciseName,
      sets,
      reps,
      weight,
      notes,
    };

    const updatedWorkouts = workouts.map((w) =>
      w.id === workoutId
        ? { ...w, exercises: [...w.exercises, newExercise] }
        : w
    );

    setWorkouts(updatedWorkouts);

    // Reset exercise form
    setExerciseName("");
    setSets("");
    setReps("");
    setWeight("");
    setNotes("");
  };

  const handleDeleteExercise = (workoutId, exerciseId) => {
    const updatedWorkouts = workouts.map((w) =>
      w.id === workoutId
        ? { ...w, exercises: w.exercises.filter((e) => e.id !== exerciseId) }
        : w
    );
    setWorkouts(updatedWorkouts);
  };

  const maxWorkouts = cap?.limit ?? FREE_CAP;
  const lockedSlots =
    cap && !cap.isPro && workouts.length < maxWorkouts
      ? Array.from({ length: maxWorkouts - workouts.length })
      : [];

  return (
    <div style={{ padding: "2rem", maxWidth: "600px", margin: "auto" }}>
      <h2>Workouts</h2>

      {/* Add Workout */}
      <div style={{ marginBottom: "1rem" }}>
        <input
          type="text"
          placeholder="Workout Title"
          value={workoutTitle}
          onChange={(e) => setWorkoutTitle(e.target.value)}
          style={{ marginRight: "0.5rem" }}
        />
        <button onClick={handleAddWorkout}>Add Workout</button>
      </div>

      {/* List Workouts */}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {workouts.map((w) => (
          <li
            key={w.id}
            style={{
              border: "1px solid #555",
              borderRadius: "6px",
              marginBottom: "1rem",
              padding: "1rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>{w.title}</strong>
              <button
                onClick={() => handleDeleteWorkout(w.id)}
                style={{
                  color: "white",
                  background: "red",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Delete Workout
              </button>
            </div>

            {/* Add Exercise Form */}
            {activeWorkoutId === w.id && (
              <div style={{ marginTop: "1rem" }}>
                <input
                  type="text"
                  placeholder="Exercise Name"
                  value={exerciseName}
                  onChange={(e) => setExerciseName(e.target.value)}
                  style={{ marginRight: "0.5rem" }}
                />
                <input
                  type="number"
                  placeholder="Sets"
                  value={sets}
                  onChange={(e) => setSets(e.target.value)}
                  style={{ marginRight: "0.5rem", width: "60px" }}
                />
                <input
                  type="number"
                  placeholder="Reps"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                  style={{ marginRight: "0.5rem", width: "60px" }}
                />
                <input
                  type="text"
                  placeholder="Weight (optional)"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  style={{ marginRight: "0.5rem", width: "80px" }}
                />
                <input
                  type="text"
                  placeholder="Notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ marginRight: "0.5rem" }}
                />
                <button onClick={() => handleAddExercise(w.id)}>Add</button>
              </div>
            )}

            <button
              onClick={() =>
                setActiveWorkoutId(activeWorkoutId === w.id ? null : w.id)
              }
              style={{ marginTop: "0.5rem" }}
            >
              {activeWorkoutId === w.id ? "Close Exercises" : "Add Exercises"}
            </button>

            {/* List Exercises */}
            <ul style={{ marginTop: "0.5rem", paddingLeft: "1rem" }}>
              {w.exercises.map((e) => (
                <li key={e.id}>
                  {e.name} — {e.sets} sets x {e.reps} reps{" "}
                  {e.weight && `@ ${e.weight}`} {e.notes && `(${e.notes})`}
                  <button
                    onClick={() => handleDeleteExercise(w.id, e.id)}
                    style={{
                      marginLeft: "10px",
                      color: "white",
                      background: "red",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    ❌
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}

        {/* Locked Slots */}
        {lockedSlots.map((_, index) => (
          <li
            key={`locked-${index}`}
            style={{
              opacity: 0.5,
              background: "#222",
              color: "#888",
              marginTop: "0.5rem",
              padding: "0.5rem",
              borderRadius: "4px",
            }}
          >
            🔒 PRO Slot
          </li>
        ))}
      </ul>

      {/* Upgrade Popup */}
      {showUpgrade && (
        <div
          style={{
            background: "rgba(0,0,0,0.8)",
            color: "white",
            padding: "1rem",
            borderRadius: "8px",
            marginTop: "1rem",
            textAlign: "center",
          }}
        >
          <h3>Upgrade to ArmPal PRO</h3>
          <p>Unlock unlimited workouts!</p>
          <button
            onClick={() => setShowUpgrade(false)}
            style={{
              background: "red",
              border: "none",
              color: "white",
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};

export default Workouts;
