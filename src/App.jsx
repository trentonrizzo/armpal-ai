// src/App.jsx
import React, { useCallback, useEffect, useLayoutEffect, useState, lazy, Suspense } from "react";
import { Routes, Route, useLocation, useParams, useNavigate, Navigate } from "react-router-dom";
import { supabase } from "./supabaseClient";

import { AppProvider } from "./context/AppContext";
import { PurchaseProvider } from "./context/PurchaseContext";
import { ToastProvider } from "./components/ToastProvider";
import { ProfileGateProvider } from "./context/ProfileGateContext";
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
import ProgressPhotos from "./pages/ProgressPhotos";
import FriendsPage from "./pages/FriendsPage";
import ChatPage from "./pages/ChatPage";
import EnableNotifications from "./pages/EnableNotifications";
import StrengthCalculator from "./pages/StrengthCalculator";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import Support from "./pages/Support";
import FriendProfile from "./pages/FriendProfile";
import CreditsPage from "./pages/CreditsPage";
import RedeemPage from "./pages/RedeemPage";
import ReferralsPage from "./pages/ReferralsPage";

import Analytics from "./pages/Analytics";
import MeasurementAnalytics from "./pages/MeasurementAnalytics";

import ProgramMarketplace from "./features/programs/ProgramMarketplace";
import ProgramPreview from "./features/programs/ProgramPreview";
import ProgramViewer from "./features/programs/ProgramViewer";
import MyPrograms from "./features/programs/MyPrograms";
import CreateProgram from "./features/programs/CreateProgram";
import ProgramsErrorBoundary from "./features/programs/ProgramsErrorBoundary";

import GamesHub from "./features/games/GamesHub";
import GamePage from "./features/games/GamePage";
import SessionPage from "./features/games/SessionPage";
import Leaderboard from "./features/games/Leaderboard";
import ArcadeProfile from "./features/games/ArcadeProfile";
import ArenaPage from "./minigames/arena/ArenaPage";
import ArenaSelect from "./features/games/ArenaSelect";
import ArenaTrainer from "./features/games/ArenaTrainer";
import NutritionPage from "./features/nutrition/NutritionPage";

import BottomNav from "./components/BottomNav/BottomNav";
import ShareWorkoutsModal from "./components/workouts/ShareWorkoutsModal";
import { FaShare } from "react-icons/fa";
import NotificationsBell from "./components/notifications/NotificationsBell";

import usePresence from "./hooks/usePresence";
import useNotifications from "./hooks/useNotifications";
import useInAppBannerNotifications from "./hooks/useInAppBannerNotifications";
import InAppBanner from "./components/notifications/InAppBanner";
import { useTheme } from "./context/ThemeContext";
import {
  isPasswordResetStandalone,
  isResetPasswordRoute,
  logResetAuthState,
  markPasswordRecoveryFlow,
  passwordRecoveryNeedsCanonicalResetPath,
  recoveryTokensPresentInUrl,
} from "./utils/recoveryUrl";
import { getReminderSettings } from "./services/localReminders";
import {
  bootstrapNativeLocalNotifications,
  checkPermissions,
  isNativeNotificationsSupported,
  requestPermissions,
} from "./services/nativeLocalNotifications";

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

