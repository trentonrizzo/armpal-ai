import { Capacitor } from "@capacitor/core";

/**
 * True when running inside the Capacitor native shell (e.g. ArmPal iOS app).
 */
export function isNativeArmPalApp() {
  try {
    return Capacitor.isNativePlatform() === true;
  } catch {
    return false;
  }
}

/**
 * True for Safari, Chrome, installed PWA, etc. — any non-native web host.
 */
export function isWebBrowserEnvironment() {
  return !isNativeArmPalApp();
}

/**
 * Safari (including iOS Safari) — useful for diagnostics; browser-mode banner uses isWebBrowserEnvironment.
 */
export function isSafariBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|Edg\//i.test(ua);
}

/**
 * Show progress-photo reliability notice (local IndexedDB is less dependable on web).
 */
export function shouldShowProgressPhotosBrowserNotice() {
  return isWebBrowserEnvironment();
}
