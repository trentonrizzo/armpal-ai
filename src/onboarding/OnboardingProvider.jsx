import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import SpotlightOverlay from "./SpotlightOverlay";
import {
  ONBOARDING_PHASE_SETUP,
  ONBOARDING_PHASE_TOUR,
  ONBOARDING_STEPS,
} from "./onboardingSteps";

const STORAGE_PHASE = "armpal_onboarding_phase";
const STORAGE_STEP = "armpal_onboarding_step";
const STORAGE_COMPLETE = "armpal_onboarding_complete";

const OnboardingContext = createContext(null);

export function useOnboarding() {
  return useContext(OnboardingContext);
}

export default function OnboardingProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [phase, setPhase] = useState(ONBOARDING_PHASE_SETUP);
  const [stepIndex, setStepIndex] = useState(0);

  // Derived from Supabase profile: true when display_name or handle is missing.
  const [profileNeedsOnboarding, setProfileNeedsOnboarding] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const currentStep = ONBOARDING_STEPS[stepIndex] || null;
  const [stepLocked, setStepLocked] = useState(false);
  const navLockedRef = useRef(false);
  const [tourStarted, setTourStarted] = useState(false);
  const routeRequestRef = useRef(null);
  const routeAdvanceRef = useRef(null);
  const [setupComplete, setSetupComplete] = useState(false);

  const isComplete = phase === "complete";

  // Load profile and decide if onboarding is required (display_name and handle missing).
  useEffect(() => {
    let cancelled = false;

    async function loadForUser(userId) {
      if (cancelled) return;

      if (!userId) {
        setProfileNeedsOnboarding(false);
        setProfileLoaded(true);
        setPhase("complete");
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("display_name, handle")
          .eq("id", userId)
          .maybeSingle();

        if (cancelled) return;

        if (error && error.code !== "PGRST116") {
          throw error;
        }

        const hasDisplayName =
          typeof profile?.display_name === "string" &&
          profile.display_name.trim().length >= 2;
        const hasHandle =
          typeof profile?.handle === "string" &&
          profile.handle.trim().length >= 3;

        const needs = !(hasDisplayName && hasHandle);

        setProfileNeedsOnboarding(needs);
        setProfileLoaded(true);

        if (!needs) {
          // Profile is complete: permanently disable onboarding regardless of localStorage.
          setPhase("complete");
          setTourStarted(false);
          setSetupComplete(true);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_COMPLETE, "true");
          }
        } else {
          // Profile incomplete: always start onboarding from the first step for this user.
          setPhase(ONBOARDING_PHASE_SETUP);
          setStepIndex(0);
          setSetupComplete(false);
          if (typeof window !== "undefined") {
            window.localStorage.removeItem(STORAGE_STEP);
            window.localStorage.setItem(STORAGE_PHASE, ONBOARDING_PHASE_SETUP);
          }
        }
      } catch {
        if (cancelled) return;
        // If profile fetch fails, err on the side of requiring onboarding.
        setProfileNeedsOnboarding(true);
        setProfileLoaded(true);
        setPhase(ONBOARDING_PHASE_SETUP);
        setStepIndex(0);
      }
    }

    // Initial load (handles page refresh / session restore).
    supabase.auth
      .getUser()
      .then(({ data }) => loadForUser(data?.user?.id || null));

    // React to login/logout.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      loadForUser(session?.user?.id || null);
    });

    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // Persist in-progress step/phase only while onboarding is needed.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!profileNeedsOnboarding || isComplete) return;
    window.localStorage.setItem(STORAGE_PHASE, phase);
    window.localStorage.setItem(STORAGE_STEP, String(stepIndex));
  }, [phase, stepIndex, profileNeedsOnboarding, isComplete]);

  // Force route for onboarding steps when active.
  useEffect(() => {
    if (!currentStep || isComplete) return;

    const targetRoute = currentStep.route;
    if (!targetRoute) {
      routeRequestRef.current = null;
      return;
    }

    if (location.pathname !== targetRoute) {
      if (routeRequestRef.current !== currentStep.id) {
        routeRequestRef.current = currentStep.id;
        navigate(targetRoute, { replace: true });
      }
      return;
    }

    // Route now matches the step; clear request marker.
    routeRequestRef.current = null;
  }, [currentStep, isComplete, location.pathname, navigate]);

  // Ensure incomplete profiles always land on /profile?onboarding=true.
  useEffect(() => {
    if (!profileLoaded || !profileNeedsOnboarding) return;
    // Do not force /profile?onboarding=true during the tour phase.
    if (phase === ONBOARDING_PHASE_TOUR) return;

    const isOnProfile = location.pathname === "/profile";
    const searchParams = new URLSearchParams(location.search || "");
    const hasFlag = searchParams.get("onboarding") === "true";

    if (!isOnProfile || !hasFlag) {
      navigate("/profile?onboarding=true", { replace: true });
    }
  }, [profileLoaded, profileNeedsOnboarding, location.pathname, location.search, navigate]);

  const goToNext = useCallback(
    () => {
      if (!currentStep || stepLocked || navLockedRef.current) return;
      // Hard safety: never advance past profile_edit unless setupComplete is true.
      if (currentStep.id === "profile_edit" && !setupComplete) return;
      setStepLocked(true);
      navLockedRef.current = true;
      const idx = ONBOARDING_STEPS.findIndex((s) => s.id === currentStep.id);
      const next = ONBOARDING_STEPS[idx + 1];
      if (!next) {
        setPhase("complete");
        setTimeout(() => {
          setStepLocked(false);
          navLockedRef.current = false;
        }, 300);
        return;
      }
      if (next.phase === ONBOARDING_PHASE_TOUR) {
        setPhase(ONBOARDING_PHASE_TOUR);
      }
      setStepIndex(idx + 1);
      setTimeout(() => {
        setStepLocked(false);
        navLockedRef.current = false;
      }, 300);
    },
    [currentStep, stepLocked, setupComplete]
  );

  const skipTour = useCallback(() => {
    const completeIndex = ONBOARDING_STEPS.findIndex(
      (s) => s.id === "tour_complete"
    );
    if (completeIndex >= 0) {
      setPhase(ONBOARDING_PHASE_TOUR);
      setStepIndex(completeIndex);
    } else {
      setPhase("complete");
    }
  }, []);

  const finishOnboarding = useCallback(() => {
    setPhase("complete");
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_COMPLETE, "true");
    }
    navigate("/", { replace: true });
  }, [navigate]);

  // Generic event-triggered steps (excluding profile_edit which has a custom handler)
  useEffect(() => {
    if (!currentStep || isComplete) return;
    if (currentStep.id === "profile_edit") return;
    if (currentStep.trigger?.type !== "event" || !currentStep.trigger.name) {
      return;
    }

    const handler = () => {
      goToNext();
    };

    if (typeof window !== "undefined") {
      window.addEventListener(currentStep.trigger.name, handler, { once: true });
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(currentStep.trigger.name, handler);
      }
    };
  }, [currentStep, goToNext, isComplete]);

  // Specific handler for profile_edit → profile_saved transition
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleProfileSaved = () => {
      if (currentStep?.id !== "profile_edit") return;
      setSetupComplete(true);
      goToNext();
    };

    window.addEventListener(
      "ap_onboarding_profile_saved",
      handleProfileSaved,
      { once: true }
    );

    return () => {
      window.removeEventListener(
        "ap_onboarding_profile_saved",
        handleProfileSaved
      );
    };
  }, [currentStep, goToNext]);

  // Safety: never show profile_saved if setup is not actually complete.
  useEffect(() => {
    if (!currentStep) return;
    if (currentStep.id === "profile_saved" && !setupComplete) {
      const editIndex = ONBOARDING_STEPS.findIndex(
        (s) => s.id === "profile_edit"
      );
      if (editIndex !== -1) {
        setStepIndex(editIndex);
        setPhase(ONBOARDING_PHASE_SETUP);
      }
    }
  }, [currentStep, setupComplete]);

  // Route-based advancement for required navigation steps.
  useEffect(() => {
    if (!currentStep || isComplete) return;
    const advanceRoute = currentStep.advanceWhenRouteIs;
    if (!advanceRoute) return;

    if (location.pathname === advanceRoute) {
      if (routeAdvanceRef.current === currentStep.id) return;
      routeAdvanceRef.current = currentStep.id;
      goToNext();
    } else if (routeAdvanceRef.current === currentStep.id) {
      // User navigated away; allow a future advance if the step is shown again.
      routeAdvanceRef.current = null;
    }
  }, [currentStep, isComplete, location.pathname, goToNext]);

  const [targetRect, setTargetRect] = useState(null);

  useEffect(() => {
    if (!currentStep || !currentStep.target) {
      setTargetRect(null);
      return;
    }

    const updateRect = () => {
      const el =
        typeof document !== "undefined"
          ? document.querySelector(currentStep.target)
          : null;
      if (!el) {
        setTargetRect(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        radius: 16,
      });
    };

    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [currentStep, location.pathname]);

  const handlePrimary = useCallback(() => {
    if (!currentStep || stepLocked) return;
    if (currentStep.id === "tour_complete") {
      finishOnboarding();
      return;
    }
    if (currentStep.id === "profile_saved") {
      if (tourStarted || navLockedRef.current) return;
      setTourStarted(true);
      // Start tour: jump to first workouts step and navigate to /workouts.
      const firstTourIndex = ONBOARDING_STEPS.findIndex(
        (s) => s.id === "tour_workouts"
      );
      if (firstTourIndex !== -1) {
        setStepLocked(true);
        navLockedRef.current = true;
        setPhase(ONBOARDING_PHASE_TOUR);
        setStepIndex(firstTourIndex);
        navigate("/workouts", { replace: true });
        setTimeout(() => {
          setStepLocked(false);
          navLockedRef.current = false;
        }, 300);
      }
      return;
    }
    goToNext();
  }, [currentStep, finishOnboarding, goToNext, navigate, stepLocked, tourStarted]);

  const handleSecondary = useCallback(() => {
    if (!currentStep || stepLocked) return;
    if (currentStep.id === "tour_workouts") {
      skipTour();
    }
  }, [currentStep, skipTour, stepLocked]);

  const value = useMemo(
    () => ({
      phase,
      stepIndex,
      currentStep,
      isComplete,
      goToNext,
      skipTour,
      finishOnboarding,
      profileNeedsOnboarding,
      profileLoaded,
    }),
    [
      phase,
      stepIndex,
      currentStep,
      isComplete,
      goToNext,
      skipTour,
      finishOnboarding,
      profileNeedsOnboarding,
      profileLoaded,
    ]
  );

  const active =
    profileLoaded &&
    !isComplete &&
    !!currentStep &&
    (profileNeedsOnboarding || currentStep.phase === ONBOARDING_PHASE_TOUR);

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      <SpotlightOverlay
        active={active}
        step={currentStep}
        targetRect={targetRect}
        onPrimary={handlePrimary}
        onSecondary={handleSecondary}
      />
    </OnboardingContext.Provider>
  );
}

