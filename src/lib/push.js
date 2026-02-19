export async function enablePush(userId) {
  if (!window.OneSignal) {
    console.log("OneSignal missing");
    return;
  }

  window.OneSignalDeferred = window.OneSignalDeferred || [];

  window.OneSignalDeferred.push(async function (OneSignal) {
    console.log("Starting manual push enable");

    await OneSignal.init({
      appId: import.meta.env.VITE_ONESIGNAL_APP_ID,
      notifyButton: { enable: false },
    });

    if (userId) {
      await OneSignal.login(userId);
    }

    // THIS MUST RUN FROM USER CLICK
    await OneSignal.Notifications.requestPermission();

    const subscribed = await OneSignal.User.PushSubscription.optedIn;

    console.log("Subscribed:", subscribed);
  });
}
