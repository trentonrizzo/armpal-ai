import { Capacitor } from "@capacitor/core";
import { supabase } from "../supabaseClient";
import { getPublicSiteOrigin } from "../utils/authPublicUrl";

const LOG = "[ArmPal.Push]";
const API_ROUTE = "/api/notify-user-push";

/** Absolute API URL — Capacitor native cannot use relative /api paths. */
export function getPushApiUrl(path = API_ROUTE) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = getPublicSiteOrigin();
  return `${base}${normalizedPath}`;
}

/**
 * Send push via authenticated route → server APNs core (/api/send-apns-push logic).
 * Never throws; returns response JSON.
 */
export async function sendPushToUser({ userId, title, body, data = {} }) {
  if (!userId) {
    console.warn(LOG, "PUSH REQUEST START skipped — missing userId");
    return { ok: false, error: "missing_user_id" };
  }

  const requestBody = { userId, title, body, data };
  const url = getPushApiUrl(API_ROUTE);

  console.log(LOG, "PUSH REQUEST START", {
    route: API_ROUTE,
    apnsCore: "/api/send-apns-push",
    url,
    userId,
    title,
    bodyPreview: String(body || "").slice(0, 80),
    dataType: data?.type || null,
    platform: typeof Capacitor !== "undefined" ? Capacitor.getPlatform() : "web",
    isNative: typeof Capacitor !== "undefined" && Capacitor.isNativePlatform(),
    windowOrigin: typeof window !== "undefined" ? window.location?.origin : null,
    publicSiteOrigin: getPublicSiteOrigin(),
  });
  console.log(LOG, "calling sendPushToUser", { requestBody });

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    const authUserId = session?.user?.id || null;

    console.log(LOG, "CURRENT AUTH USER", authUserId);
    console.log(LOG, "PUSH TARGET USER", userId);

    if (authUserId && userId && authUserId !== userId) {
      console.log(LOG, "push targets recipient (not self)", { authUserId, recipientId: userId });
    }

    if (!accessToken) {
      const err = { ok: false, error: "not_authenticated", url };
      console.error(LOG, "PUSH REQUEST FAILED", err);
      return err;
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
    let responseData = {};
    try {
      responseData = detail ? JSON.parse(detail) : {};
    } catch {
      responseData = { raw: detail };
    }

    console.log(LOG, "PUSH REQUEST RESPONSE", {
      url,
      status: res.status,
      ok: res.ok,
      responseData,
      rawPreview: detail.slice(0, 500),
    });

    if (!res.ok) {
      console.error(LOG, "PUSH REQUEST FAILED", {
        status: res.status,
        error: responseData?.error || detail,
        responseData,
      });
      return {
        ok: false,
        error: responseData?.error || detail || `HTTP ${res.status}`,
        ...responseData,
        url,
      };
    }

    return { ok: true, ...responseData, url };
  } catch (err) {
    console.error(LOG, "PUSH REQUEST FAILED", err);
    return { ok: false, error: err?.message || String(err), url };
  }
}
