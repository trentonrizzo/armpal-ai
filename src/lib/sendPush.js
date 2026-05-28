import { Capacitor } from "@capacitor/core";
import { supabase } from "../supabaseClient";
import { getPublicSiteOrigin } from "../utils/authPublicUrl";

const LOG = "[ArmPal.Push]";

/** Absolute API URL — Capacitor native cannot use relative /api paths. */
export function getPushApiUrl(path = "/api/notify-user-push") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = getPublicSiteOrigin();
  return `${base}${normalizedPath}`;
}

/**
 * Send a push notification via authenticated server route (no secrets in client).
 * @returns {Promise<{ ok: boolean, summary?: object, error?: string, url?: string }>}
 */
export async function sendPushToUser({ userId, title, body, data = {} }) {
  if (!userId) {
    console.warn(LOG, "frontend send start skipped — missing userId");
    return { ok: false, error: "missing_user_id" };
  }

  const requestBody = { userId, title, body, data };
  const url = getPushApiUrl("/api/notify-user-push");
  const platform = typeof Capacitor !== "undefined" ? Capacitor.getPlatform() : "web";
  const isNative = typeof Capacitor !== "undefined" && Capacitor.isNativePlatform();

  console.log(LOG, "frontend send start", {
    url,
    platform,
    isNative,
    windowOrigin: typeof window !== "undefined" ? window.location?.origin : null,
    publicSiteOrigin: getPublicSiteOrigin(),
    userId,
    title,
    bodyPreview: String(body || "").slice(0, 80),
    dataType: data?.type || null,
  });
  console.log(LOG, "calling sendPushToUser", { requestBody });

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) {
      console.warn(LOG, "frontend send response — not authenticated");
      return { ok: false, error: "not_authenticated", url };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestBody),
    });

    const detail = await res.text().catch(() => "");
    let summary = {};
    try {
      summary = detail ? JSON.parse(detail) : {};
    } catch {
      summary = { raw: detail };
    }

    console.log(LOG, "frontend send response", {
      url,
      status: res.status,
      ok: res.ok,
      summary,
      rawPreview: detail.slice(0, 500),
    });

    if (!res.ok) {
      console.warn(LOG, "push failed", {
        reason: "http_error",
        status: res.status,
        error: summary?.error || detail,
        summary,
      });
      return { ok: false, error: summary?.error || detail || `HTTP ${res.status}`, summary, url };
    }

    if (summary.sent > 0) {
      console.log(LOG, "push sent", summary);
    } else {
      console.warn(LOG, "push failed", {
        reason: summary.reason || summary.error || "zero_sent",
        summary,
      });
    }

    return { ok: res.ok, summary, url };
  } catch (err) {
    console.warn(LOG, "push failed", {
      reason: "fetch_exception",
      error: err?.message || String(err),
      url,
    });
    return { ok: false, error: err?.message || String(err), url };
  }
}

/**
 * Temporary debug helper — duplicate push send with explicit logging.
 * Safe to no-op if the primary send already succeeded.
 */
export async function TEST_PUSH_GLOBAL({ userId, title, body, data = {} }) {
  console.log(LOG, "TEST_PUSH_GLOBAL start", { userId, title, body, data });
  const result = await sendPushToUser({ userId, title, body, data });
  console.log(LOG, "TEST_PUSH_GLOBAL result", result);
  return result;
}
