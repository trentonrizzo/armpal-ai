// src/context/DataContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [data, setData] = useState({
    workouts: [],
    prs: [],
    measurements: [],
  });

  // Load data from localStorage on first render
  useEffect(() => {
    const saved = localStorage.getItem('armpalData');
    if (saved) {
      try {
        setData(JSON.parse(saved));
      } catch {
        console.error("Corrupted data in localStorage, resetting...");
        setData({ workouts: [], prs: [], measurements: [] });
      }
    }
  }, []);

  // Save to localStorage on every change
  useEffect(() => {
    localStorage.setItem('armpalData', JSON.stringify(data));
  }, [data]);

  // Workout controls
  const addWorkout = (name) => {
    const newWorkout = {
      id: Date.now(),
      name: name || "Untitled Workout",
      date: new Date().toLocaleDateString(),
      exercises: [],
    };
    setData((prev) => ({ ...prev, workouts: [...prev.workouts, newWorkout] }));
  };

  const editWorkout = (id, newName) => {
    setData((prev) => ({
      ...prev,
      workouts: prev.workouts.map((w) =>
        w.id === id ? { ...w, name: newName } : w
      ),
    }));
  };

  const deleteWorkout = (id) => {
    setData((prev) => ({
      ...prev,
      workouts: prev.workouts.filter((w) => w.id !== id),
    }));
  };

  // Exercise controls
  const addExercise = (workoutId, exercise) => {
    setData((prev) => ({
      ...prev,
      workouts: prev.workouts.map((w) =>
        w.id === workoutId
          ? { ...w, exercises: [...w.exercises, { ...exercise, id: Date.now() }] }
          : w
      ),
    }));
  };

  const editExercise = (workoutId, exerciseId, newExercise) => {
    setData((prev) => ({
      ...prev,
      workouts: prev.workouts.map((w) =>
        w.id === workoutId
          ? {
              ...w,
              exercises: w.exercises.map((ex) =>
                ex.id === exerciseId ? { ...ex, ...newExercise } : ex
              ),
            }
          : w
      ),
    }));
  };

  const deleteExercise = (workoutId, exerciseId) => {
    setData((prev) => ({
      ...prev,
      workouts: prev.workouts.map((w) =>
        w.id === workoutId
          ? { ...w, exercises: w.exercises.filter((ex) => ex.id !== exerciseId) }
          : w
      ),
    }));
  };

  const value = {
    data,
    addWorkout,
    editWorkout,
    deleteWorkout,
    addExercise,
    editExercise,
    deleteExercise,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => useContext(DataContext);
