/**
 * Recovery detection: standalone static reset page + Supabase recovery tokens.
 * Use before ANY navigate("/profile") during password recovery.
 */

const RECOVERY_FLOW_SESSION_KEY = "armpal_password_recovery_flow";

/** Canonical path for the static password reset document (no React). */
export const PASSWORD_RESET_STANDALONE_PATH = "/password-reset-standalone.html";

/**
 * User is on (or URL targets) the standalone reset HTML, or recovery type is visible.
 */
export function isPasswordResetStandalone() {
  if (typeof window === "undefined") return false;
  const pathname = window.location.pathname || "";
  const href = window.location.href || "";
  if (pathname.endsWith("password-reset-standalone.html")) return true;
  if (href.includes("password-reset-standalone.html")) return true;
  if (href.includes("type=recovery") || href.includes("type%3Drecovery")) return true;
  return false;
}

/** PKCE-style recovery callback: exchangeCodeForSession needs the full URL. */
function recoveryPkceParamsPresent() {
  if (typeof window === "undefined") return false;
  try {
    const sp = new URLSearchParams((window.location.search || "").replace(/^\?/, ""));
    return sp.has("code") && sp.get("type") === "recovery";
  } catch {
    return false;
  }
}

export function recoveryTokensPresentInUrl() {
  if (typeof window === "undefined") return false;

  const hash = window.location.hash || "";
  const search = window.location.search || "";

  if (
    hash.includes("access_token") ||
    hash.includes("refresh_token") ||
    hash.includes("type=recovery") ||
    decodeURIComponent(hash).includes("type=recovery")
  ) {
    return true;
  }

  try {
    const hb = hash.startsWith("#") ? hash.slice(1) : hash;
    const hp = new URLSearchParams(hb);
    if (hp.get("type") === "recovery") return true;
    if (hp.has("access_token") || hp.has("refresh_token")) return true;
  } catch {
    /* ignore */
  }

  try {
    const sp = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    if (sp.get("type") === "recovery") return true;
    if (sp.has("access_token") || sp.has("refresh_token")) return true;
  } catch {
    /* ignore */
  }

  return false;
}

/** Recovery tokens in URL but not yet on the dedicated standalone reset file. */
export function passwordRecoveryNeedsCanonicalResetPath() {
  if (typeof window === "undefined") return false;
  const p = window.location.pathname || "";
  if (p.endsWith("password-reset-standalone.html")) return false;
  if (recoveryPkceParamsPresent()) return true;
  return recoveryTokensPresentInUrl();
}

export function markPasswordRecoveryFlow() {
  try {
    window.sessionStorage?.setItem(RECOVERY_FLOW_SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearPasswordRecoveryFlow() {
  try {
    window.sessionStorage?.removeItem(RECOVERY_FLOW_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * True during any password-recovery context (standalone file, tokens in URL,
 * legacy reset paths, or marked recovery session). Blocks /profile redirects in SPA.
 */
export function isResetPasswordRoute() {
  if (typeof window === "undefined") return false;
  if (isPasswordResetStandalone()) return true;
  const pathname = window.location.pathname || "";
  if (pathname === "/reset-password" || pathname.startsWith("/reset-password/")) return true;
  if (pathname.endsWith("reset-password.html")) return true;
  const href = window.location.href || "";
  if (href.includes("type=recovery") || href.includes("type%3Drecovery")) return true;
  try {
    const sp = new URLSearchParams((window.location.search || "").replace(/^\?/, ""));
    if (sp.has("code") && sp.get("type") === "recovery") return true;
  } catch {
    /* ignore */
  }
  if (recoveryTokensPresentInUrl()) return true;
  try {
    if (window.sessionStorage?.getItem(RECOVERY_FLOW_SESSION_KEY) === "1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function isRecoveryFlow() {
  return isResetPasswordRoute();
}

export function logResetAuthState(event) {
  if (typeof window === "undefined") return;
  console.log("[RESET FLOW]", {
    event,
    pathname: window.location.pathname,
    href: window.location.href,
    isResetPasswordRoute: isResetPasswordRoute(),
  });
}
