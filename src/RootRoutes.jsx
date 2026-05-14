import React, { useEffect, useLayoutEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import OnboardingProvider from "./onboarding/OnboardingProvider";
import App from "./App";
import ResetPassword from "./pages/ResetPassword";
import {
  isResetPasswordRoute,
  logResetAuthState,
  markPasswordRecoveryFlow,
  passwordRecoveryNeedsCanonicalResetPath,
  recoveryTokensPresentInUrl,
} from "./utils/recoveryUrl";

/**
 * First-line public reset: never mount onboarding or main app shell for recovery.
 */
export default function RootRoutes() {
  const location = useLocation();
  const navigate = useNavigate();

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (recoveryTokensPresentInUrl() || window.location.href.includes("type=recovery")) {
      markPasswordRecoveryFlow();
    }
    if (!passwordRecoveryNeedsCanonicalResetPath()) return;
    logResetAuthState("ROOT_CANONICALIZE_RECOVERY_URL");
    const suffix = `${window.location.search || ""}${window.location.hash || ""}`;
    window.history.replaceState(null, "", `/reset-password${suffix}`);
    navigate(`/reset-password${suffix}`, { replace: true });
  }, [navigate]);

  useEffect(() => {
    logResetAuthState("ROOT_RENDER");
  }, [location.pathname, location.search, location.hash]);

  if (isResetPasswordRoute()) {
    const p = typeof window !== "undefined" ? window.location.pathname || "" : "";
    if (p === "/reset-password" || p.startsWith("/reset-password/")) {
      console.log("[RESET FLOW] reset route loaded");
    } else {
      console.log("[RESET FLOW] recovery detected");
    }
    return <ResetPassword />;
  }

  return (
    <OnboardingProvider>
      <App />
    </OnboardingProvider>
  );
}
