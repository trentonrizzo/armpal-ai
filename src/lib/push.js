export async function enablePush(userId) {
  alert("OneSignal type: " + typeof window.OneSignal);

  if (!window.OneSignal) {
    console.log("OneSignal missing");
    return;
  }

  const OneSignal = window.OneSignal;

  console.log("Starting manual push enable");

  if (window.__ONESIGNAL_INITIALIZED__) {
    console.log("Already initialized — skipping init");
  } else {
    await OneSignal.init({
      appId: "PUT_REAL_APP_ID_HERE",
      notifyButton: { enable: false },
    });
    window.__ONESIGNAL_INITIALIZED__ = true;
  }

  if (userId) {
    await OneSignal.login(userId);
  }

  // MUST run directly inside click event
  await OneSignal.Notifications.requestPermission();

  const subscribed = await OneSignal.User.PushSubscription.optedIn;

  console.log("Subscribed:", subscribed);
}
