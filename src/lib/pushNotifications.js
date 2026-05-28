import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "../supabaseClient";

let listenersAttached = false;
let activeUserId = null;

/**
 * Persist an APNs device token for the signed-in user.
 * @param {string} token
 * @param {string} userId
 */
export async function savePushToken(token, userId) {
  if (!token || !userId) return;

  const { error } = await supabase.from("push_tokens").upsert(
    {
      user_id: userId,
      token,
      platform: "ios",
      enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,token" }
  );

  if (error) {
    console.warn("[APNs] token save failed:", error.message);
    return;
  }

  console.log("[APNs] token saved");
}

/**
 * Register for native iOS APNs push (Capacitor only). No-op on web.
 * @param {{ id: string } | null | undefined} user
 */
export async function initPushNotifications(user) {
  if (!user?.id) return;
  if (!Capacitor.isNativePlatform()) return;
  if (Capacitor.getPlatform() !== "ios") return;

  activeUserId = user.id;

  try {
    if (!listenersAttached) {
      await PushNotifications.addListener("registration", (token) => {
        void savePushToken(token.value, activeUserId);
      });

      await PushNotifications.addListener("registrationError", (err) => {
        console.warn("[APNs] registration error:", err);
      });

      await PushNotifications.addListener("pushNotificationReceived", (notification) => {
        if (import.meta.env.DEV) {
          console.log("[APNs] pushNotificationReceived:", notification);
        }
      });

      await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        if (import.meta.env.DEV) {
          console.log("[APNs] pushNotificationActionPerformed:", action);
        }
      });

      listenersAttached = true;
    }

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt") {
      perm = await PushNotifications.requestPermissions();
    }

    console.log("[APNs] permission result:", perm.receive);

    if (perm.receive !== "granted") return;

    await PushNotifications.register();
  } catch (err) {
    console.warn("[APNs] init failed:", err?.message || err);
  }
}
