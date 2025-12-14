// src/pages/EnableNotifications.jsx
import { useEffect, useState } from "react";
import {
  getStableSubscriptionState,
  requestNotificationPermission,
  unsubscribeNotifications,
} from "../onesignal";

export default function EnableNotifications() {
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function check() {
      const isSub = await getStableSubscriptionState();
      if (!mounted) return;

      setSubscribed(isSub);
      setLoading(false);

      if (window.OneSignal && isSub) {
        window.OneSignal.hideSlidedownPrompt();
      }
    }

    check();
    return () => (mounted = false);
  }, []);

  async function enable() {
    setLoading(true);
    await requestNotificationPermission();
    const isSub = await getStableSubscriptionState();
    setSubscribed(isSub);
    setLoading(false);

    if (window.OneSignal && isSub) {
      window.OneSignal.hideSlidedownPrompt();
    }
  }

  async function disable() {
    setLoading(true);
    await unsubscribeNotifications();
    setSubscribed(false);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-400">
        Checking notification status…
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Manage Notifications</h2>

      {subscribed ? (
        <button
          onClick={disable}
          className="w-full bg-gray-700 py-3 rounded text-white"
        >
          Notifications Enabled ✓ (Disable)
        </button>
      ) : (
        <button
          onClick={enable}
          className="w-full bg-red-600 py-3 rounded text-white"
        >
          Enable Notifications
        </button>
      )}
    </div>
  );
}
