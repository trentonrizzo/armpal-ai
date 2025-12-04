// src/context/AppContext.jsx
import React, { createContext, useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [userId, setUserId] = useState(null);

  // User Profile
  const [profile, setProfile] = useState(null);

  // PRs (full array)
  const [prs, setPRs] = useState([]);

  // Measurements
  const [measurements, setMeasurements] = useState([]);

  // -----------------------------------------------------
  // AUTH & USER SESSION
  // -----------------------------------------------------
  useEffect(() => {
    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);

      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      setUserId(uid);

      if (uid) {
        loadProfile(uid);
        loadPRs(uid);
        loadMeasurements(uid);
      }
    }

    loadSession();

    // Listen for login/logout changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_, session) => {
        setSession(session);
        const uid = session?.user?.id || null;
        setUserId(uid);

        if (uid) {
          loadProfile(uid);
          loadPRs(uid);
          loadMeasurements(uid);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // -----------------------------------------------------
  // LOAD PROFILE
  // -----------------------------------------------------
  async function loadProfile(uid) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .single();

    setProfile(data || null);
  }

  // -----------------------------------------------------
  // LOAD PRs
  // -----------------------------------------------------
  async function loadPRs(uid) {
    const { data, error } = await supabase
      .from("PRs")
      .select("*")
      .eq("user_id", uid)
      .order("order_index", { ascending: true });

    if (!error && data) setPRs(data);
  }

  // -----------------------------------------------------
  // LOAD MEASUREMENTS
  // -----------------------------------------------------
  async function loadMeasurements(uid) {
    const { data } = await supabase
      .from("measurements")
      .select("*")
      .eq("user_id", uid)
      .order("date", { ascending: false });

    setMeasurements(data || []);
  }
  // -----------------------------------------------------
  // CREATE NEW PR
  // -----------------------------------------------------
  async function createPR(lift_name, weight, unit = "lbs", date) {
    if (!userId) return;

    const maxOrder =
      prs.length > 0 ? Math.max(...prs.map((p) => p.order_index || 0)) : 0;

    const { data, error } = await supabase
      .from("PRs")
      .insert([
        {
          user_id: userId,
          lift_name,
          weight,
          unit,
          date,
          order_index: maxOrder + 1,
        },
      ])
      .select("*")
      .single();

    if (!error && data) {
      setPRs((prev) => [...prev, data]);
    }
  }

  // -----------------------------------------------------
  // EDIT PR
  // -----------------------------------------------------
  async function editPR(id, fields) {
    const { data, error } = await supabase
      .from("PRs")
      .update(fields)
      .eq("id", id)
      .select("*")
      .single();

    if (!error && data) {
      setPRs((prev) =>
        prev.map((pr) => (pr.id === id ? data : pr))
      );
    }
  }

  // -----------------------------------------------------
  // DELETE PR
  // -----------------------------------------------------
  async function removePR(id) {
    const { error } = await supabase.from("PRs").delete().eq("id", id);

    if (!error) {
      setPRs((prev) => prev.filter((p) => p.id !== id));
    }
  }

  // -----------------------------------------------------
  // REORDER PRs (Drag + Drop)
  // -----------------------------------------------------
  async function reorderPRs(updates) {
    // updates = [{ id: 123, order_index: 0 }, {...}]
    const { error } = await supabase.from("PRs").upsert(updates);

    if (!error) {
      setPRs((prev) =>
        prev.map((pr) => {
          const updated = updates.find((u) => u.id === pr.id);
          return updated ? { ...pr, order_index: updated.order_index } : pr;
        })
      );
    }
  }

  // -----------------------------------------------------
  // UPDATE PROFILE (name, avatar, etc)
  // -----------------------------------------------------
  async function updateProfile(fields) {
    if (!userId) return;

    const { data, error } = await supabase
      .from("profiles")
      .update(fields)
      .eq("id", userId)
      .select("*")
      .single();

    if (!error && data) {
      setProfile(data);
    }
  }

  // -----------------------------------------------------
  // RETURN PROVIDER
  // -----------------------------------------------------
  return (
    <AppContext.Provider
      value={{
        session,
        userId,

        // profile
        profile,
        updateProfile,

        // PRs
        prs,
        createPR,
        editPR,
        removePR,
        reorderPRs,

        // measurements
        measurements,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
