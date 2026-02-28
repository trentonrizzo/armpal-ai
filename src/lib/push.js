import { supabase } from "../supabaseClient";

const VAPID_PUBLIC_KEY =
  import.meta.env.VITE_VAPID_PUBLIC_KEY ||
  "BI8cG9Td4RYclDiMuLH55inFeWUVFQR_fq6uYUNjh8XlWQVzsUoHAYRyRlMjCb4j6Uep5erVvDsqIf1pXZU0vDs";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Register push SW, subscribe to Web Push, and store the subscription in Supabase.
 * Call only when Notification.permission === "granted". Permission must be requested
 * only from a user gesture (e.g. settings toggle or Enable Notifications button).
 */
export async function enablePush(userId) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("Push not supported on this device.");
    return;
  }

  if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
    return;
  }

  if (!VAPID_PUBLIC_KEY) {
    console.error("[Push] VAPID public key is missing. Set VITE_VAPID_PUBLIC_KEY in your environment.");
    return;
  }

  const keyBytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

  if (keyBytes.length !== 65 || keyBytes[0] !== 0x04) {
    console.error(
      "[Push] Invalid VAPID public key — must be 65-byte uncompressed P-256 point (0x04 prefix).",
      "Got", keyBytes.length, "bytes, first byte:", keyBytes[0]
    );
    return;
  }

  const registration = await navigator.serviceWorker.register("/push-sw.js", {
    scope: "/push/",
  });

  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes,
    });
  }

  if (userId) {
    const subJson = subscription.toJSON();
    const { error } = await supabase.from("push_subscriptions").upsert(
      { user_id: userId, endpoint: subJson.endpoint, keys: subJson.keys },
      { onConflict: "user_id,endpoint" }
    );
    if (error) console.warn("push_subscriptions upsert:", error.message);
    else if (import.meta.env.DEV) console.log("[push] subscription stored for user");
  }
}

/**
 * Unsubscribe from push and remove user's rows from push_subscriptions.
 * Does not change browser permission (cannot be done programmatically).
 */
export async function disablePush(userId) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !userId) return;

  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    const pushReg = regs.find((r) => r.scope?.includes("/push/") || r.active?.scriptURL?.includes("push-sw"));
    if (pushReg?.pushManager) {
      const subscription = await pushReg.pushManager.getSubscription();
      if (subscription) await subscription.unsubscribe();
    }
    await supabase.from("push_subscriptions").delete().eq("user_id", userId);
    if (import.meta.env.DEV) console.log("[push] subscription removed for user");
  } catch (err) {
    console.warn("[push] disable error:", err);
  }
}
