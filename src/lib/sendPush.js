/**
 * Client helper — request server-side APNs delivery for a user.
 * Fails silently in production UI; warns in dev.
 * @returns {Promise<{ ok: boolean, summary?: object, error?: string }>}
 */
export async function sendPushToUser({ userId, title, body, data = {} }) {
  if (!userId) return { ok: false, error: "missing_user_id" };

  try {
    const headers = { "Content-Type": "application/json" };
    const secret = import.meta.env.VITE_PUSH_INTERNAL_SECRET;
    if (secret) headers["x-push-secret"] = secret;

    const res = await fetch("/api/send-apns-push", {
      method: "POST",
      headers,
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
      if (import.meta.env.DEV) {
        console.warn("[push] send failed:", res.status, summary);
      }
      return { ok: false, error: summary?.error || detail || `HTTP ${res.status}`, summary };
    }

    if (import.meta.env.DEV) {
      console.log("[push] send success:", summary);
    }
    return { ok: true, summary };
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn("[push] send error:", err?.message || err);
    }
    return { ok: false, error: err?.message || String(err) };
  }
}