function AuthenticatedLayout({ session }) {
  const [notifQueue, setNotifQueue] = useState([]);
  const location = useLocation();
  const navigate = useNavigate();
  const { setTheme, setAccent } = useTheme();
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [onboardingLoaded, setOnboardingLoaded] = useState(false);

  const matchChat = location.pathname.match(/^\/chat\/([^/]+)/);
  const currentChatFriendId = matchChat?.[1] ?? null;

  const isSuppressedFn = useCallback(
    (notif) => {
      if (!currentChatFriendId) return false;
      if (notif.raw?.sender_id === currentChatFriendId) return true;
      if (notif.link && notif.link.includes(currentChatFriendId)) return true;
      return false;
    },
    [currentChatFriendId]
  );

  useInAppBannerNotifications(session?.user?.id, isSuppressedFn, setNotifQueue);

  // If the user already turned on local reminders, repair permission after login (native only).
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid || !isNativeNotificationsSupported()) return;
    let cancelled = false;
    void (async () => {
      try {
        const settings = getReminderSettings(uid);
        if (!settings.enabled) return;
        const p = await checkPermissions();
        if (cancelled) return;
        if (p.granted || p.display === "denied" || p.display === "unsupported") return;
        console.log(
          "[ArmPal.NativeLocalNotifications]",
          "reminders enabled in preferences but OS permission not granted; requesting"
        );
        await requestPermissions();
      } catch (e) {
        console.warn(
          "[ArmPal.NativeLocalNotifications]",
          "post-login permission repair failed:",
          e?.message
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  // Load per-account theme from profiles; default to dark + red if missing.
  useEffect(() => {
    let cancelled = false;

    async function loadThemeForUser() {
      const userId = session?.user?.id;
      if (!userId) {
        setTheme("dark");
        setAccent("red");
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("theme_mode, theme_accent")
          .eq("id", userId)
          .single();

        if (cancelled) return;
        if (error && error.code !== "PGRST116") {
          // Unexpected error — fall back to defaults
          setTheme("dark");
          setAccent("red");
          return;
        }

        let mode = data?.theme_mode || "dark";
        let accent = data?.theme_accent || "red";

        setTheme(mode);
        setAccent(accent);

        // If profile had no theme yet, persist the defaults for this account.
        if (!data?.theme_mode || !data?.theme_accent) {
          await supabase
            .from("profiles")
            .update({ theme_mode: mode, theme_accent: accent })
            .eq("id", userId);
        }
      } catch {
        // On failure, keep safe defaults for this session.
        if (!cancelled) {
          setTheme("dark");
          setAccent("red");
        }
      }
    }

    loadThemeForUser();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, setTheme, setAccent]);

  // Load onboarding completion state once per authenticated user
  useEffect(() => {
    if (!session?.user?.id) {
      setOnboardingCompleted(false);
      setOnboardingLoaded(true);
      return;
    }

    let cancelled = false;
    setOnboardingLoaded(false);

    async function loadOnboardingState() {
      try {
        const user = session.user;
        const completedFromMeta = !!user.user_metadata?.onboarding_completed;

        let completedFromProfile = false;
        if (!completedFromMeta) {
          const { data, error } = await supabase
            .from("profiles")
            .select("onboarding_completed")
            .eq("id", user.id)
            .maybeSingle();
          if (!error && data?.onboarding_completed === true) {
            completedFromProfile = true;
          }
        }

        if (cancelled) return;

        const completed = completedFromMeta || completedFromProfile;
        setOnboardingCompleted(completed);

        if (completed && typeof window !== "undefined") {
          const needsProfileFlag =
            sessionStorage.getItem("armpal_needs_profile_setup") === "1";
          if (needsProfileFlag) {
            sessionStorage.removeItem("armpal_needs_profile_setup");
          }
        }
      } catch {
        if (cancelled) return;
        // On failure, err on the side of not blocking navigation by profile redirects.
        setOnboardingCompleted(false);
      } finally {
        if (!cancelled) {
          setOnboardingLoaded(true);
        }
      }
    }

    loadOnboardingState();

    return () => {
      cancelled = true;
    };
  }, [session?.user]);

  // New-signup only: redirect to Profile once so they can set handle + display name,
  // but never before onboardingLoaded is true, and never after onboardingCompleted.
  useEffect(() => {
    if (!session?.user?.id || typeof window === "undefined") return;
    if (!onboardingLoaded) return;
    if (onboardingCompleted) return;
    if (recoveryTokensPresentInUrl()) return;

    const needsProfileFlag =
      sessionStorage.getItem("armpal_needs_profile_setup") === "1";

    if (needsProfileFlag && location.pathname !== "/profile") {
      if (isPasswordResetStandalone() || isResetPasswordRoute()) {
        console.log("[RESET FLOW] blocked redirect to /profile during reset", {
          pathname: window.location.pathname,
          href: window.location.href,
        });
        return;
      }
      navigate("/profile", { replace: true });
    }
  }, [session?.user?.id, onboardingLoaded, onboardingCompleted, location.pathname, navigate]);

  const handleBannerDismiss = (id) => {
    setNotifQueue((prev) => prev.filter((n) => n.id !== id));
  };

  const handleBannerClick = (item) => {
    handleBannerDismiss(item.id);
    const link = (item.link || "").trim();
    if (link && link !== "/friends") {
      navigate(link);
      return;
    }
    if (
      (item.title === "New Message" || item.title === "New message") &&
      item.raw?.sender_id
    ) {
      navigate(`/chat/${item.raw.sender_id}`);
      return;
    }
    navigate(link || "/friends");
  };

  const isNewUser =
    typeof window !== "undefined" &&
    sessionStorage.getItem("armpal_needs_profile_setup") === "1";

  return (
    <>
      <InAppBanner
        items={notifQueue}
        onDismiss={handleBannerDismiss}
        onClick={handleBannerClick}
      />
      <AppContent />
    </>
  );
}

const NEW_USER_PROFILE_FLAG = "armpal_needs_profile_setup";

function AppContent() {
  const location = useLocation();
  const isChatRoute = location.pathname.startsWith("/chat");
  const isWorkouts = location.pathname === "/workouts";
  const [openShare, setOpenShare] = useState(false);
  const [mounted, setMounted] = useState(false);

  const hideNavForNewUserOnProfile =
    location.pathname === "/profile" &&
    typeof window !== "undefined" &&
    sessionStorage.getItem(NEW_USER_PROFILE_FLAG) === "1";

  useEffect(() => {
    // Mark when React tree is mounted; ThemeProvider handles DOM theme attributes.
    setMounted(true);
  }, []);

  return (
    <div
      className="app-shell"
    >
      <div
        className={
          isChatRoute || hideNavForNewUserOnProfile
            ? "app-main-scroll app-main-scroll--no-nav"
            : "app-main-scroll"
        }
      >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/signup" element={<Navigate to="/" replace />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/prs" element={<PRTracker />} />
          <Route path="/measure" element={<MeasurementsPage />} />
          {/* Backwards-compat alias so old links never 404. */}
          <Route path="/measurements" element={<Navigate to="/measure" replace />} />
          {/* Weekly Check-In feature removed from user-facing UI; old links
              are redirected so any saved bookmark stays safe. The page file
              remains on disk so backend logic / data are untouched. */}
          <Route path="/check-in" element={<Navigate to="/" replace />} />
          <Route path="/progress-photos" element={<ProgressPhotos />} />
          <Route path="/workouts" element={<WorkoutsPage />} />
          <Route path="/workoutlogger" element={<WorkoutLogger />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/strength" element={<StrengthCalculator />} />
          <Route path="/friends" element={<FriendsPage />} />
          {/* Discovery / Find Friends temporarily disabled — redirect to Friends */}
          <Route path="/find-friends" element={<Navigate to="/friends" replace />} />
          <Route path="/find-friends/setup" element={<Navigate to="/friends" replace />} />
          {/* Groups temporarily disabled — redirect to Friends */}
          <Route path="/groups" element={<Navigate to="/friends" replace />} />
          <Route path="/messages" element={<FriendsPage />} />
          <Route path="/chat" element={<Navigate to="/friends" replace />} />

          <Route path="/u/:handle" element={<LegacyHandleRedirect />} />
          <Route path="/friend/:friendId" element={<FriendProfile />} />
          <Route path="/chat/group/:groupId" element={<ChatPage />} />
          <Route path="/chat/:friendId" element={<ChatPage />} />
          <Route path="/enable-notifications" element={<EnableNotifications />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/support" element={<Support />} />
          {/* Credits / Referral system temporarily disabled for MVP App Store release */}
          <Route path="/credits" element={<Navigate to="/" replace />} />
          <Route path="/redeem" element={<Navigate to="/" replace />} />
          <Route path="/referrals" element={<Navigate to="/" replace />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/analytics/measurements" element={<MeasurementAnalytics />} />
          {/* Subscription / upgrade screen hidden for App Store launch — backend logic preserved. */}
          <Route path="/pro" element={<Navigate to="/" replace />} />
          {/* Programs temporarily hidden for App Store launch */}
          {/* <Route path="/programs" element={<ProgramsErrorBoundary><ProgramMarketplace /></ProgramsErrorBoundary>} /> */}
          {/* <Route path="/programs/create" element={<ProgramsErrorBoundary><CreateProgram /></ProgramsErrorBoundary>} /> */}
          {/* <Route path="/programs/my" element={<ProgramsErrorBoundary><MyPrograms /></ProgramsErrorBoundary>} /> */}
          {/* <Route path="/programs/:id" element={<ProgramsErrorBoundary><ProgramPreview /></ProgramsErrorBoundary>} /> */}
          {/* <Route path="/programs/:id/view" element={<ProgramsErrorBoundary><ProgramViewer /></ProgramsErrorBoundary>} /> */}
          <Route path="/games" element={<GamesHub />} />
          <Route path="/games/arena-select" element={<ArenaSelect />} />
          <Route path="/games/arena-trainer" element={<ArenaTrainer />} />
          <Route path="/minigames/arena" element={<ArenaPage />} />
          <Route path="/nutrition" element={<NutritionPage />} />
          <Route path="/games/arcade" element={<ArcadeProfile />} />
          <Route path="/games/leaderboard" element={<Leaderboard />} />
          <Route path="/games/session/:sessionId" element={<SessionPage />} />
          <Route path="/games/:id" element={<GamePage />} />
        </Routes>
      </div>

      {location.pathname === "/" && <NotificationsBell />}
      {!isChatRoute && !hideNavForNewUserOnProfile && <BottomNav />}

      {isWorkouts && (
        <button
          onClick={() => setOpenShare(true)}
          style={{
            position: "fixed",
            top: "calc(var(--safe-area-top) + 14px)",
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
  const location = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const { setTheme, setAccent } = useTheme();
  const onPublicReset = isResetPasswordRoute();

  useLayoutEffect(() => {
    if (typeof window !== "undefined" && window.location.pathname.endsWith("reset-password.html")) {
      return;
    }
    if (typeof window !== "undefined" && window.location.pathname === "/reset-password") {
      return;
    }
    if (typeof window === "undefined") return;
    if (!passwordRecoveryNeedsCanonicalResetPath()) return;
    console.log("[RESET FLOW]", "recovery link detected");
    const suffix = `${window.location.search || ""}${window.location.hash || ""}`;
    window.location.replace(`${window.location.origin}/reset-password.html${suffix}`);
  }, []);

  usePresence(onPublicReset ? null : session?.user);
  useNotifications(onPublicReset ? undefined : session?.user?.id);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setReady(true);
      setTimeout(() => setShowSplash(false), 1200);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      logResetAuthState(event);

      const isResetPwRoute =
        typeof window !== "undefined" &&
        (window.location.pathname.endsWith("reset-password.html") ||
          window.location.pathname === "/reset-password" ||
          window.location.pathname.startsWith("/reset-password/") ||
          window.location.href.includes("type=recovery") ||
          window.location.href.includes("type%3Drecovery") ||
          recoveryTokensPresentInUrl());

      if (isResetPwRoute && event === "SIGNED_IN") {
        console.log("[RESET FLOW] skipping normal auth redirect");
      }

      if (event === "PASSWORD_RECOVERY" && s && typeof window !== "undefined") {
        markPasswordRecoveryFlow();
        if (!window.location.pathname.endsWith("reset-password.html")) {
          const suffix = `${window.location.search || ""}${window.location.hash || ""}`;
          window.location.replace(`${window.location.origin}/reset-password.html${suffix}`);
        }
      } else if (event === "SIGNED_IN" && s && typeof window !== "undefined" && recoveryTokensPresentInUrl()) {
        markPasswordRecoveryFlow();
        if (!window.location.pathname.endsWith("reset-password.html")) {
          const suffix = `${window.location.search || ""}${window.location.hash || ""}`;
          window.location.replace(`${window.location.origin}/reset-password.html${suffix}`);
        }
      }
      setSession(s);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    void bootstrapNativeLocalNotifications();
  }, []);

  // Logged-out theme defaults — skip during any recovery flow / URL tokens.
  useEffect(() => {
    if (isResetPasswordRoute()) return;
    if (!session) {
      setTheme("dark");
      setAccent("red");
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("armpal_mode", "dark");
        localStorage.setItem("armpal_theme", "red");
      }
    }
  }, [session, setTheme, setAccent]);

  return (
    <>
      <RuntimeSplash show={showSplash && !onPublicReset} />
      {!ready && !onPublicReset ? null : onPublicReset ? (
        <div
          style={{
            minHeight: "100dvh",
            background: "#000",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <p style={{ margin: 0 }}>Opening password reset…</p>
        </div>
      ) : !session ? (
        <Routes>
          <Route
            path="*"
            element={
              <AuthPage
                initialMode={location?.pathname === "/signup" ? "signup" : undefined}
              />
            }
          />
        </Routes>
      ) : (
        <AppProvider>
          <PurchaseProvider>
            <ToastProvider>
              <ProfileGateProvider>
                <AuthenticatedLayout session={session} />
              </ProfileGateProvider>
            </ToastProvider>
          </PurchaseProvider>
        </AppProvider>
      )}
    </>
  );
}
