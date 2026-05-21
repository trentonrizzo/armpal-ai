/**
 * Official ArmPal coaching / business account (NOT a personal founder profile).
 *
 * Configure in production via environment variables:
 *   VITE_OFFICIAL_COACHING_USER_ID  — Supabase auth user UUID (preferred)
 *   VITE_OFFICIAL_COACHING_HANDLE    — profile handle fallback lookup
 *
 * Change these in `.env` / hosting env vars to point at a different official account.
 */
export const OFFICIAL_COACHING_USER_ID =
  (typeof import.meta !== "undefined" &&
    import.meta.env?.VITE_OFFICIAL_COACHING_USER_ID &&
    String(import.meta.env.VITE_OFFICIAL_COACHING_USER_ID).trim()) ||
  "";

/** Default handle if UUID is not set — must match the official coaching profile in Supabase. */
export const OFFICIAL_COACHING_HANDLE =
  (typeof import.meta !== "undefined" &&
    import.meta.env?.VITE_OFFICIAL_COACHING_HANDLE &&
    String(import.meta.env.VITE_OFFICIAL_COACHING_HANDLE).trim()) ||
  "armpalcoaching";
