import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

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
// ❌ REMOVE RUNTIME SPLASH COMPLETELY
// (Handled ONLY by index.html now)
// ======================================================

// ======================================================
// ✅ REACT BOOTSTRAP
// ======================================================
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
