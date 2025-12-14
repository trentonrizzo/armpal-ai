// src/onesignal.ts
import { supabase } from "./supabaseClient";

let initialized = false;

export async function initOneSignal() {
  if (initialized) return;
  initialized = true;

  // @ts-ignore
  const OneSignal = window.OneSignal;

  if (!OneSignal) {
    console.warn("❌ OneSignal SDK not loaded");
    return;
  }

  await OneSignal.init({
    appId: "edd3f271-1b21-4f0b-ba32-8fafd9132f10",
    allowLocalhostAsSecureOrigin: true,
    notifyButton: { enable: false },
  });

  // Ask permission ONLY if not already granted
  const permission = await OneSignal.Notifications.permission;
  if (permission !== "granted") {
    await OneSignal.Notifications.requestPermission();
  }

  // Get logged-in Supabase user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.warn("⚠️ OneSignal: no user found");
    return;
  }

  // Link device to user (PERSISTENT)
  await OneSignal.login(user.id);

  const state = await OneSignal.User.PushSubscription.getState();
  console.log("✅ OneSignal state:", state);
}
