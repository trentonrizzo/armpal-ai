// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Link } from "react-router-dom";
import { FaUserCircle } from "react-icons/fa";

export default function Dashboard() {
  const [userName, setUserName] = useState("");

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      const email = data?.user?.email || "User";
      setUserName(email.split("@")[0]);
    }
    loadUser();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white pb-24">

      {/* 🔥 GRADIENT HERO HEADER */}
      <div className="w-full h-40 bg-gradient-to-b from-red-700/70 to-transparent px-6 pt-8 flex justify-between items-start">
        <h1 className="text-3xl font-extrabold tracking-wide">
          ArmPal
        </h1>

        <Link to="/profile">
          <FaUserCircle className="text-white" size={36} />
        </Link>
      </div>

      <div className="px-6 -mt-6">

        {/* 🔹 Tight Stats Row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Link
            to="/workouts"
            className="bg-neutral-900 p-3 rounded-xl border border-neutral-800 text-center"
          >
            <p className="text-sm text-gray-400">Workouts</p>
            <p className="text-xl font-bold text-red-400">This Week</p>
          </Link>

          <Link
            to="/prs"
            className="bg-neutral-900 p-3 rounded-xl border border-neutral-800 text-center"
          >
            <p className="text-sm text-gray-400">PR Count</p>
            <p className="text-xl font-bold text-red-400">—</p>
          </Link>

          <Link
            to="/goals"
            className="bg-neutral-900 p-3 rounded-xl border border-neutral-800 text-center"
          >
            <p className="text-sm text-gray-400">Goals</p>
            <p className="text-xl font-bold text-red-400">—</p>
          </Link>
        </div>

        {/* 🔥 Quick Actions */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Link
            to="/workoutlogger"
            className="bg-red-600 hover:bg-red-500 transition p-4 rounded-2xl text-center font-bold"
          >
            Track Workout
          </Link>

          <Link
            to="/prs"
            className="bg-neutral-900 hover:bg-neutral-800 transition p-4 rounded-2xl text-center font-bold border border-neutral-700"
          >
            View PRs
          </Link>

          <Link
            to="/measure"
            className="bg-neutral-900 hover:bg-neutral-800 transition p-4 rounded-2xl text-center font-bold border border-neutral-700 col-span-2"
          >
            Update Measurements
          </Link>
        </div>

        {/* 🔥 Big Sexy Cards */}
        <div className="space-y-5">

          <Link
            to="/workouts"
            className="block bg-neutral-900 p-5 rounded-2xl shadow-lg border border-neutral-800"
          >
            <h3 className="text-xl font-bold text-red-400">Last Workout</h3>
            <p className="text-gray-400 mt-2">See your most recent session.</p>
          </Link>

          <Link
            to="/prslist"
            className="block bg-neutral-900 p-5 rounded-2xl shadow-lg border border-neutral-800"
          >
            <h3 className="text-xl font-bold text-red-400">Latest PR</h3>
            <p className="text-gray-400 mt-2">Check your newest records.</p>
          </Link>

          <Link
            to="/goals"
            className="block bg-neutral-900 p-5 rounded-2xl shadow-lg border border-neutral-800"
          >
            <h3 className="text-xl font-bold text-red-400">Goal Progress</h3>
            <p className="text-gray-400 mt-2">
              Track your path toward greatness.
            </p>
          </Link>

        </div>
      </div>
    </div>
  );
}
