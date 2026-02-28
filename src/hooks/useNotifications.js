import { useEffect } from "react";
import { supabase } from "../supabaseClient";

const VAPID_PUBLIC_KEY =
  import.meta.env.VITE_VAPID_PUBLIC_KEY ||
  "BI8cG9Td4RYclDiMuLH55inFeWUVFQR_fq6uYUNjh8XlWQVzsUoHAYRyRlMjCb4j6Uep5erVvDsqIf1pXZU0vDs";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registers push-sw.js with a restricted scope so it never competes
 * with the main PWA service worker for app control.
 */
export default function useNotifications(userId) {
  useEffect(() => {
    if (!userId) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    if (!VAPID_PUBLIC_KEY) {
      console.error("[Push] VAPID public key is missing. Set VITE_VAPID_PUBLIC_KEY in your environment.");
      return;
    }

    const keyBytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

    if (keyBytes.length !== 65 || keyBytes[0] !== 0x04) {
      console.error(
        "[Push] Invalid VAPID public key — must be 65-byte uncompressed P-256 point (0x04 prefix).",
        "Got", keyBytes.length, "bytes, first byte:", keyBytes[0]
      );
      return;
    }

    let cancelled = false;

    function bootstrap() {
      if (cancelled) return;

      if (!navigator.serviceWorker.controller) {
        navigator.serviceWorker.addEventListener("controllerchange", bootstrap, { once: true });
        return;
      }

      registerPush();
    }

    async function registerPush() {
      if (cancelled) return;

      try {
        const registration = await navigator.serviceWorker.register("/push-sw.js", {
          scope: "/push/",
        });

        if (Notification.permission !== "granted" || cancelled) return;

        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: keyBytes,
          });
        }

        if (cancelled) return;

        const subJson = subscription.toJSON();
        await supabase
          .from("push_subscriptions")
          .upsert(
            {
              user_id: userId,
              endpoint: subJson.endpoint,
              keys: subJson.keys,
            },
            { onConflict: "user_id,endpoint" }
          )
          .then(({ error }) => {
            if (error) console.warn("push_subscriptions upsert:", error.message);
            else if (import.meta.env.DEV) console.log("[push] subscription stored for user");
          });
      } catch (err) {
        console.error("[Push] Registration failed:", err);
      }
    }

    if (document.readyState === "complete") {
      bootstrap();
    } else {
      window.addEventListener("load", bootstrap, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("load", bootstrap);
      navigator.serviceWorker.removeEventListener("controllerchange", bootstrap);
    };
  }, [userId]);
}
