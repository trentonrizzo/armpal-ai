import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
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

  const [phase, setPhase] = useState(() => {
    if (typeof window === "undefined") return ONBOARDING_PHASE_SETUP;
    const complete = window.localStorage.getItem(STORAGE_COMPLETE) === "true";
    if (complete) return "complete";
    return (
      window.localStorage.getItem(STORAGE_PHASE) || ONBOARDING_PHASE_SETUP
    );
  });

  const [stepIndex, setStepIndex] = useState(() => {
    if (typeof window === "undefined") return 0;
    const stored = window.localStorage.getItem(STORAGE_STEP);
    const parsed = stored != null ? parseInt(stored, 10) : 0;
    return Number.isNaN(parsed) ? 0 : parsed;
  });

  const currentStep = ONBOARDING_STEPS[stepIndex] || null;

  const isComplete = phase === "complete";

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isComplete) {
      window.localStorage.setItem(STORAGE_COMPLETE, "true");
    } else {
      window.localStorage.setItem(STORAGE_PHASE, phase);
      window.localStorage.setItem(STORAGE_STEP, String(stepIndex));
    }
  }, [phase, stepIndex, isComplete]);

  useEffect(() => {
    if (!currentStep || isComplete) return;
    if (location.pathname !== currentStep.route) {
      navigate(currentStep.route, { replace: true });
    }
  }, [currentStep, isComplete, location.pathname, navigate]);

  const goToNext = useCallback(
    (opts = {}) => {
      if (!currentStep) return;
      const idx = ONBOARDING_STEPS.findIndex((s) => s.id === currentStep.id);
      const next = ONBOARDING_STEPS[idx + 1];
      if (!next) {
        setPhase("complete");
        return;
      }
      if (next.phase === ONBOARDING_PHASE_TOUR) {
        setPhase(ONBOARDING_PHASE_TOUR);
      }
      if (opts.resetTour) {
        const firstTourIndex = ONBOARDING_STEPS.findIndex(
          (s) => s.phase === ONBOARDING_PHASE_TOUR
        );
        setStepIndex(firstTourIndex >= 0 ? firstTourIndex : idx + 1);
      } else {
        setStepIndex(idx + 1);
      }
    },
    [currentStep]
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

  useEffect(() => {
    if (!currentStep || isComplete) return;
    if (currentStep.trigger?.type === "display_name_valid") {
      const selector = currentStep.target;
      if (!selector) return;
      const handleInput = (e) => {
        if (!(e.target instanceof HTMLInputElement)) return;
        if (!e.target.matches(selector)) return;
        if (e.target.value.trim().length >= currentStep.trigger.minLength) {
          goToNext();
        }
      };
      window.addEventListener("input", handleInput, true);
      return () => window.removeEventListener("input", handleInput, true);
    }
  }, [currentStep, goToNext, isComplete]);

  useEffect(() => {
    if (!currentStep || isComplete) return;
    if (currentStep.trigger?.type === "handle_valid") {
      const selector = currentStep.target;
      if (!selector) return;
      const handleInput = (e) => {
        if (!(e.target instanceof HTMLInputElement)) return;
        if (!e.target.matches(selector)) return;
        const value = e.target.value.trim();
        const valid = /^[a-z0-9_]{3,}$/.test(value);
        if (valid) {
          goToNext();
        }
      };
      window.addEventListener("input", handleInput, true);
      return () => window.removeEventListener("input", handleInput, true);
    }
  }, [currentStep, goToNext, isComplete]);

  useEffect(() => {
    if (!currentStep || isComplete) return;
    if (currentStep.trigger?.type === "event" && currentStep.trigger.name) {
      const handler = () => {
        goToNext({ resetTour: true });
      };
      window.addEventListener(currentStep.trigger.name, handler);
      return () =>
        window.removeEventListener(currentStep.trigger.name, handler);
    }
  }, [currentStep, goToNext, isComplete]);

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
    if (!currentStep) return;
    if (currentStep.id === "welcome") {
      goToNext();
      return;
    }
    if (currentStep.id === "profile_bio") {
      goToNext();
      return;
    }
    if (currentStep.id === "profile_success") {
      goToNext({ resetTour: true });
      return;
    }
    if (currentStep.id === "tour_complete") {
      finishOnboarding();
      return;
    }
    goToNext();
  }, [currentStep, finishOnboarding, goToNext]);

  const handleSecondary = useCallback(() => {
    if (!currentStep) return;
    if (currentStep.id === "profile_bio") {
      goToNext();
      return;
    }
    if (currentStep.phase === ONBOARDING_PHASE_TOUR) {
      skipTour();
      return;
    }
  }, [currentStep, goToNext, skipTour]);

  const value = useMemo(
    () => ({
      phase,
      stepIndex,
      currentStep,
      isComplete,
      goToNext,
      skipTour,
      finishOnboarding,
    }),
    [phase, stepIndex, currentStep, isComplete, goToNext, skipTour, finishOnboarding]
  );

  const active = !isComplete && !!currentStep;

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

