// src/context/AppContext.jsx
import React, { createContext, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { checkUsageCap } from "../utils/usageCaps";

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  // ============================
  // USER SESSION
  // ============================
  const [user, setUser] = useState(null);

  // ============================
  // PRs
  // ============================
  const [prs, setPRs] = useState([]);

  // ============================
  // Load user session
  // ============================
  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    }
    loadUser();
  }, []);

  // ============================
  // Load PRs
  // ============================
  useEffect(() => {
    if (!user?.id) return;
    loadPRs();
  }, [user]);

  async function loadPRs() {
    const { data, error } = await supabase
      .from("prs")
      .select("*")
      .eq("user_id", user.id)
      .order("order_index", { ascending: true });

    if (!error && data) setPRs(data);
  }

  // ============================
  // CREATE PR
  // ============================
  async function createPR(lift, weight, unit, date, reps, notes) {
    if (!user?.id) return { success: false };
    const cap = await checkUsageCap(user.id, "prs");
    if (!cap.allowed) {
      return { success: false, cap };
    }
    const { data, error } = await supabase
      .from("prs")
      .insert({
        user_id: user.id,
        lift_name: lift,
        weight,
        unit,
        date,
        reps,
        notes,
        order_index: prs.length,
      })
      .select();

    if (!error && data) {
      setPRs((prev) => [...prev, data[0]]);
      return { success: true };
    }
    return { success: false };
  }

  // ============================
  // EDIT PR
  // ============================
  async function editPR(id, fields) {
    const { data, error } = await supabase
      .from("prs")
      .update(fields)
      .eq("id", id)
      .select();

    if (!error && data) {
      setPRs((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...data[0] } : p))
      );
    }
  }

  // ============================
  // DELETE PR
  // ============================
  async function removePR(id) {
    const { error } = await supabase.from("prs").delete().eq("id", id);
    if (!error) {
      setPRs((prev) => prev.filter((p) => p.id !== id));
    }
  }

  // ============================
  // REORDER PRs
  // ============================
  async function reorderPRs(updates) {
    const { error } = await supabase.from("prs").upsert(updates);
    if (!error) {
      setPRs((prev) =>
        prev
          .map((pr) => {
            const update = updates.find((u) => u.id === pr.id);
            return update ? { ...pr, order_index: update.order_index } : pr;
          })
          .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
      );
    }
  }

  // ============================
  // CONTEXT EXPORT
  // ============================
  return (
    <AppContext.Provider
      value={{
        user,
        prs,
        createPR,
        editPR,
        removePR,
        reorderPRs,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
