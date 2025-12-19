import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

/* ============================
   PUSH HELPERS
============================ */

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function getVapidPublicKey() {
  if (typeof window !== "undefined" && window.VAPID_PUBLIC_KEY) {
    return String(window.VAPID_PUBLIC_KEY);
  }
  try {
    return import.meta.env.VITE_VAPID_PUBLIC_KEY || null;
  } catch {
    return null;
  }
}

async function getServiceWorkerRegistration() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service worker not supported");
  }
  return navigator.serviceWorker.ready;
}

async function getExistingPushSubscription() {
  const reg = await getServiceWorkerRegistration();
  return reg.pushManager.getSubscription();
}

async function saveSubscription(userId, subscription) {
  const json = subscription.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: json?.keys?.p256dh || null,
      auth: json?.keys?.auth || null,
      created_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );
  if (error) throw error;
}

async function removeSubscription(userId, endpoint) {
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", endpoint);
  if (error) throw error;
}

/* ============================
   TOGGLE PILL
============================ */

function TogglePill({ on, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 54,
        height: 30,
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.14)",
        background: disabled
          ? "#222"
          : on
          ? "rgba(255,47,47,0.95)"
          : "#1a1a1a",
        padding: 2,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        justifyContent: on ? "flex-end" : "flex-start",
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 999,
          background: "#fff",
          opacity: disabled ? 0.6 : 1,
        }}
      />
    </button>
  );
}

/* ============================
   SETTINGS OVERLAY
============================ */

export default function SettingsOverlay({ open, onClose }) {
  const [user, setUser] = useState(null);
  const [section, setSection] = useState(null); // notifications | account

  const [notifSupported, setNotifSupported] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifBusy, setNotifBusy] = useState(false);

  useEffect(() => {
    if (!open) return;

    supabase.auth.getUser().then(({ data }) => setUser(data?.user));

    const supported =
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;

    setNotifSupported(!!supported);

    if (supported) {
      getExistingPushSubscription()
        .then((sub) => setNotifEnabled(!!sub))
        .catch(() => setNotifEnabled(false));
    }
  }, [open]);

  async function toggleNotifications() {
    if (!user || !notifSupported) return;

    setNotifBusy(true);

    try {
      const reg = await getServiceWorkerRegistration();
      const existing = await reg.pushManager.getSubscription();

      if (!existing) {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") throw new Error("Permission denied");

        const vapidKey = getVapidPublicKey();
        if (!vapidKey) throw new Error("Missing VAPID key");

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });

        await saveSubscription(user.id, sub);
        setNotifEnabled(true);
      } else {
        await removeSubscription(user.id, existing.endpoint);
        await existing.unsubscribe();
        setNotifEnabled(false);
      }
    } catch (err) {
      alert(err.message || "Notification error");
    } finally {
      setNotifBusy(false);
    }
  }

  async function sendPasswordReset() {
    if (!user?.email) return;

    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: window.location.origin,
    });

    if (error) {
      alert(error.message);
    } else {
      alert("Password reset email sent.");
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 9999,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "74%",
          maxWidth: 380,
          background: "#0f0f10",
          padding: 16,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 900 }}>Settings</h2>

        {/* NOTIFICATIONS */}
        <div
          onClick={() =>
            setSection(section === "notifications" ? null : "notifications")
          }
          style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 14,
            background: "#111",
            border: "1px solid rgba(255,255,255,0.1)",
            cursor: "pointer",
          }}
        >
          <div style={{ fontWeight: 800 }}>Notifications</div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            {notifSupported
              ? notifEnabled
                ? "Enabled"
                : "Disabled"
              : "Not supported"}
          </div>

          {section === "notifications" && (
            <div style={{ marginTop: 12 }}>
              <TogglePill
                on={notifEnabled}
                disabled={!notifSupported || notifBusy}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleNotifications();
                }}
              />
            </div>
          )}
        </div>

        {/* ACCOUNT */}
        <div
          onClick={() => setSection(section === "account" ? null : "account")}
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 14,
            background: "#111",
            border: "1px solid rgba(255,255,255,0.1)",
            cursor: "pointer",
          }}
        >
          <div style={{ fontWeight: 800 }}>Account</div>

          {section === "account" && (
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
              <div style={{ opacity: 0.6 }}>Email</div>
              <div>{user?.email}</div>

              <div style={{ height: 10 }} />

              <div style={{ opacity: 0.6 }}>User ID</div>
              <div style={{ fontSize: 12 }}>{user?.id}</div>

              <div style={{ height: 14 }} />

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  sendPasswordReset();
                }}
                style={{
                  padding: 10,
                  width: "100%",
                  borderRadius: 12,
                  background: "#1a1a1a",
                  border: "1px solid rgba(255,255,255,0.14)",
                  color: "white",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Send password reset email
              </button>
            </div>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* LOG OUT */}
        <button
          onClick={logout}
          style={{
            padding: 14,
            borderRadius: 14,
            background: "#ff2f2f",
            border: "none",
            color: "white",
            fontWeight: 900,
          }}
        >
          Log out
        </button>
      </div>
    </div>
  );
}
