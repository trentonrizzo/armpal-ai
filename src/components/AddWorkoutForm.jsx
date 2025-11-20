// src/components/AddWorkoutForm.jsx
import React, { useState } from 'react';
import { useData } from '../context/DataContext.jsx';

const AddWorkoutForm = () => {
  const { addWorkout } = useData();
  const [form, setForm] = useState({ name: '', sets: '', reps: '', weight: '' });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name) return;
    addWorkout({
      ...form,
      date: new Date().toLocaleDateString(),
    });
    setForm({ name: '', sets: '', reps: '', weight: '' });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-neutral-800 p-4 rounded-xl mb-4">
      <h2 className="text-lg font-semibold mb-3 text-red-500">Add Workout</h2>
      <input
        type="text"
        name="name"
        placeholder="Exercise name"
        value={form.name}
        onChange={handleChange}
        className="w-full mb-2 p-2 rounded bg-neutral-900 text-white"
      />
      <div className="flex gap-2">
        <input
          type="number"
          name="sets"
          placeholder="Sets"
          value={form.sets}
          onChange={handleChange}
          className="w-1/3 p-2 rounded bg-neutral-900 text-white"
        />
        <input
          type="number"
          name="reps"
          placeholder="Reps"
          value={form.reps}
          onChange={handleChange}
          className="w-1/3 p-2 rounded bg-neutral-900 text-white"
        />
        <input
          type="number"
          name="weight"
          placeholder="Weight (lb)"
          value={form.weight}
          onChange={handleChange}
          className="w-1/3 p-2 rounded bg-neutral-900 text-white"
        />
      </div>
      <button
        type="submit"
        className="mt-3 w-full bg-red-600 hover:bg-red-700 transition rounded p-2 font-semibold"
      >
        Add Workout
      </button>
    </form>
  );
};

export default AddWorkoutForm;
