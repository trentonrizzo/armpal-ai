// src/pages/GoalsPage.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import GoalCard from "../components/GoalCard";
import { createGoal, getGoals, updateGoal, deleteGoal } from "../api/goals";

export default function GoalsPage() {
  const [userId, setUserId] = useState(null);
  const [goals, setGoals] = useState([]);
  const [form, setForm] = useState({
    id: null,
    title: "",
    current_value: "",
    target_value: "",
  });

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      const id = data?.user?.id;
      setUserId(id);
      if (id) loadUserGoals(id);
    }
    loadUser();
  }, []);

  async function loadUserGoals(id) {
    const list = await getGoals(id);
    setGoals(list);
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const goalData = {
      user_id: userId,
      title: form.title,
      current_value: Number(form.current_value),
      target_value: Number(form.target_value),
      type: "custom",   // REQUIRED by your DB
      unit: "",         // MUST exist, even empty
    };

    if (form.id) {
      await updateGoal(form.id, goalData);
    } else {
      await createGoal(goalData);
    }

    setForm({ id: null, title: "", current_value: "", target_value: "" });
    loadUserGoals(userId);
  }

  function handleEdit(goal) {
    setForm({
      id: goal.id,
      title: goal.title,
      current_value: goal.current_value,
      target_value: goal.target_value,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id) {
    await deleteGoal(id);
    loadUserGoals(userId);
  }

  return (
    <div className="min-h-screen bg-black text-white px-5 pt-8 pb-24">
      <h1 className="text-3xl font-bold mb-6 text-red-500">Goals</h1>

      {/* FORM */}
      <form onSubmit={handleSubmit} className="mb-8 bg-neutral-900 p-5 rounded-2xl border border-neutral-800">
        <input
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="Goal title"
          className="input"
        />

        <div className="flex gap-4 mt-3">
          <input
            name="current_value"
            value={form.current_value}
            onChange={handleChange}
            type="number"
            placeholder="Current"
            className="input"
          />
          <input
            name="target_value"
            value={form.target_value}
            onChange={handleChange}
            type="number"
            placeholder="Target"
            className="input"
          />
        </div>

        <button
          type="submit"
          className="w-full mt-4 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold"
        >
          {form.id ? "Update Goal" : "Add Goal"}
        </button>
      </form>

      {/* LIST */}
      {goals.length === 0 && (
        <div className="text-gray-500 text-center mt-10">
          No goals yet — add your first one!
        </div>
      )}

      {goals.map((goal) => (
        <GoalCard
          key={goal.id}
          goal={goal}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
}
