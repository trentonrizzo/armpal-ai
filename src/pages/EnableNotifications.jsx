// src/pages/EnableNotifications.jsx
import React, { useEffect, useState } from "react";
import { requestPushPermission, getSubscriptionState } from "../lib/push";
import { useNavigate } from "react-router-dom";

export default function EnableNotifications() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function check() {
      const isEnabled = await getSubscriptionState();
      setEnabled(isEnabled);
      setLoading(false);

      if (isEnabled) {
        setTimeout(() => navigate("/"), 1200);
      }
    }
    check();
  }, [navigate]);

  async function handleEnable() {
    await requestPushPermission();
    // Permission dialog is async; re-check after a short delay.
    setTimeout(() => {
      const granted = getSubscriptionState();
      setEnabled(granted);
      if (granted) setTimeout(() => navigate("/"), 1200);
    }, 1500);
  }

  if (loading) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white px-6">
      <div className="max-w-sm w-full text-center">
        <h1 className="text-2xl font-bold mb-4">Enable Notifications</h1>

        {enabled ? (
          <p className="text-green-400">Notifications enabled ✅</p>
        ) : (
          <>
            <p className="text-gray-400 mb-6">
              Get workout reminders, PR alerts, and messages.
            </p>

            <button
              onClick={handleEnable}
              className="w-full py-3 rounded-xl bg-red-600 font-bold"
            >
              Enable Notifications
            </button>
          </>
        )}
      </div>
    </div>
  );
}
