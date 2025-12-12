import { supabase } from "../supabaseClient";

export async function registerPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.log("Push not supported");
    return;
  }

  const reg = await navigator.serviceWorker.ready;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;

  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint: sub.endpoint,
    p256dh: btoa(
      String.fromCharCode(...new Uint8Array(sub.getKey("p256dh")))
    ),
    auth: btoa(
      String.fromCharCode(...new Uint8Array(sub.getKey("auth")))
    ),
  });
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
