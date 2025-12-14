import { useEffect, useState } from "react";
import {
  getStableSubscriptionState,
  requestNotificationPermission,
} from "../onesignal";

export default function EnableNotifications() {
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function check() {
      const isSub = await getStableSubscriptionState();
      if (mounted) {
        setSubscribed(isSub);
        setLoading(false);
      }
    }

    check();
    return () => (mounted = false);
  }, []);

  async function enable() {
    await requestNotificationPermission();
    const isSub = await getStableSubscriptionState();
    setSubscribed(isSub);
  }

  async function disable() {
    if (window.OneSignal) {
      await window.OneSignal.setSubscription(false);
      setSubscribed(false);
    }
  }

  if (loading) return null;

  return (
    <div className="p-6 text-white">
      <h1 className="text-xl font-bold mb-4">Push Notifications</h1>

      {subscribed ? (
        <button
          onClick={disable}
          className="bg-red-600 px-4 py-2 rounded"
        >
          Unsubscribe
        </button>
      ) : (
        <button
          onClick={enable}
          className="bg-green-600 px-4 py-2 rounded"
        >
          Enable Notifications
        </button>
      )}
    </div>
  );
}
