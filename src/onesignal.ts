import OneSignal from "react-onesignal";
import { supabase } from "./supabaseClient";

export async function initOneSignal() {
  await OneSignal.init({
    appId: "YOUR_ONESIGNAL_APP_ID",
    allowLocalhostAsSecureOrigin: true,
  });

  // 🔗 Link OneSignal to logged-in user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await OneSignal.setExternalUserId(user.id);
    console.log("✅ OneSignal linked to user:", user.id);
  }
}
