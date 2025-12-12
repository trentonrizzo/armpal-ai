import { supabase } from "../supabaseClient";

const VAPID_PUBLIC_KEY = "BCTyl32B4ObND-BP2AVLL2nr12YBHueX86aH8ltaKMAwxXTyGfrs0x-bpyJYhElhhyR29WCnD3pOnzVSKv4fewY";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function registerPush() {
  if (!("serviceWorker" in navigator)) return;
  if (!("PushManager" in window)) return;

  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) return;

  const registration = await navigator.serviceWorker.ready;

  let sub = await registration.pushManager.getSubscription();
  if (!sub) {
    sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

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
