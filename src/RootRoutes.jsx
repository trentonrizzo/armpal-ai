import React, { useEffect, useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import OnboardingProvider from "./onboarding/OnboardingProvider";
import App from "./App";
import {
  isResetPasswordRoute,
  logResetAuthState,
  markPasswordRecoveryFlow,
  passwordRecoveryNeedsCanonicalResetPath,
  recoveryTokensPresentInUrl,
} from "./utils/recoveryUrl";

/**
 * Recovery always hard-navigates to the standalone /reset-password.html document
 * (never mount React reset or app shell for that flow).
 */
export default function RootRoutes() {
  const location = useLocation();

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (recoveryTokensPresentInUrl() || window.location.href.includes("type=recovery")) {
      markPasswordRecoveryFlow();
    }

    const p = window.location.pathname || "";
    const suffix = `${window.location.search || ""}${window.location.hash || ""}`;
    const dest = `${window.location.origin}/reset-password.html${suffix}`;

    // PWA served index.html for /reset-password.html — same path, wrong document (SPA shell meta).
    const spaShell =
      typeof document !== "undefined" &&
      document.querySelector('meta[name="ap-spa-shell"]')?.getAttribute("content") === "1";
    if (p.endsWith("reset-password.html") && spaShell) {
      const u = new URL(window.location.href);
      u.searchParams.set("__ap_nc", String(Date.now()));
      window.location.replace(u.toString());
      return;
    }

    if (!passwordRecoveryNeedsCanonicalResetPath()) return;
    logResetAuthState("ROOT_CANONICALIZE_RECOVERY_URL");
    window.location.replace(dest);
  }, []);

  useEffect(() => {
    logResetAuthState("ROOT_RENDER");
  }, [location.pathname, location.search, location.hash]);

  const showResetLoadingBridge =
    typeof window !== "undefined" &&
    isResetPasswordRoute() &&
    !window.location.pathname.endsWith("reset-password.html");

  if (showResetLoadingBridge) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: "#000",
          color: "#fff",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          padding: 24,
          textAlign: "center",
        }}
      >
        <p style={{ margin: 0, fontSize: 16 }}>Opening password reset…</p>
      </div>
    );
  }

  return (
    <OnboardingProvider>
      <App />
    </OnboardingProvider>
  );
}
