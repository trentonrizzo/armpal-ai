import React from "react";
import OnboardingProvider from "./onboarding/OnboardingProvider";
import App from "./App";

/**
 * Password recovery is handled only by public/password-reset-standalone.html
 * (hard navigation from main.jsx before the SPA boots). No React reset routes here.
 */
export default function RootRoutes() {
  return (
    <OnboardingProvider>
      <App />
    </OnboardingProvider>
  );
}
