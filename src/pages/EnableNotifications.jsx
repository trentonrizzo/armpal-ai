import React, { useEffect, useState } from "react";
import {
  getSubscriptionState,
  requestNotificationPermission,
  unsubscribe,
} from "../onesignal";

export default function EnableNotifications() {
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    let mounted = true;

    getSubscriptionState().then((state) => {
      if (!mounted) return;
      setSubscribed(state.subscribed);
      setLoading(false);
    });

    return () => (mounted = false);
  }, []);

  if (loading) return null;

  return (
    <div className="p-6 text-center">
      <h1 className="text-xl font-bold mb-4">Notifications</h1>

      {subscribed ? (
        <>
          <p className="mb-4 text-green-400">
            Notifications are enabled ✅
          </p>
          <button
            onClick={async () => {
              await unsubscribe();
              setSubscribed(false);
            }}
            className="bg-red-600 px-4 py-2 rounded"
          >
            Unsubscribe
          </button>
        </>
      ) : (
        <>
          <p className="mb-4 text-gray-400">
            Enable push notifications for updates.
          </p>
          <button
            onClick={async () => {
              await requestNotificationPermission();
              const state = await getSubscriptionState();
              setSubscribed(state.subscribed);
            }}
            className="bg-red-600 px-4 py-2 rounded"
          >
            Enable Notifications
          </button>
        </>
      )}
    </div>
  );
}
