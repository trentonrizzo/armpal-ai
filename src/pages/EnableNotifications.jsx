import { useEffect, useState } from "react";
import {
  getStableSubscriptionState,
  requestNotificationPermission,
} from "../onesignal";

export default function EnableNotifications() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const s = await getStableSubscriptionState();
      if (mounted) {
        setState(s);
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div>Loading…</div>;

  if (state.isSubscribed) {
    return <div>✅ Notifications enabled</div>;
  }

  return (
    <button
      onClick={async () => {
        const ok = await requestNotificationPermission();
        if (ok) {
          const s = await getStableSubscriptionState();
          setState(s);
        }
      }}
    >
      Enable Notifications
    </button>
  );
}
