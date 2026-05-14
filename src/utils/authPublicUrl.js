/**
 * Canonical public URL for Supabase password recovery redirectTo.
 * Standalone static page (not the React SPA) so Safari / PWA session cannot hijack the flow.
 *
 * Supabase Dashboard → Authentication → URL Configuration → Redirect URLs (add both):
 * https://www.armpal.net/reset-password.html
 * https://armpal.net/reset-password.html
 */
export const PASSWORD_RESET_REDIRECT_TO = "https://www.armpal.net/reset-password.html";

const ARM_PAL_PRODUCTION_ORIGIN = "https://www.armpal.net";

function stripTrailingSlash(s) {
  return String(s || "").replace(/\/+$/, "");
}

/**
 * @returns {string} Origin only, e.g. https://www.armpal.net — no path, no trailing slash.
 */
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

/**
 * Full redirect URL passed to `resetPasswordForEmail({ redirectTo })`.
 * Always the production reset page (never Capacitor / localhost / preview origins).
 */
export function getPasswordResetRedirectUrl() {
  return PASSWORD_RESET_REDIRECT_TO;
}
