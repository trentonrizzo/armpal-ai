// src/onesignal.ts
import OneSignal from "react-onesignal";
import { supabase } from "./supabaseClient";

let initialized = false;

export async function initOneSignal() {
  // Prevent double init
  if (initialized) return;
  initialized = true;

  await OneSignal.init({
    appId: "PASTE_YOUR_REAL_ONESIGNAL_APP_ID_HERE",
    allowLocalhostAsSecureOrigin: true,
    notifyButton: { enable: false },
  });

  // Ensure OneSignal is fully ready
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

  // Optional but VERY useful for debugging
  const deviceState = await OneSignal.getDeviceState();

  console.log("✅ OneSignal linked to user:", user.id);
  console.log("📱 OneSignal device state:", deviceState);
}
