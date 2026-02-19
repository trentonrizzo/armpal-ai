export async function enablePush(userId) {
  try {
    // OneSignal SDK must already be loaded in index.html
    if (!window.OneSignal) {
      alert("OneSignal missing");
      return;
    }

    // Always use the same App ID as your OneSignal app
    const APP_ID = "edd3f271-1b21-4f0b-ba32-8fafd9132f10";

    // If OneSignal already initialized, DO NOT re-init
    // Just login + request permission.
    const OneSignal = window.OneSignal;

    // v16 supports deferred pattern; we use it safely once.
    window.OneSignalDeferred = window.OneSignalDeferred || [];

    window.OneSignalDeferred.push(async function (OS) {
      try {
        // If SDK already initialized, init() can throw; ignore and continue
        try {
          await OS.init({
            appId: APP_ID,
            notifyButton: { enable: false },
          });
        } catch (e) {
          // swallow "SDK already initialized"
        }

        if (userId) {
          try { await OS.login(userId); } catch (e) {}
        }

        await OS.Notifications.requestPermission();

        const optedIn = await OS.User.PushSubscription.optedIn;
        console.log("OneSignal optedIn:", optedIn);
      } catch (e) {
        alert("Push error: " + (e?.message || String(e)));
      }
    });
  } catch (e) {
    alert("Push fatal: " + (e?.message || String(e)));
  }
}
