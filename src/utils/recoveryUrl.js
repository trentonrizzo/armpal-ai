/**
 * Recovery URL / flow detection so password reset is never treated as a normal login.
 */

const RECOVERY_FLOW_SESSION_KEY = "armpal_password_recovery_flow";

/**
 * Standalone static reset page or recovery tokens in URL (use before ANY /profile redirect).
 */
export function isPasswordResetStandalone() {
  if (typeof window === "undefined") return false;
  const pathname = window.location.pathname || "";
  const href = window.location.href || "";
  if (pathname === "/reset-password.html" || pathname.endsWith("/reset-password.html")) return true;
  if (href.includes("/reset-password.html")) return true;
  if (href.includes("type=recovery") || href.includes("type%3Drecovery")) return true;
  return false;
}

/**
 * True when the current URL likely carries Supabase auth / password-recovery tokens.
 */
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

/** Recovery tokens present but path is not yet the dedicated static reset file. */
export function passwordRecoveryNeedsCanonicalResetPath() {
  if (typeof window === "undefined") return false;
  const p = window.location.pathname || "";
  if (p === "/reset-password.html" || p.endsWith("/reset-password.html")) return false;
  if (p === "/reset-password" || p.startsWith("/reset-password/")) return false;
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
 * Public reset route, static reset HTML, recovery query/hash, or in-flight recovery session.
 * Use this before any auth / onboarding / profile redirect.
 */
export function isResetPasswordRoute() {
  if (typeof window === "undefined") return false;
  if (isPasswordResetStandalone()) return true;
  const pathname = window.location.pathname || "";
  if (pathname === "/reset-password" || pathname.startsWith("/reset-password/")) return true;
  const href = window.location.href || "";
  if (href.includes("type=recovery") || href.includes("type%3Drecovery")) return true;
  try {
    const sp = new URLSearchParams((window.location.search || "").replace(/^\?/, ""));
    if (sp.has("code")) {
      if (
        pathname.endsWith("reset-password.html") ||
        pathname === "/reset-password" ||
        pathname === "/" ||
        pathname === "/login"
      ) {
        return true;
      }
    }
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

/**
 * @deprecated Prefer {@link isResetPasswordRoute} — kept for existing imports.
 */
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
