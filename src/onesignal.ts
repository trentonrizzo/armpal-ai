import OneSignal from "react-onesignal";

export async function initOneSignal() {
  await OneSignal.init({
    appId: "edd3f271-1b21-4f0b-ba32-8fafd9132f10",
    allowLocalhostAsSecureOrigin: true,
    notifyButton: { enable: false },
  });

  await OneSignal.Slidedown.promptPush();
}