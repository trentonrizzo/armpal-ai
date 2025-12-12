import React, { useEffect, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { supabase } from "./supabaseClient";
import { registerForPush } from "./utils/push";

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

import FriendsPage from "./pages/FriendsPage";
import ChatPage from "./pages/ChatPage";

import StrengthCalculator from "./pages/StrengthCalculator";
import BottomNav from "./components/BottomNav/BottomNav";

function AppContent() {
  const location = useLocation();
  const isChatRoute = location.pathname.startsWith("/chat");

  return (
    <div className={`bg-black text-white ${isChatRoute ? "h-screen overflow-hidden" : "min-h-screen pb-20"}`}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/prs" element={<PRTracker />} />
        <Route path="/measure" element={<MeasurementsPage />} />
        <Route path="/workouts" element={<WorkoutsPage />} />
        <Route path="/workoutlogger" element={<WorkoutLogger />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/goals" element={<GoalsPage />} />
        <Route path="/strength" element={<StrengthCalculator />} />
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/chat/:friendId" element={<ChatPage />} />
      </Routes>

      {!isChatRoute && <BottomNav />}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setReady(true);

      if (session) {
        // 🔥 FORCE PUSH PERMISSION ON LOGIN
        setTimeout(registerForPush, 800);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
      if (session) setTimeout(registerForPush, 800);
    });

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
