/**
 * Canonical public https origin for Supabase auth redirects (password recovery, etc.).
 *
 * - In production / native builds, set `VITE_PUBLIC_SITE_URL` to the live web app
 *   (e.g. https://app.example.com). Emails must never use a Vercel preview host or
 *   `capacitor://` / `ionic://` origins.
 * - In local dev, when unset, falls back to `window.location.origin` if it is http(s).
 */

function stripTrailingSlash(s) {
  return String(s || "").replace(/\/+$/, "");
}

/**
 * @returns {string} Origin only, e.g. https://app.armpal.com — no path, no trailing slash.
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

  return "";
}

/**
 * Full redirect URL passed to `resetPasswordForEmail({ redirectTo })`.
 * Must match an entry in Supabase Auth → URL Configuration → Redirect URLs.
 */
export function getPasswordResetRedirectUrl() {
  const origin = getPublicSiteOrigin();
  if (!origin) {
    if (typeof window !== "undefined" && window.location?.origin) {
      return `${stripTrailingSlash(window.location.origin)}/reset-password`;
    }
    return "/reset-password";
  }
  return `${origin}/reset-password`;
}
