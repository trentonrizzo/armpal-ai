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
  deletePR
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

  // 🔥 Load user from Supabase Auth
  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();

      if (data?.user) setUser(data.user);

      setIsLoading(false);
    }

    loadUser();

    // Auth listener
    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // 🔥 Load all data when user logs in
  useEffect(() => {
    if (!user) return;

    async function loadAllData() {
      const uid = user.id;

      setWorkouts(await getWorkoutsWithExercises(uid) || []);
      setPRs(await getPRs(uid) || []);
      setMeasurements(await getMeasurements(uid) || []);
    }

    loadAllData();
  }, [user]);

  // 🔥 Refreshers
  async function refreshWorkouts() {
    if (!user) return;
    const data = await getWorkoutsWithExercises(user.id);
    setWorkouts(data || []);
  }

  async function refreshPRs() {
    if (!user) return;
    const data = await getPRs(user.id);
    setPRs(data || []);
  }

  async function refreshMeasurements() {
    if (!user) return;
    const data = await getMeasurements(user.id);
    setMeasurements(data || []);
  }

  // 🔥 REALTIME LISTENERS
  useEffect(() => {
    if (!user) return;

    const uid = user.id;

    // Workouts table
    const workoutsSub = supabase
      .channel("workouts-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workouts", filter: `user_id=eq.${uid}` },
        () => refreshWorkouts()
      )
      .subscribe();

    // Exercises table
    const exercisesSub = supabase
      .channel("exercises-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "exercises", filter: `user_id=eq.${uid}` },
        () => refreshWorkouts()
      )
      .subscribe();

    // PRs table
    const prsSub = supabase
      .channel("prs-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "PRs", filter: `user_id=eq.${uid}` },
        () => refreshPRs()
      )
      .subscribe();

    // Measurements table
    const measurementsSub = supabase
      .channel("measurements-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "measurements", filter: `user_id=eq.${uid}` },
        () => refreshMeasurements()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(workoutsSub);
      supabase.removeChannel(exercisesSub);
      supabase.removeChannel(prsSub);
      supabase.removeChannel(measurementsSub);
    };
  }, [user]);

  // 🔥 ACTIONS (Create/Delete)

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

        createMeasurement,
        removeMeasurement,

        isLoading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
