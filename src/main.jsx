import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import RootRoutes from "./RootRoutes";
import "./index.css";

import "./services/purchaseManager";
import { registerPasswordRecoveryDeepLinkListener } from "./services/passwordRecoveryDeepLink";

import { ThemeProvider } from "./context/ThemeContext";
import { registerSW } from "virtual:pwa-register";

registerPasswordRecoveryDeepLinkListener();

async function ejectStandaloneFromSpaShell() {
  if (typeof window === "undefined") return false;
  const p = window.location.pathname || "";
  if (!p.endsWith("password-reset-standalone.html")) return false;
  const spaShell =
    typeof document !== "undefined" &&
    document.querySelector('meta[name="ap-spa-shell"]')?.getAttribute("content") === "1";
  if (!spaShell) return false;
  if ("serviceWorker" in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch {
      /* ignore */
    }
  }
  if ("caches" in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {
      /* ignore */
    }
  }
  const u = new URL(window.location.href);
  u.searchParams.set("__ap_nc", String(Date.now()));
  window.location.replace(u.toString());
  return true;
}

async function boot() {
  if (await ejectStandaloneFromSpaShell()) return;

  registerSW({
    immediate: true,
    onNeedRefresh() {
      window.location.reload();
    },
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });
  }

  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <ThemeProvider>
        <BrowserRouter>
          <RootRoutes />
        </BrowserRouter>
      </ThemeProvider>
    </React.StrictMode>
  );
}

void boot();
