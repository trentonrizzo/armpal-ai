import { useEffect } from "react";
import { supabase } from "../supabaseClient";

const VAPID_KEY =
  "BND3tLB8a6P3wE0ScU8nYJ2i2nL5qJmNYGmOK0BmtrQ3B1V4-eeyELdWr5u6N9iIQgFxWfZgFtTIw6YgZpsqNKI";

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

    let cancelled = false;

    function bootstrap() {
      if (cancelled) return;

      // Only proceed once the main PWA SW controls the page
      if (!navigator.serviceWorker.controller) {
        navigator.serviceWorker.addEventListener("controllerchange", bootstrap, { once: true });
        return;
      }

      registerPush();
    }

    async function registerPush() {
      if (cancelled) return;

      try {
        // Scope-isolate: /push/ ensures this SW cannot intercept root navigation
        const registration = await navigator.serviceWorker.register("/push-sw.js", {
          scope: "/push/",
        });

        const permission = await Notification.requestPermission();
        if (permission !== "granted" || cancelled) return;

        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
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
          });
      } catch (err) {
        console.warn("Push registration error:", err);
      }
    }

    // Defer until after page load so the main SW activates first
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
