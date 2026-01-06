import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// ======================================================
// ✅ SERVICE WORKER — IOS SAFE UPDATE HANDLING
// ======================================================
import { registerSW } from "virtual:pwa-register";

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // force reload when a new SW takes control
    window.location.reload();
  },
  onOfflineReady() {
    // optional: offline ready hook
  },
});

// 🔥 CRITICAL: prevent iOS white screen on SW swap
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  });
}

// ======================================================
// ✅ RUNTIME SPLASH (IOS / PWA SAFE)
// ======================================================
function runtimeSplash() {
  // show once per app resume
  if (sessionStorage.getItem("AP_RUNTIME_SPLASH")) return;
  sessionStorage.setItem("AP_RUNTIME_SPLASH", "1");

  const splash = document.createElement("div");
  splash.style.position = "fixed";
  splash.style.inset = "0";
  splash.style.zIndex = "9999999";
  splash.style.background = "#000";
  splash.style.display = "grid";
  splash.style.placeItems = "center";

  const img = document.createElement("img");
  img.src = "/pwa-512x512.png";
  img.style.width = "220px";
  img.style.opacity = "0";
  img.style.transform = "scale(0.9)";
  img.style.transition = "all 600ms ease";

  splash.appendChild(img);
  document.body.appendChild(splash);

  requestAnimationFrame(() => {
    img.style.opacity = "1";
    img.style.transform = "scale(1)";
  });

  // subtle metal thunk (safe on iOS)
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume().then(() => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = 360;
      g.gain.value = 0.25;
      o.connect(g).connect(ctx.destination);
      o.start();
      setTimeout(() => {
        o.stop();
        ctx.close();
      }, 180);
    });
  } catch {}

  setTimeout(() => {
    splash.style.transition = "opacity 250ms";
    splash.style.opacity = "0";
    setTimeout(() => splash.remove(), 260);
  }, 1200);
}

// show on initial load
runtimeSplash();

// show again when app resumes
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    sessionStorage.removeItem("AP_RUNTIME_SPLASH");
    runtimeSplash();
  }
});

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
