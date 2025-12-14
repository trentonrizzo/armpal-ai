import { useEffect, useState } from "react";
import {
  isNotificationsEnabled,
  enableNotifications,
  disableNotifications,
} from "../onesignal";

export default function EnableNotifications() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setEnabled(isNotificationsEnabled());
    setLoading(false);
  }, []);

  async function handleEnable() {
    setLoading(true);
    const ok = await enableNotifications();
    setEnabled(ok);
    setLoading(false);
  }

  async function handleDisable() {
    setLoading(true);
    await disableNotifications();
    setEnabled(false);
    setLoading(false);
  }

  if (loading) {
    return <div className="p-6 text-center text-gray-400">Loading…</div>;
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Notifications</h2>

      {enabled ? (
        <button
          onClick={handleDisable}
          className="w-full bg-gray-700 py-3 rounded text-white"
        >
          Notifications Enabled ✓ (Disable)
        </button>
      ) : (
        <button
          onClick={handleEnable}
          className="w-full bg-red-600 py-3 rounded text-white"
        >
          Enable Notifications
        </button>
      )}
    </div>
  );
}
