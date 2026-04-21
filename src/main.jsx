import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// Boot Apple IAP as early as possible on native iOS (no-op on web).
// Registers "armpal_pro" and loads price before the paywall is opened.
import "./services/purchaseManager";

// 🔥 THEME PROVIDER (GLOBAL)
import { ThemeProvider } from "./context/ThemeContext";
import OnboardingProvider from "./onboarding/OnboardingProvider";

// ======================================================
// ✅ SERVICE WORKER — IOS SAFE UPDATE HANDLING (KEEP)
// ======================================================
import { registerSW } from "virtual:pwa-register";

registerSW({
  immediate: true,
  onNeedRefresh() {
    window.location.reload();
  },
});

// 🔥 Prevent iOS white screen on SW swap
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });
}

// ======================================================
// ✅ REACT BOOTSTRAP (THEME WRAPPED)
// ======================================================
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <OnboardingProvider>
          <App />
        </OnboardingProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
