// src/context/AppContext.jsx
import React, { createContext, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  // ============================
  // USER SESSION
  // ============================
  const [user, setUser] = useState(null);

  // ============================
  // PRs + GROUPS
  // ============================
  const [prs, setPRs] = useState([]);
  const [groups, setGroups] = useState([]);

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
  // Load PRs + Groups
  // ============================
  useEffect(() => {
    if (!user?.id) return;

    loadPRs();
    loadGroups();
  }, [user]);

  async function loadPRs() {
    const { data, error } = await supabase
      .from("PRs")
      .select("*")
      .eq("user_id", user.id)
      .order("order_index", { ascending: true });

    if (!error && data) setPRs(data);
  }

  async function loadGroups() {
    const { data, error } = await supabase
      .from("pr_groups")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (!error && data) setGroups(data);
  }

  // ============================
  // CREATE NEW PR
  // ============================
  async function createPR(lift, weight, unit, date, reps, notes) {
    const { data, error } = await supabase
      .from("PRs")
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
    }
  }

  // ============================
  // EDIT EXISTING PR
  // ============================
  async function editPR(id, fields) {
    const { data, error } = await supabase
      .from("PRs")
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
    const { error } = await supabase.from("PRs").delete().eq("id", id);
    if (!error) {
      setPRs((prev) => prev.filter((p) => p.id !== id));
    }
  }

  // ============================
  // REORDER PRs
  // (updates order_index for all)
  // ============================
  async function reorderPRs(updates) {
    const { error } = await supabase.from("PRs").upsert(updates);
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
  // GROUPS — optional feature
  // ============================

  // CREATE GROUP
  async function createGroup(name) {
    const { data, error } = await supabase
      .from("pr_groups")
      .insert({
        user_id: user.id,
        name,
      })
      .select();

    if (!error && data) {
      setGroups((prev) => [...prev, data[0]]);
    }
  }

  // REMOVE GROUP (and remove group_id from contained PRs)
  async function removeGroup(groupId) {
    // clear PR memberships
    await supabase
      .from("PRs")
      .update({ group_id: null })
      .eq("group_id", groupId);

    // delete group
    const { error } = await supabase
      .from("pr_groups")
      .delete()
      .eq("id", groupId);

    if (!error) {
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      setPRs((prev) =>
        prev.map((p) =>
          p.group_id === groupId ? { ...p, group_id: null } : p
        )
      );
    }
  }

  // ASSIGN PR TO GROUP
  async function assignToGroup(prId, groupId) {
    const { data, error } = await supabase
      .from("PRs")
      .update({ group_id: groupId })
      .eq("id", prId)
      .select();

    if (!error && data) {
      setPRs((prev) =>
        prev.map((p) => (p.id === prId ? { ...p, group_id: groupId } : p))
      );
    }
  }

  // REMOVE PR FROM GROUP
  async function removeFromGroup(prId) {
    const { data, error } = await supabase
      .from("PRs")
      .update({ group_id: null })
      .eq("id", prId)
      .select();

    if (!error && data) {
      setPRs((prev) =>
        prev.map((p) => (p.id === prId ? { ...p, group_id: null } : p))
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
        groups,

        createPR,
        editPR,
        removePR,
        reorderPRs,

        createGroup,
        removeGroup,
        assignToGroup,
        removeFromGroup,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
