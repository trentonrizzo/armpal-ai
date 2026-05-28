/**
 * Client helper — request server-side APNs delivery for a user.
 * Fails silently in production UI; warns in dev.
 */
export async function sendPushToUser({ userId, title, body, data = {} }) {
  if (!userId) return;

  try {
    const headers = { "Content-Type": "application/json" };
    const secret = import.meta.env.VITE_PUSH_INTERNAL_SECRET;
    if (secret) headers["x-push-secret"] = secret;

    const res = await fetch("/api/send-apns-push", {
      method: "POST",
      headers,
      body: JSON.stringify({ userId, title, body, data }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      if (import.meta.env.DEV) {
        console.warn("[push] send failed:", res.status, detail);
      }
      return;
    }

    const summary = await res.json().catch(() => ({}));
    if (import.meta.env.DEV) {
      console.log("[push] send success:", summary);
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn("[push] send error:", err?.message || err);
    }
  }
}
