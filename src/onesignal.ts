// src/onesignal.ts
import { supabase } from "./supabaseClient";

let initialized = false;

function getOS() {
  if (typeof window === "undefined") return null;
  return (window as any).OneSignal || null;
}

/* ---------------- INIT ---------------- */

export async function initOneSignal() {
  if (initialized) return;

  const OneSignal = getOS();
  if (!OneSignal) return;

  initialized = true;

  await OneSignal.init({
    appId: "edd3f271-1b21-4f0b-ba32-8fafd9132f10",
    allowLocalhostAsSecureOrigin: true,
    notifyButton: { enable: false },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await OneSignal.login(user.id);
  }
}

/* ---------------- STATE ---------------- */

export async function getSubscriptionState() {
  const OneSignal = getOS();
  if (!OneSignal) return false;

  const permission = await OneSignal.Notifications.permission;
  return permission === true;
}

/* ---------------- ACTIONS ---------------- */

export async function requestNotificationPermission() {
  const OneSignal = getOS();
  if (!OneSignal) return false;

  await OneSignal.Notifications.requestPermission();
  return true;
}

export async function unsubscribe() {
  const OneSignal = getOS();
  if (!OneSignal) return;

  await OneSignal.logout();
}
