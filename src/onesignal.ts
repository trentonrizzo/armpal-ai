// src/onesignal.ts
import OneSignal from "onesignal";
import { supabase } from "./supabaseClient";

let initPromise: Promise<void> | null = null;

export async function initOneSignal() {
  // 🔒 Ensure single init across reloads
  if (!initPromise) {
    initPromise = (async () => {
      await OneSignal.init({
        appId: "edd3f271-1b21-4f0b-ba32-8fafd9132f10",
        allowLocalhostAsSecureOrigin: true,
        notifyButton: { enable: false },
      });

      // Wait until OneSignal is actually ready
      await OneSignal.waitForPushNotificationsEnabled();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // Always re-link on load (safe + required)
      await OneSignal.login(user.id);

      console.log("🔔 OneSignal ready + linked:", user.id);
    })();
  }

  return initPromise;
}

// Explicit user action ONLY
export async function requestNotificationPermission() {
  const permission = await OneSignal.getNotificationPermission();

  if (permission === "granted") {
    localStorage.setItem("onesignal_user_subscribed", "true");
    return true;
  }

  await OneSignal.showSlidedownPrompt();

  const finalPermission = await OneSignal.getNotificationPermission();

  if (finalPermission === "granted") {
    localStorage.setItem("onesignal_user_subscribed", "true");
    return true;
  }

  return false;
}

export async function getStableSubscriptionState() {
  await initOneSignal();

  const deviceState = await OneSignal.getDeviceState();

  return {
    isSubscribed: Boolean(deviceState?.isSubscribed),
    permission: deviceState?.notificationPermission,
    userOptedIn:
      localStorage.getItem("onesignal_user_subscribed") === "true",
  };
}
