import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useTheme } from "../context/ThemeContext";

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
        border: "1px solid var(--border)",
        background: disabled
          ? "#222"
          : on
          ? "var(--accent)"
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
  const { theme, setTheme, accent, setAccent } = useTheme();

  const [user, setUser] = useState(null);
  const [section, setSection] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

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

    const redirectTo = window.location.origin;

    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo,
    });

    if (error) alert(error.message);
    else alert("Password reset email sent.");
  }

  async function confirmLogout() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  if (!open) return null;

  return (
    <>
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
            background: "var(--card)",
            padding: 16,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 900 }}>Settings</h2>

          {/* APPEARANCE */}
          <div
            onClick={() =>
              setSection(section === "appearance" ? null : "appearance")
            }
            style={{
              marginTop: 18,
              padding: 14,
              borderRadius: 14,
              background: "var(--card-2)",
              border: "1px solid var(--border)",
              cursor: "pointer",
            }}
          >
            <div style={{ fontWeight: 800 }}>Appearance</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>
              {theme === "light" ? "Light mode" : "Dark mode"}
            </div>

            {section === "appearance" && (
              <div style={{ marginTop: 12 }}>
                <TogglePill
                  on={theme === "light"}
                  disabled={false}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTheme();
                  }}
                />

                {/* ACCENT COLORS */}
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  {["red", "blue", "purple", "green"].map((c) => (
                    <button
                      key={c}
                      onClick={(e) => {
                        e.stopPropagation();
                        setAccent(c);
                      }}
                      style={{
                        flex: 1,
                        padding: 8,
                        borderRadius: 10,
                        border:
                          accent === c
                            ? "2px solid var(--accent)"
                            : "1px solid var(--border)",
                        background: "var(--card)",
                        fontWeight: 700,
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* NOTIFICATIONS */}
          <div
            onClick={() =>
              setSection(section === "notifications" ? null : "notifications")
            }
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 14,
              background: "var(--card-2)",
              border: "1px solid var(--border)",
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
              background: "var(--card-2)",
              border: "1px solid var(--border)",
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
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    fontWeight: 700,
                  }}
                >
                  Send password reset email
                </button>
              </div>
            )}
          </div>

          <div style={{ flex: 1 }} />

          <button
            onClick={() => setShowLogoutConfirm(true)}
            style={{
              padding: 14,
              borderRadius: 14,
              background: "var(--accent)",
              border: "none",
              color: "white",
              fontWeight: 900,
            }}
          >
            Log out
          </button>
        </div>
      </div>

      {/* LOGOUT CONFIRM MODAL */}
      {showLogoutConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "86%",
              maxWidth: 340,
              background: "var(--card)",
              borderRadius: 16,
              padding: 18,
              border: "1px solid var(--border)",
              textAlign: "center",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16 }}>Log out?</div>
            <div style={{ opacity: 0.7, marginTop: 6 }}>
              You will need to sign back in.
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  background: "var(--card-2)",
                  border: "1px solid var(--border)",
                  fontWeight: 700,
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  background: "var(--accent)",
                  border: "none",
                  color: "white",
                  fontWeight: 900,
                }}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
