// src/App.jsx
import React, { useEffect, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { supabase } from "./supabaseClient";

import { AppProvider } from "./context/AppContext";

// Screens
import SplashScreen from "./SplashScreen";
import CoverScreen from "./CoverScreen";
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

// Social
import FriendsPage from "./pages/FriendsPage";
import ChatPage from "./pages/ChatPage";

// Chat UI Test
import ChatUITest from "./pages/chat/ChatUITest";

// Strength Calculator
import StrengthCalculator from "./pages/StrengthCalculator";

// Navbar
import BottomNav from "./components/BottomNav/BottomNav";

function AppContent() {
  const location = useLocation();

  // 🔥 CHAT ROUTES NEED FULL VIEWPORT CONTROL
  const isChatRoute =
    location.pathname.startsWith("/chat");

  return (
    <div
      className={`bg-black text-white ${
        isChatRoute
          ? "h-screen overflow-hidden"
          : "min-h-screen pb-20"
      }`}
    >
      <Routes>
        {/* MAIN */}
        <Route path="/" element={<Dashboard />} />
        <Route path="/home" element={<HomePage />} />

        {/* PRS */}
        <Route path="/prs" element={<PRTracker />} />
        <Route path="/prslist" element={<PRTracker />} />

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

        {/* CHAT UI TEST */}
        <Route path="/chat-test" element={<ChatUITest />} />
      </Routes>

      {/* ❗ Hide BottomNav on chat routes */}
      {!isChatRoute && <BottomNav />}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  const [showSplash, setShowSplash] = useState(false);
  const [showCover, setShowCover] = useState(false);
  const [firstLaunch, setFirstLaunch] = useState(null);

  // AUTH
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

  // SPLASH + COVER
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
      <SplashScreen
        onFinished={() => {
          setShowSplash(false);
          setShowCover(true);
        }}
      />
    );
  }

  if (firstLaunch === true && showCover) {
    return <CoverScreen onEnterApp={() => setShowCover(false)} />;
  }

  // Wait for auth to load
  if (!ready) return null;

  // Logged out
  if (!session) return <AuthPage key="auth" />;

  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
