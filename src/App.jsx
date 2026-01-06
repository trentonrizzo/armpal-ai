// src/App.jsx
import React, { useEffect, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { supabase } from "./supabaseClient";

import { AppProvider } from "./context/AppContext";
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
import EnableNotifications from "./pages/EnableNotifications";
import StrengthCalculator from "./pages/StrengthCalculator";
import FriendProfile from "./pages/FriendProfile";
import usePresence from "./hooks/usePresence";

// Analytics pages
import Analytics from "./pages/Analytics";
import MeasurementAnalytics from "./pages/MeasurementAnalytics";

import BottomNav from "./components/BottomNav/BottomNav";
import ShareWorkoutsModal from "./components/workouts/ShareWorkoutsModal";
import { FaShare } from "react-icons/fa";
import { initOneSignal } from "./onesignal";
import ResetPassword from "./pages/ResetPassword";

// Achievement overlay
import AchievementOverlay from "./overlays/AchievementOverlay";

/* ============================================================
   APP CONTENT (ROUTER + OVERLAYS)
============================================================ */
function AppContent() {
  const location = useLocation();
  const isChatRoute = location.pathname.startsWith("/chat");
  const isWorkouts = location.pathname === "/workouts";
  const [openShare, setOpenShare] = useState(false);

  /* ============================
     APPLY SAVED THEME
  ============================ */
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "dark";
    document.body.setAttribute("data-theme", savedTheme);
  }, []);

  return (
    <div
      className={`${
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
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* ANALYTICS */}
        <Route path="/analytics" element={<Analytics />} />
        <Route
          path="/analytics/measurements"
          element={<MeasurementAnalytics />}
        />
      </Routes>

      {!isChatRoute && <BottomNav />}

      {isWorkouts && (
        <button
          onClick={() => setOpenShare(true)}
          style={{
            position: "fixed",
            top: 14,
            right: 14,
            zIndex: 9999,
            width: 44,
            height: 44,
            borderRadius: 999,
            background: "var(--card)",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "var(--text)",
          }}
        >
          <FaShare />
        </button>
      )}

      <ShareWorkoutsModal
        open={openShare}
        onClose={() => setOpenShare(false)}
      />

      {/* GLOBAL OVERLAY (IN-APP ONLY, NOT NOTIFICATIONS) */}
      <AchievementOverlay />
    </div>
  );
}

/* ============================================================
   ROOT APP (AUTH + PRESENCE + SERVICES)
============================================================ */
export default function App() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  usePresence(session?.user);

  /* ============================
     AUTH SESSION
  ============================ */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) =>
      setSession(s)
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  /* ============================
     PRESENCE PING
  ============================ */
  useEffect(() => {
    if (!session?.user?.id) return;

    const ping = async () => {
      await supabase
        .from("profiles")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", session.user.id);
    };

    ping();
    const interval = setInterval(ping, 30000);

    return () => clearInterval(interval);
  }, [session?.user?.id]);

  /* ============================
     SAFE ONESIGNAL INIT
     (PREVENTS DOMAIN CRASH)
  ============================ */
  useEffect(() => {
    if (!session) return;

    try {
      if (
        typeof window !== "undefined" &&
        window.location.hostname === "armpalapp.vercel.app"
      ) {
        initOneSignal();
      }
    } catch (err) {
      console.warn("OneSignal init skipped:", err?.message);
    }
  }, [session]);

  if (!ready) return null;
  if (!session) return <AuthPage />;

  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
