// src/onesignal.ts
import { supabase } from "./supabaseClient";

let initialized = false;

export async function initOneSignal() {
  if (initialized) return;
  if (typeof window === "undefined") return;

  const OneSignal = (window as any).OneSignal;
  if (!OneSignal) return;

  initialized = true;

  await OneSignal.init({
    appId: "edd3f271-1b21-4f0b-ba32-8fafd9132f10",
    allowLocalhostAsSecureOrigin: true,
    notifyButton: { enable: false },
  });

  const permission = await OneSignal.Notifications.permission;
  if (!permission) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await OneSignal.login(user.id);
}
