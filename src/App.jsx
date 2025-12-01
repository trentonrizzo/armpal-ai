import React, { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { supabase } from "./supabaseClient";

import { AppProvider } from "./context/AppContext";

import SplashScreen from "./SplashScreen";
import CoverScreen from "./CoverScreen";
import AuthPage from "./AuthPage";

import Dashboard from "./pages/Dashboard";
import PRTracker from "./pages/PRTracker";
import MeasurementsPage from "./pages/MeasurementsPage";
import WorkoutsPage from "./pages/WorkoutsPage";
import WorkoutLogger from "./pages/WorkoutLogger";
import ProfilePage from "./pages/ProfilePage";
import HomePage from "./pages/HomePage";
import GoalsPage from "./pages/GoalsPage";

// Strength Calculator
import StrengthCalculator from "./pages/StrengthCalculator";

import BottomNav from "./components/BottomNav/BottomNav";

export default function App() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  const [showSplash, setShowSplash] = useState(false);
  const [showCover, setShowCover] = useState(false);
  const [firstLaunch, setFirstLaunch] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const seen = localStorage.getItem("armpal-first-launch");

    if (!seen) {
      setFirstLaunch(true);
      setShowSplash(true);

      localStorage.setItem("armpal-first-launch", "true");

      setTimeout(() => {
        setShowSplash(false);
        setShowCover(true);
      }, 1800);
    } else {
      setFirstLaunch(false);
    }
  }, []);

  if (firstLaunch === true && showSplash) {
    return (
      <SplashScreen onFinished={() => {
        setShowSplash(false);
        setShowCover(true);
      }} />
    );
  }

  if (firstLaunch === true && showCover) {
    return <CoverScreen onEnterApp={() => setShowCover(false)} />;
  }

  if (!ready) return null;

  if (!session) return <AuthPage />;

  return (
    <AppProvider>
      <div className="min-h-screen bg-black text-white pb-20">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/prs" element={<PRTracker />} />
          <Route path="/measure" element={<MeasurementsPage />} />
          <Route path="/workouts" element={<WorkoutsPage />} />
          <Route path="/workoutlogger" element={<WorkoutLogger />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/goals" element={<GoalsPage />} />

          {/* Strength Calculator */}
          <Route path="/strength" element={<StrengthCalculator />} />
        </Routes>

        <BottomNav />
      </div>
    </AppProvider>
  );
}
