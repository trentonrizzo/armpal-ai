// src/onesignal.ts
import OneSignal from "onesignal";

let initialized = false;

export async function initOneSignal() {
  if (initialized) return;
  initialized = true;

  if (!window || !("OneSignal" in window)) {
    console.warn("OneSignal not available");
    return;
  }

  await OneSignal.init({
    appId: "edd3f271-1b21-4f0b-ba32-8fafd9132f10",
    allowLocalhostAsSecureOrigin: true,

    // 🔴 HARD DISABLE ALL ONESIGNAL UI
    notifyButton: {
      enable: false,
    },

    promptOptions: {
      slidedown: {
        enabled: false,
      },
    },
  });

  // 🔒 Never auto-prompt again
  OneSignal.setConsentRequired(false);
}

// 🔍 SAFE, STABLE SUBSCRIPTION CHECK
export async function getSubscriptionState() {
  const permission = await OneSignal.getNotificationPermission();
  const optedIn = await OneSignal.isPushNotificationsEnabled();

  return {
    permission,
    subscribed: optedIn,
  };
}

// 👆 USER-INITIATED SUBSCRIBE ONLY
export async function requestNotificationPermission() {
  await OneSignal.showSlidedownPrompt();
}

// ❌ USER-INITIATED UNSUBSCRIBE
export async function unsubscribe() {
  await OneSignal.setSubscription(false);
}
