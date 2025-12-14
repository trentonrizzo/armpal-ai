import React, { useEffect, useState } from "react";
import {
  getSubscriptionState,
  requestNotificationPermission,
  unsubscribe,
} from "../onesignal";

export default function EnableNotifications() {
  const [subscribed, setSubscribed] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function check() {
      const state = await getSubscriptionState();
      setSubscribed(state);
    }
    check();
  }, []);

  async function handleSubscribe() {
    setLoading(true);
    await requestNotificationPermission();
    const state = await getSubscriptionState();
    setSubscribed(state);
    setLoading(false);
  }

  async function handleUnsubscribe() {
    setLoading(true);
    await unsubscribe();
    setSubscribed(false);
    setLoading(false);
  }

  if (subscribed === null) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
      <div className="bg-[#111] rounded-xl p-6 w-[90%] max-w-sm text-center">
        <h2 className="text-xl font-bold mb-4">
          {subscribed ? "Notifications Enabled" : "Enable Notifications"}
        </h2>

        <button
          onClick={subscribed ? handleUnsubscribe : handleSubscribe}
          disabled={loading}
          className="w-full py-3 rounded-lg bg-red-600 text-white font-semibold"
        >
          {loading
            ? "Please wait…"
            : subscribed
            ? "Disable Notifications"
            : "Enable Notifications"}
        </button>
      </div>
    </div>
  );
}
