// src/pages/EnableNotifications.jsx
import React, { useEffect, useState } from "react";
import { enablePush } from "../lib/push";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function EnableNotifications() {
  const [user, setUser] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u ?? null);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const granted = typeof Notification !== "undefined" && Notification.permission === "granted";
    setEnabled(granted);
    if (granted) setTimeout(() => navigate("/"), 1200);
  }, [user, navigate]);

  async function handleEnable() {
    if (!user?.id) return;
    if (typeof Notification === "undefined") return;

    if (Notification.permission === "granted") {
      await enablePush(user.id);
      setEnabled(true);
      setTimeout(() => navigate("/"), 1200);
      return;
    }
    if (Notification.permission === "denied") {
      console.warn("Notifications blocked by browser");
      return;
    }

    const result = await Notification.requestPermission();
    if (result === "granted") {
      await enablePush(user.id);
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
