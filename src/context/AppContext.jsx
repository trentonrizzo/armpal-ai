// src/context/AppContext.jsx
import React, { createContext, useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

import {
  getWorkoutsWithExercises,
  addWorkout,
  updateWorkout,
  deleteWorkout
} from "../api/workouts";

import {
  addExercise,
  updateExercise,
  deleteExercise
} from "../api/exercises";

import {
  getPRs,
  addPR,
  deletePR,
  updatePR,
  updatePROrder
} from "../api/prs";

import {
  getMeasurements,
  addMeasurement,
  deleteMeasurement
} from "../api/measurements";

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  const [workouts, setWorkouts] = useState([]);
  const [prs, setPRs] = useState([]);
  const [measurements, setMeasurements] = useState([]);

  const [isLoading, setIsLoading] = useState(true);

  // ---------------------------
  // AUTH: Load User
  // ---------------------------
  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (data?.user) setUser(data.user);
      setIsLoading(false);
    }

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_, session) => setUser(session?.user ?? null)
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  // ---------------------------
  // Load All Data After Login
  // ---------------------------
  useEffect(() => {
    if (!user) return;

    async function loadAllData() {
      const uid = user.id;

      setWorkouts((await getWorkoutsWithExercises(uid)) || []);
      setPRs((await getPRs(uid)) || []);
      setMeasurements((await getMeasurements(uid)) || []);
    }

    loadAllData();
  }, [user]);

  // ---------------------------
  // Refresh Helpers
  // ---------------------------
  async function refreshWorkouts() {
    if (!user) return;
    setWorkouts((await getWorkoutsWithExercises(user.id)) || []);
  }

  async function refreshPRs() {
    if (!user) return;
    setPRs((await getPRs(user.id)) || []);
  }

  async function refreshMeasurements() {
    if (!user) return;
    setMeasurements((await getMeasurements(user.id)) || []);
  }

  // ---------------------------
  // REALTIME SUBSCRIPTIONS
  // ---------------------------
  useEffect(() => {
    if (!user) return;

    const uid = user.id;

    const workoutsSub = supabase
      .channel("workouts-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workouts", filter: `user_id=eq.${uid}` },
        refreshWorkouts
      )
      .subscribe();

    const exercisesSub = supabase
      .channel("exercises-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "exercises", filter: `user_id=eq.${uid}` },
        refreshWorkouts
      )
      .subscribe();

    const prsSub = supabase
      .channel("prs-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "PRs", filter: `user_id=eq.${uid}` },
        refreshPRs
      )
      .subscribe();

    const measurementsSub = supabase
      .channel("measurements-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "measurements", filter: `user_id=eq.${uid}` },
        refreshMeasurements
      )
      .subscribe();

    return () => {
      supabase.removeChannel(workoutsSub);
      supabase.removeChannel(exercisesSub);
      supabase.removeChannel(prsSub);
      supabase.removeChannel(measurementsSub);
    };
  }, [user]);

  // ---------------------------
  // WORKOUT ACTIONS
  // ---------------------------
  async function createWorkout(name) {
    const newItem = await addWorkout({ userId: user.id, name });
    if (newItem) refreshWorkouts();
  }

  async function removeWorkout(id) {
    await deleteWorkout(id);
    refreshWorkouts();
  }

  async function createExercise(workoutId, name, sets, reps, weight) {
    const newItem = await addExercise({
      userId: user.id,
      workoutId,
      name,
      sets,
      reps,
      weight,
    });
    if (newItem) refreshWorkouts();
  }

  async function removeExercise(id) {
    await deleteExercise(id);
    refreshWorkouts();
  }

  // ---------------------------
  // PR ACTIONS (FULL UPGRADE)
  // ---------------------------
  async function createPR(lift_name, weight, unit, date) {
    const newItem = await addPR({
      userId: user.id,
      lift_name,
      weight,
      unit,
      date,
    });
    if (newItem) refreshPRs();
  }

  async function removePR(id) {
    await deletePR(id);
    refreshPRs();
  }

  async function editPR(id, values) {
    await updatePR(id, values);
    refreshPRs();
  }

  async function reorderPRs(newOrder) {
    // newOrder: [{ id, order_index }]
    await updatePROrder(newOrder);
    refreshPRs();
  }

  // ---------------------------
  // MEASUREMENTS
  // ---------------------------
  async function createMeasurement(name, value, unit, date) {
    const newItem = await addMeasurement({
      userId: user.id,
      name,
      value,
      unit,
      date,
    });
    if (newItem) refreshMeasurements();
  }

  async function removeMeasurement(id) {
    await deleteMeasurement(id);
    refreshMeasurements();
  }

  return (
    <AppContext.Provider
      value={{
        user,
        workouts,
        prs,
        measurements,

        createWorkout,
        removeWorkout,
        createExercise,
        removeExercise,

        createPR,
        removePR,
        editPR,
        reorderPRs,

        createMeasurement,
        removeMeasurement,

        isLoading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
