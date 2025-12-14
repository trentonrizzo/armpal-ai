import { supabase } from "./supabaseClient";

let initialized = false;

export async function initOneSignal() {
  if (initialized) return;
  initialized = true;

  if (!window.OneSignal) {
    console.warn("❌ OneSignal not loaded");
    return;
  }

  await window.OneSignal.init({
    appId: "edd3f271-1b21-4f0b-ba32-8fafd9132f10",
    allowLocalhostAsSecureOrigin: true,
    notifyButton: { enable: false },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await window.OneSignal.setExternalUserId(user.id);

  console.log("✅ OneSignal initialized & linked:", user.id);
}

/**
 * ✅ STABLE subscription state (this was missing)
 */
export async function getStableSubscriptionState() {
  if (!window.OneSignal) return false;

  const state = await window.OneSignal.getDeviceState();
  return !!state?.isSubscribed;
}

/**
 * ✅ Request permission SAFELY
 */
export async function requestNotificationPermission() {
  if (!window.OneSignal) return false;

  const permission = await window.OneSignal.showSlidedownPrompt();
  return permission;
}
