// src/onesignal.ts
import OneSignal from "react-onesignal";
import { supabase } from "./supabaseClient";

let initialized = false;

export async function initOneSignal() {
  // Prevent double init
  if (initialized) return;
  initialized = true;

  // Initialize OneSignal
  await OneSignal.init({
    appId: "edd3f271-1b21-4f0b-ba32-8fafd9132f10",
    allowLocalhostAsSecureOrigin: true,
    notifyButton: { enable: false },
  });

  // Ask for permission / ensure device registers
  await OneSignal.showSlidedownPrompt();

  // Get logged-in Supabase user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.warn("⚠️ OneSignal init: no user found");
    return;
  }

  // Link device to Supabase user
  await OneSignal.setExternalUserId(user.id);

  // Debug info
  const deviceState = await OneSignal.getDeviceState();

  console.log("✅ OneSignal linked to user:", user.id);
  console.log("📱 OneSignal device state:", deviceState);
}
