import { useEffect } from "react";

export default function useNotifications() {
  useEffect(() => {
    // Check if browser supports notifications + service workers
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.warn("Push notifications not supported on this device.");
      return;
    }

    async function register() {
      try {
        // Register the service worker
        const registration = await navigator.serviceWorker.register("/sw.js");
        console.log("Service Worker Registered:", registration);

        // Request permission from user
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          console.log("Notification permission denied.");
          return;
        }

        // Check if already subscribed
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          // Create a new push subscription
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(
              "BND3tLB8a6P3wE0ScU8nYJ2i2nL5qJmNYGmOK0BmtrQ3B1V4-eeyELdWr5u6N9iIQgFxWfZgFtTIw6YgZpsqNKI"
            ),
          });
          console.log("New Push Subscription:", subscription);
        } else {
          console.log("Already subscribed:", subscription);
        }

        // TODO: Later we send "subscription" to Supabase to store it per user.
      } catch (err) {
        console.error("Push registration error:", err);
      }
    }

    register();
  }, []);
}

// Convert base64 VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
