// src/onesignal.ts

let initialized = false;

export async function initOneSignal() {
  if (initialized) return;
  if (typeof window === "undefined") return;

  const OneSignal = (window as any).OneSignal;
  if (!OneSignal) return;

  initialized = true;

  await OneSignal.init({
    appId: "edd3f271-1b21-4f0b-ba32-8fafd9132f10",
    allowLocalhostAsSecureOrigin: true,
    notifyButton: { enable: false },
  });
}

export async function requestNotificationPermission() {
  const OneSignal = (window as any).OneSignal;
  if (!OneSignal) return false;

  const permission = await OneSignal.Notifications.requestPermission();
  return permission;
}

export async function getSubscriptionState() {
  const OneSignal = (window as any).OneSignal;
  if (!OneSignal) return false;

  const permission = await OneSignal.Notifications.permission;
  return permission === "granted";
}

export async function unsubscribe() {
  const OneSignal = (window as any).OneSignal;
  if (!OneSignal) return;

  await OneSignal.Notifications.setSubscription(false);
}
