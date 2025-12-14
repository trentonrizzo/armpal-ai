// src/onesignal.ts
import OneSignal from "onesignal-cordova-plugin";
import { supabase } from "./supabaseClient";

let initialized = false;

export async function initOneSignal() {
  if (initialized) return;
  initialized = true;

  if (!window || !window.OneSignal) return;

  await window.OneSignal.init({
    appId: "edd3f271-1b21-4f0b-ba32-8fafd9132f10",
    allowLocalhostAsSecureOrigin: true,
    notifyButton: { enable: false },
  });

  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) return;

  await window.OneSignal.setExternalUserId(user.id);
}

export async function getStableSubscriptionState(): Promise<boolean> {
  if (!window?.OneSignal) return false;

  const state = await window.OneSignal.getDeviceState();
  return Boolean(state?.isSubscribed);
}

export async function requestNotificationPermission() {
  if (!window?.OneSignal) return false;

  await window.OneSignal.showSlidedownPrompt();
  const state = await window.OneSignal.getDeviceState();
  return Boolean(state?.isSubscribed);
}

export async function unsubscribeNotifications() {
  if (!window?.OneSignal) return;
  await window.OneSignal.setSubscription(false);
}
