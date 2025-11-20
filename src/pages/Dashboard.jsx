import React, { useState, useEffect } from "react";
import WorkoutLogger from "./WorkoutLogger.jsx";
import PRTracker from "./PRTracker.jsx";
import MeasurementsPage from "./MeasurementsPage.jsx";
import { supabase } from "../supabaseClient";
import "../animations.css";
import "../glass.css";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("workouts");
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      setUserId(data?.user?.id || "No user");
    }
    loadUser();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const getSectionLabel = () => {
    if (activeTab === "workouts") return "Workout Logger";
    if (activeTab === "prs") return "Personal Records";
    if (activeTab === "measurements") return "Measurements";
    return "";
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center fade-in">
      {/* Neon fog background */}
      <div className="neon-bg" />

      {/* Header */}
      <header className="w-full p-4 flex justify-between items-center border-b border-red-900/40 bg-black/50 backdrop-blur-xl shadow-lg">
        <h1 className="text-4xl font-extrabold text-white flex items-center gap-2 text-glow">
          ArmPal Dashboard <span className="text-yellow-400 text-5xl drop-glow">💪</span>
        </h1>

        <button
          onClick={handleSignOut}
          className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-xl shadow-md shadow-red-900/50 transition-all text-white font-semibold"
        >
          Sign Out
        </button>
      </header>

      {/* Tabs */}
      <nav className="glass-tabs flex gap-4 mt-6">
        <button
          className={`px-5 py-3 rounded-xl transition-all flex items-center gap-2 font-semibold
          ${activeTab === "workouts" 
            ? "bg-red-600 text-white shadow-lg shadow-red-500/40 scale-105 neon-active" 
            : "bg-gray-900/70 text-gray-200 hover:text-white hover:bg-gray-800/70"}`}
          onClick={() => setActiveTab("workouts")}
        >
          🏋️‍♂️ Workouts
        </button>

        <button
          className={`px-5 py-3 rounded-xl transition-all flex items-center gap-2 font-semibold
          ${activeTab === "prs" 
            ? "bg-red-600 text-white shadow-lg shadow-red-500/40 scale-105 neon-active" 
            : "bg-gray-900/70 text-gray-200 hover:text-white hover:bg-gray-800/70"}`}
          onClick={() => setActiveTab("prs")}
        >
          ⚡ PRs
        </button>

        <button
          className={`px-5 py-3 rounded-xl transition-all flex items-center gap-2 font-semibold
          ${activeTab === "measurements" 
            ? "bg-red-600 text-white shadow-lg shadow-red-500/40 scale-105 neon-active" 
            : "bg-gray-900/70 text-gray-200 hover:text-white hover:bg-gray-800/70"}`}
          onClick={() => setActiveTab("measurements")}
        >
          📏 Measurements
        </button>
      </nav>

      {/* Main Content */}
      <main className="w-full max-w-4xl mt-6">
        <div key={activeTab} className="glass-card slide-fade">
          {/* section label */}
          <div className="flex items-center justify-between mb-4">
            <div className="glass-chip text-glow">
              <span className="glass-chip-dot" />
              <span>{getSectionLabel()}</span>
            </div>
            <div className="text-[0.7rem] text-gray-200 uppercase tracking-widest text-glow">
              ArmPal • Online
            </div>
          </div>

          {activeTab === "workouts" && <WorkoutLogger />}
          {activeTab === "prs" && <PRTracker />}
          {activeTab === "measurements" && <MeasurementsPage />}
        </div>
      </main>

      {/* Footer */}
      <div className="mt-6 text-gray-200 text-sm text-glow">
        Logged in as: {userId}
      </div>

      {/* Floating Action Button */}
      <button
        className="neon-fab"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        +
      </button>
    </div>
  );
}
