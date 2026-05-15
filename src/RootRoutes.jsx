import React from "react";
import OnboardingProvider from "./onboarding/OnboardingProvider";
import App from "./App";

/**
 * Root routes: onboarding wraps the main app. Password reset uses dedicated
 * React Router paths `/reset-password` and `/reset-password.html`.
 */
export default function RootRoutes() {
  return (
    <OnboardingProvider>
      <App />
    </OnboardingProvider>
  );
}
