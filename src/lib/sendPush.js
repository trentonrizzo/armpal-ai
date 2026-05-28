import { supabase } from "../supabaseClient";

const LOG = "[ArmPal.Push]";

/**
 * Send a push notification via authenticated server route (no secrets in client).
 * @returns {Promise<{ ok: boolean, summary?: object, error?: string }>}
 */
export async function sendPushToUser({ userId, title, body, data = {} }) {
  if (!userId) return { ok: false, error: "missing_user_id" };

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) {
      if (import.meta.env.DEV) console.warn(LOG, "push failed — not authenticated");
      return { ok: false, error: "not_authenticated" };
    }

    const res = await fetch("/api/notify-user-push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ userId, title, body, data }),
    });

    const detail = await res.text().catch(() => "");
    let summary = {};
    try {
      summary = detail ? JSON.parse(detail) : {};
    } catch {
      summary = { raw: detail };
    }

    if (!res.ok) {
      console.warn(LOG, "push failed", res.status, summary?.error || summary);
      return { ok: false, error: summary?.error || detail || `HTTP ${res.status}`, summary };
    }

    if (summary.sent > 0) {
      console.log(LOG, "push sent", summary);
    } else if (import.meta.env.DEV) {
      console.log(LOG, "push dispatch complete", summary);
    }

    return { ok: true, summary };
  } catch (err) {
    console.warn(LOG, "push failed", err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}
