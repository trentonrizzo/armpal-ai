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
import FriendProfile from "./pages/FriendProfile";

// Navbar
import BottomNav from "./components/BottomNav/BottomNav";

// Share button (SAFE)
import WorkoutShareButton from "./components/workouts/WorkoutShareButton";

// OneSignal
import { initOneSignal } from "./onesignal";

function AppContent() {
  const location = useLocation();
  const isChatRoute = location.pathname.startsWith("/chat");

  function handleShareClick() {
    alert("Share clicked — logic comes next");
  }

  return (
    <div
      className={`bg-black text-white ${
        isChatRoute ? "h-screen overflow-hidden" : "min-h-screen pb-20"
      }`}
    >
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
        <Route path="/friend/:friendId" element={<FriendProfile />} />
        <Route path="/chat/:friendId" element={<ChatPage />} />
        <Route path="/enable-notifications" element={<EnableNotifications />} />
      </Routes>

      {!isChatRoute && <BottomNav />}

      {/* GUARANTEED SHARE ICON */}
      <WorkoutShareButton onClick={handleShareClick} />
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
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    initOneSignal();
  }, [session]);

  if (!ready) return null;
  if (!session) return <AuthPage />;

  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
