export async function setupPush(userId) {
  if (!window.OneSignal) {
    console.log("OneSignal not loaded");
    return;
  }

  window.OneSignalDeferred = window.OneSignalDeferred || [];

  window.OneSignalDeferred.push(async function (OneSignal) {
    console.log("ONESIGNAL CLEAN INIT");

    await OneSignal.init({
      appId: import.meta.env.VITE_ONESIGNAL_APP_ID,
      notifyButton: { enable: false },
      allowLocalhostAsSecureOrigin: true,
    });

    if (userId) {
      await OneSignal.login(userId);
    }
  });
}

export async function requestPushPermission() {
  if (!window.OneSignal) return;

  window.OneSignalDeferred = window.OneSignalDeferred || [];

  window.OneSignalDeferred.push(async function (OneSignal) {
    const permission = await OneSignal.Notifications.permission;

    console.log("Current permission:", permission);

    if (permission !== "granted") {
      await OneSignal.Notifications.requestPermission();
    }
  });
}

export function getSubscriptionState() {
  if (typeof Notification === "undefined") return false;
  return Notification.permission === "granted";
}
