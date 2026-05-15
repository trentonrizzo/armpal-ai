/**
 * Password recovery redirect targets for Supabase `redirectTo`.
 *
 * Supabase Dashboard → Authentication → URL Configuration → Redirect URLs (examples):
 * https://www.armpal.net/reset-password
 * https://armpal.net/reset-password
 * (and any preview origins you use during development)
 */

const ARM_PAL_PRODUCTION_ORIGIN = "https://www.armpal.net";

function stripTrailingSlash(s) {
  return String(s || "").replace(/\/+$/, "");
}

export function getPublicSiteOrigin() {
  try {
    const raw =
      typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_PUBLIC_SITE_URL
        ? String(import.meta.env.VITE_PUBLIC_SITE_URL).trim()
        : "";
    if (raw) {
      if (/^https?:\/\//i.test(raw)) {
        const u = new URL(raw);
        return stripTrailingSlash(`${u.protocol}//${u.host}`);
      }
      return stripTrailingSlash(`https://${raw.replace(/^\/+/, "")}`);
    }
  } catch {
    /* ignore */
  }

  if (typeof window !== "undefined" && window.location && /^https?:\/\//i.test(window.location.origin || "")) {
    return stripTrailingSlash(window.location.origin);
  }

  return stripTrailingSlash(ARM_PAL_PRODUCTION_ORIGIN);
}

/** Full URL for Supabase reset emails — prefers current origin in the browser. */
export function getPasswordResetRedirectUrl() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${stripTrailingSlash(window.location.origin)}/reset-password`;
  }
  return `${getPublicSiteOrigin()}/reset-password`;
}

/** Production default for server-side email helpers (no `window`). */
export const PASSWORD_RESET_REDIRECT_TO = `${ARM_PAL_PRODUCTION_ORIGIN}/reset-password`;
