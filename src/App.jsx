import React, { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { supabase } from "./supabaseClient";

// Context Provider
import { AppProvider } from "./context/AppContext";

// UI Screens
import SplashScreen from "./SplashScreen";
import CoverScreen from "./CoverScreen";

// Auth
import AuthPage from "./AuthPage";

// Pages
import Dashboard from "./pages/Dashboard";
import PRTracker from "./pages/PRTracker";
import PRsPage from "./pages/PRsPage";
import MeasurementsPage from "./pages/MeasurementsPage";
import WorkoutsPage from "./pages/WorkoutsPage";
import WorkoutLogger from "./pages/WorkoutLogger";
import ProfilePage from "./pages/ProfilePage";
import HomePage from "./pages/HomePage";
import GoalsPage from "./pages/GoalsPage";

// NEW: Bottom NavBar
import BottomNav from "./components/BottomNav/BottomNav";

export default function App() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  // Splash + Cover
  const [showSplash, setShowSplash] = useState(false);
  const [showCover, setShowCover] = useState(false);
  const [firstLaunch, setFirstLaunch] = useState(null);

  // ---------------- AUTH LISTENER ----------------
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

  // ---------------- FIRST LAUNCH LOGIC ----------------
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

  // ---------------- RENDER SPLASH ----------------
  if (firstLaunch === true && showSplash) {
    return (
      <SplashScreen
        onFinished={() => {
          setShowSplash(false);
          setShowCover(true);
        }}
      />
    );
  }

  // ---------------- RENDER COVER ----------------
  if (firstLaunch === true && showCover) {
    return <CoverScreen onEnterApp={() => setShowCover(false)} />;
  }

  // ---------------- WAIT FOR AUTH ----------------
  if (!ready) return null;

  // ---------------- NOT LOGGED IN ----------------
  if (!session) return <AuthPage />;

  // ---------------- MAIN APP ----------------
  return (
    <AppProvider>
      <div className="min-h-screen bg-black text-white pb-20">
        <Routes>
          {/* DEFAULT LANDING PAGE */}
          <Route path="/" element={<Dashboard />} />

          {/* ALL PAGES */}
          <Route path="/home" element={<HomePage />} />
          <Route path="/prs" element={<PRTracker />} />
          <Route path="/prslist" element={<PRsPage />} />
          <Route path="/measure" element={<MeasurementsPage />} />
          <Route path="/workouts" element={<WorkoutsPage />} />
          <Route path="/workoutlogger" element={<WorkoutLogger />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/goals" element={<GoalsPage />} />
        </Routes>

        {/* GLOBAL BOTTOM NAVBAR */}
        <BottomNav />
      </div>
    </AppProvider>
  );
}
