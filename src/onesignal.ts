// src/onesignal.ts
import { supabase } from "./supabaseClient";

const STORAGE_KEY = "armpal_notifications_enabled";
let initialized = false;

export async function initOneSignal() {
  if (initialized) return;
  initialized = true;

  if (!window?.OneSignal) return;

  await window.OneSignal.init({
    appId: "edd3f271-1b21-4f0b-ba32-8fafd9132f10",
    allowLocalhostAsSecureOrigin: true,
    notifyButton: { enable: false },
  });

  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (user) {
    await window.OneSignal.setExternalUserId(user.id);
  }

  const state = await window.OneSignal.getDeviceState();
  if (state?.isSubscribed) {
    localStorage.setItem(STORAGE_KEY, "true");
    window.OneSignal.hideSlidedownPrompt();
  }
}

export function isNotificationsEnabled(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export async function enableNotifications() {
  if (!window?.OneSignal) return false;

  await window.OneSignal.showSlidedownPrompt();
  const state = await window.OneSignal.getDeviceState();

  if (state?.isSubscribed) {
    localStorage.setItem(STORAGE_KEY, "true");
    window.OneSignal.hideSlidedownPrompt();
    return true;
  }

  return false;
}

export async function disableNotifications() {
  if (!window?.OneSignal) return;

  await window.OneSignal.setSubscription(false);
  localStorage.removeItem(STORAGE_KEY);
}
