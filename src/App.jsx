// src/App.jsx
import React, { useEffect, useState, lazy, Suspense } from "react";
import { Routes, Route, useLocation, useParams, Navigate } from "react-router-dom";
import { supabase } from "./supabaseClient";

import { AppProvider } from "./context/AppContext";
import { ToastProvider } from "./components/ToastProvider";
import AuthPage from "./AuthPage";

import Dashboard from "./pages/Dashboard";
import PRTracker from "./pages/PRTracker";
import MeasurementsPage from "./pages/MeasurementsPage";
import WorkoutsPage from "./pages/WorkoutsPage";
import WorkoutLogger from "./pages/WorkoutLogger";
import ProfilePage from "./pages/ProfilePage";
import FriendProfilePage from "./pages/FriendProfilePage";
import HomePage from "./pages/HomePage";
import GoalsPage from "./pages/GoalsPage";
import FriendsPage from "./pages/FriendsPage";
import ChatPage from "./pages/ChatPage";
import EnableNotifications from "./pages/EnableNotifications";
import StrengthCalculator from "./pages/StrengthCalculator";
import FriendProfile from "./pages/FriendProfile";
import ResetPassword from "./pages/ResetPassword";

import Analytics from "./pages/Analytics";
import MeasurementAnalytics from "./pages/MeasurementAnalytics";
import ProUpgradePage from "./pages/ProUpgradePage";

import ProgramMarketplace from "./features/programs/ProgramMarketplace";
import ProgramPreview from "./features/programs/ProgramPreview";
import ProgramViewer from "./features/programs/ProgramViewer";
import MyPrograms from "./features/programs/MyPrograms";
import CreateProgram from "./features/programs/CreateProgram";

import BottomNav from "./components/BottomNav/BottomNav";
import ShareWorkoutsModal from "./components/workouts/ShareWorkoutsModal";
import { FaShare } from "react-icons/fa";

import { initOneSignalForCurrentUser, promptPushIfNeeded } from "./onesignal";
import usePresence from "./hooks/usePresence";

/* ============================
   ACHIEVEMENT OVERLAY (FIX)
============================ */
const AchievementOverlay = lazy(() =>
  typeof window !== "undefined"
    ? import("./overlays/AchievementOverlay")
    : Promise.resolve({ default: () => null })
);

/* ============================
   LEGACY HANDLE REDIRECT
============================ */
function LegacyHandleRedirect() {
  const { handle } = useParams();
  const clean = handle?.startsWith("@") ? handle.slice(1) : handle;
  const [target, setTarget] = useState(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!clean) return;

      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("handle", clean)
        .maybeSingle();

      if (!alive) return;

      if (data?.id) {
        // FORCE full navigation so PWA does not resume a cached route
        window.location.replace(`/friend/${data.id}`);
      } else {
        window.location.replace("/");
      }
    })();

    return () => {
      alive = false;
    };
  }, [clean]);

  return null;
}

/* ============================
   RUNTIME SPLASH
============================ */
function RuntimeSplash({ show }) {
  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999999,
        background: "#000",
        display: "grid",
        placeItems: "center",
      }}
    >
      <img
        src="/pwa-512x512.png"
        alt="ArmPal"
        style={{
          width: 220,
          opacity: 0,
          transform: "scale(0.9)",
          animation: "apFade 0.6s ease forwards",
        }}
      />
      <style>{`
        @keyframes apFade {
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function AppContent() {
  const location = useLocation();
  const isChatRoute = location.pathname.startsWith("/chat");
  const isWorkouts = location.pathname === "/workouts";
  const [openShare, setOpenShare] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedMode = localStorage.getItem("armpal_mode") || "dark";
    const savedTheme = localStorage.getItem("armpal_theme") || "red";
    document.documentElement.setAttribute("data-theme", savedMode);
    document.documentElement.setAttribute("data-accent", savedTheme);
    if (document.body) document.body.setAttribute("data-theme", savedMode);
  }, []);

  return (
    <div className={isChatRoute ? "h-screen overflow-hidden" : "min-h-screen pb-20"}>
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

        <Route path="/u/:handle" element={<LegacyHandleRedirect />} />
        <Route path="/friend/:friendId" element={<FriendProfile />} />
        <Route path="/chat/:friendId" element={<ChatPage />} />
        <Route path="/enable-notifications" element={<EnableNotifications />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/analytics/measurements" element={<MeasurementAnalytics />} />
        <Route path="/pro" element={<ProUpgradePage />} />
        <Route path="/programs" element={<ProgramMarketplace />} />
        <Route path="/programs/create" element={<CreateProgram />} />
        <Route path="/programs/my" element={<MyPrograms />} />
        <Route path="/programs/:id" element={<ProgramPreview />} />
        <Route path="/programs/:id/view" element={<ProgramViewer />} />
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

      <ShareWorkoutsModal open={openShare} onClose={() => setOpenShare(false)} />

      {mounted && (
        <Suspense fallback={null}>
          <AchievementOverlay />
        </Suspense>
      )}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  usePresence(session?.user);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setReady(true);
      setTimeout(() => setShowSplash(false), 1200);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
    }

    // Initialize OneSignal + register device for this user.
    // Safe to call multiple times; underlying helper de‑duplicates per session.
    initOneSignalForCurrentUser();

    // One-time first tap/click: trigger permission prompt if not yet granted (iOS-safe).
    let fired = false;
    function onFirstInteraction() {
      if (fired) return;
      fired = true;
      removeListener();
      if (typeof Notification !== "undefined" && Notification.permission === "granted") return;
      promptPushIfNeeded();
    }

    function removeListener() {
      document.removeEventListener("click", onFirstInteraction);
      document.removeEventListener("touchstart", onFirstInteraction, { capture: true });
    }

    document.addEventListener("click", onFirstInteraction);
    document.addEventListener("touchstart", onFirstInteraction, { capture: true });

    return removeListener;
  }, [session]);

  return (
    <>
      <RuntimeSplash show={showSplash} />
      {!ready ? null : !session ? (
        <AuthPage />
      ) : (
        <AppProvider>
          <ToastProvider>
            <AppContent />
          </ToastProvider>
        </AppProvider>
      )}
    </>
  );
}
