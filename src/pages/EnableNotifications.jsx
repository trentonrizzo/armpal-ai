// src/pages/EnableNotifications.jsx
import React, { useEffect, useState } from "react";
import {
  requestNotificationPermission,
  getSubscriptionState,
} from "../onesignal";
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
    const granted = await requestNotificationPermission();
    if (granted) {
      setEnabled(true);
      setTimeout(() => navigate("/"), 1200);
    }
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
