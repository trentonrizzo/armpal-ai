// src/App.jsx
import React, { useEffect, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { supabase } from "./supabaseClient";

import { AppProvider } from "./context/AppContext";

// Auth
import AuthPage from "./AuthPage";

// Pages
import Dashboard from "./pages/Dashboard";
import PRTracker from "./pages/PRTracker";
import MeasurementsPage from "./pages/MeasurementsPage";
import WorkoutsPage from "./pages/WorkoutsPage";
import WorkoutLogger from "./pages/WorkoutLogger";
import ProfilePage from "./pages/ProfilePage";
import HomePage from "./pages/HomePage";
import GoalsPage from "./pages/GoalsPage";
import FriendsPage from "./pages/FriendsPage";
import ChatPage from "./pages/ChatPage";
import EnableNotifications from "./pages/EnableNotifications";
import StrengthCalculator from "./pages/StrengthCalculator";

// Navbar
import BottomNav from "./components/BottomNav/BottomNav";

// OneSignal
import { initOneSignal } from "./onesignal";

function AppContent() {
  const location = useLocation();
  const isChatRoute = location.pathname.startsWith("/chat");

  return (
    <div
      className={`bg-black text-white ${
        isChatRoute ? "h-screen overflow-hidden" : "min-h-screen pb-20"
      }`}
    >
      <Routes>
        {/* MAIN */}
        <Route path="/" element={<Dashboard />} />
        <Route path="/home" element={<HomePage />} />

        {/* PRS */}
        <Route path="/prs" element={<PRTracker />} />

        {/* FITNESS */}
        <Route path="/measure" element={<MeasurementsPage />} />
        <Route path="/workouts" element={<WorkoutsPage />} />
        <Route path="/workoutlogger" element={<WorkoutLogger />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/goals" element={<GoalsPage />} />

        {/* TOOLS */}
        <Route path="/strength" element={<StrengthCalculator />} />

        {/* SOCIAL */}
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/chat/:friendId" element={<ChatPage />} />

        {/* 🔔 ENABLE PUSH */}
        <Route
          path="/enable-notifications"
          element={<EnableNotifications />}
        />
      </Routes>

      {!isChatRoute && <BottomNav />}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Initial session load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setReady(true);

      // ✅ INIT ONESIGNAL ONLY WHEN USER EXISTS
      if (session) {
        initOneSignal();
      }
    });

    // Listen for auth changes (login / logout)
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);

        if (session) {
          await initOneSignal();
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  if (!ready) return null;
  if (!session) return <AuthPage />;

  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
