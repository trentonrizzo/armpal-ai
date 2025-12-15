// src/pages/ProfilePage.jsx
import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "../supabaseClient";
import Cropper from "react-easy-crop";
import { FiSettings, FiEdit2 } from "react-icons/fi";

/**
 * ✅ FULL PROFILE PAGE (restored + expanded)
 * - Avatar upload + crop
 * - Username, Display Name, Handle, Bio
 * - Profile stats cards (pulls counts from your tables if they exist)
 * - Settings drawer with:
 *    - Notifications toggle (asks permission on iOS + subscribes)
 *    - Account info collapse
 *    - Logout confirm
 *
 * IMPORTANT:
 * - This file assumes you already set up:
 *   - public/sw.js (service worker)
 *   - push_subscriptions table + policies (you did)
 * - This file DOES NOT delete features. It restores a full profile UI.
 */

/* ---------------------------
   Push Helpers (PWA)
   --------------------------- */

/**
 * Base64 URL -> Uint8Array (for VAPID key)
 */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/**
 * Gets a VAPID public key from wherever you already stored it.
 * - Tries common places without you editing:
 *   1) window.VAPID_PUBLIC_KEY (if you set it)
 *   2) localStorage "VAPID_PUBLIC_KEY"
 *   3) import.meta.env.VITE_VAPID_PUBLIC_KEY (vite env)
 *
 * If none exist, notifications toggle will still show,
 * but enabling will alert you what’s missing.
 */
function getVapidPublicKey() {
  // 1) global
  if (typeof window !== "undefined" && window.VAPID_PUBLIC_KEY) {
    return String(window.VAPID_PUBLIC_KEY);
  }

  // 2) localStorage
  try {
    const ls = localStorage.getItem("VAPID_PUBLIC_KEY");
    if (ls) return String(ls);
  } catch (e) {}

  // 3) Vite env (only works if set in your deployment)
  try {
    if (import.meta?.env?.VITE_VAPID_PUBLIC_KEY) {
      return String(import.meta.env.VITE_VAPID_PUBLIC_KEY);
    }
  } catch (e) {}

  return null;
}

/**
 * Save subscription to Supabase.
 * Table: push_subscriptions
 * Columns you created: id, user_id, endpoint, p256dh, auth, created_at
 */
async function saveSubscriptionToSupabase(userId, subscription) {
  const json = subscription.toJSON();

  const endpoint = subscription.endpoint;
  const p256dh = json?.keys?.p256dh || null;
  const auth = json?.keys?.auth || null;

  // Upsert: one row per endpoint per user (simple approach)
  // If you want strict uniqueness later, add a unique index on (user_id, endpoint)
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      created_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );

  if (error) throw error;
}

/**
 * Remove a subscription from Supabase.
 */
async function removeSubscriptionFromSupabase(userId, endpoint) {
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", endpoint);

  if (error) throw error;
}

/**
 * Ensure service worker is ready.
 */
async function getServiceWorkerRegistration() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service Worker not supported on this device/browser.");
  }
  const reg = await navigator.serviceWorker.ready;
  return reg;
}

/**
 * Returns current push subscription (or null).
 */
async function getExistingPushSubscription() {
  const reg = await getServiceWorkerRegistration();
  const sub = await reg.pushManager.getSubscription();
  return sub;
}

/**
 * Subscribe the user to push.
 */
async function subscribeToPush(userId) {
  if (!("Notification" in window)) {
    throw new Error("Notifications not supported on this device/browser.");
  }

  // Ask permission (iOS will show the prompt)
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const vapidPublicKey = getVapidPublicKey();
  if (!vapidPublicKey) {
    throw new Error(
      "Missing VAPID public key. Set window.VAPID_PUBLIC_KEY or localStorage VAPID_PUBLIC_KEY or VITE_VAPID_PUBLIC_KEY."
    );
  }

  const reg = await getServiceWorkerRegistration();

  // Subscribe (or get existing)
  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  await saveSubscriptionToSupabase(userId, subscription);

  return subscription;
}

/**
 * Unsubscribe the user from push.
 */
async function unsubscribeFromPush(userId) {
  const reg = await getServiceWorkerRegistration();
  const subscription = await reg.pushManager.getSubscription();

  if (!subscription) return;

  const endpoint = subscription.endpoint;

  // Unsubscribe browser
  await subscription.unsubscribe();

  // Remove row
  await removeSubscriptionFromSupabase(userId, endpoint);
}

/* ---------------------------
   UI Helpers
   --------------------------- */

function SoftCard({ title, value, sub }) {
  return (
    <div
      style={{
        flex: 1,
        background: "#0b0b0c",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
        padding: 14,
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1 }}>{value}</div>
      {sub ? <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>{sub}</div> : null}
    </div>
  );
}

function RowButton({ left, right, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 12px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.10)",
        background: danger ? "rgba(255,47,47,0.10)" : "#0d0d0f",
        color: danger ? "#ff6464" : "white",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 600 }}>{left}</span>
      <span style={{ fontSize: 12, opacity: 0.75 }}>{right}</span>
    </button>
  );
}

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
        background: disabled ? "#222" : on ? "rgba(255,47,47,0.95)" : "#1a1a1a",
        padding: 2,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: on ? "flex-end" : "flex-start",
      }}
      aria-label="toggle"
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

/* ---------------------------
   Main Component
   --------------------------- */

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // EXISTING FIELDS
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // NEW FIELDS
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [handleStatus, setHandleStatus] = useState(null); // valid, invalid, taken

  // Upload/crop
  const [uploading, setUploading] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const fileInputRef = useRef(null);

  // Settings drawer
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showAccountInfo, setShowAccountInfo] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Notifications toggle state
  const [notifSupported, setNotifSupported] = useState(false);
  const [notifPermission, setNotifPermission] = useState("default"); // default|granted|denied
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifBusy, setNotifBusy] = useState(false);

  // Stats (optional)
  const [stats, setStats] = useState({
    prs: 0,
    workouts: 0,
    measurements: 0,
  });

  useEffect(() => {
    loadProfile();
    initNotificationState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);

      const { data: auth } = await supabase.auth.getUser();
      const authUser = auth?.user;
      if (!authUser) return;

      setUser(authUser);

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (error) throw error;

      setUsername(data?.username || "");
      setBio(data?.bio || "");
      setAvatarUrl(data?.avatar_url || "");

      setDisplayName(data?.display_name || "");
      setHandle(data?.handle || "");

      // Pull optional stats (won’t crash if tables don’t exist)
      await loadStats(authUser.id);
    } catch (err) {
      console.error("Error loading profile:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats(userId) {
    const next = { prs: 0, workouts: 0, measurements: 0 };

    // PRs
    try {
      const { count } = await supabase
        .from("prs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      next.prs = count || 0;
    } catch (e) {}

    // Workouts
    try {
      const { count } = await supabase
        .from("workouts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      next.workouts = count || 0;
    } catch (e) {}

    // Measurements
    try {
      const { count } = await supabase
        .from("measurements")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      next.measurements = count || 0;
    } catch (e) {}

    setStats(next);
  }

  /* ---------------------------
     Handle Validation
     --------------------------- */

  function validateHandle(h) {
    return /^[a-z0-9_]{3,20}$/.test(h);
  }

  async function onHandleChange(val) {
    const clean = (val || "").toLowerCase();
    setHandle(clean);

    if (!validateHandle(clean)) {
      setHandleStatus("invalid");
      return;
    }

    // Must have user loaded for .neq
    const myId = user?.id;
    if (!myId) {
      setHandleStatus("valid");
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("handle", clean)
      .neq("id", myId);

    if (data?.length) setHandleStatus("taken");
    else setHandleStatus("valid");
  }

  /* ---------------------------
     Cropping
     --------------------------- */

  const getCroppedImg = async (imageSrc, pixelCrop) => {
    return new Promise((resolve, reject) => {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = imageSrc;

        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = pixelCrop.width;
            canvas.height = pixelCrop.height;

            const ctx = canvas.getContext("2d");
            ctx.drawImage(
              img,
              pixelCrop.x,
              pixelCrop.y,
              pixelCrop.width,
              pixelCrop.height,
              0,
              0,
              pixelCrop.width,
              pixelCrop.height
            );

            canvas.toBlob(
              (blob) => {
                if (!blob) return reject(new Error("Canvas empty"));
                resolve(blob);
              },
              "image/jpeg",
              0.92
            );
          } catch (e) {
            reject(e);
          }
        };

        img.onerror = (e) => reject(e);
      } catch (e) {
        reject(e);
      }
    });
  };

  const onCropComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  function onSelectFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result);
      setShowCropper(true);
    };
    reader.readAsDataURL(f);
  }

  async function doSaveCroppedImage() {
    try {
      if (!user) return;
      if (!selectedImage || !croppedAreaPixels) return;

      setUploading(true);

      const croppedBlob = await getCroppedImg(selectedImage, croppedAreaPixels);
      const filePath = `${user.id}-${Date.now()}.jpg`;

      const { error } = await supabase.storage
        .from("avatars")
        .upload(filePath, croppedBlob, { upsert: true, contentType: "image/jpeg" });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);

      const publicUrl = urlData?.publicUrl || "";
      setAvatarUrl(publicUrl);

      // Save avatar_url to profile immediately (so it persists)
      await supabase
        .from("profiles")
        .upsert({ id: user.id, avatar_url: publicUrl });

      setShowCropper(false);
      setSelectedImage(null);
    } catch (err) {
      console.error(err);
      alert("Avatar upload failed: " + (err?.message || "unknown error"));
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    setAvatarUrl("");
    if (!user) return;
    await supabase.from("profiles").upsert({ id: user.id, avatar_url: "" });
  }

  /* ---------------------------
     Save Profile
     --------------------------- */

  async function saveProfile() {
    try {
      if (!user) return;

      if (handle && handleStatus === "invalid") {
        alert("Handle format invalid.");
        return;
      }
      if (handle && handleStatus === "taken") {
        alert("Handle already taken.");
        return;
      }

      const updates = {
        id: user.id,
        username: username || "",
        bio: bio || "",
        avatar_url: avatarUrl || "",

        // new
        display_name: displayName || "",
        handle: handle ? handle : null,
      };

      const { error } = await supabase.from("profiles").upsert(updates);
      if (error) throw error;

      alert("Profile saved!");
    } catch (err) {
      alert("Error saving profile: " + (err?.message || "unknown error"));
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  function openSettings() {
    setSettingsOpen(true);
    setShowAccountInfo(false);
  }

  /* ---------------------------
     Notifications
     --------------------------- */

  function initNotificationState() {
    const supported =
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;

    setNotifSupported(!!supported);

    try {
      setNotifPermission(Notification.permission || "default");
    } catch (e) {
      setNotifPermission("default");
    }

    // Check subscription
    setTimeout(async () => {
      try {
        if (!supported) return;
        const existing = await getExistingPushSubscription();
        setNotifEnabled(!!existing);
      } catch (e) {
        setNotifEnabled(false);
      }
    }, 250);
  }

  async function toggleNotifications() {
    if (!user) return;

    if (!notifSupported) {
      alert("Push notifications are not supported on this device/browser.");
      return;
    }

    setNotifBusy(true);

    try {
      // Turning ON
      if (!notifEnabled) {
        await subscribeToPush(user.id);
        setNotifEnabled(true);
        setNotifPermission("granted");
        alert("Notifications enabled ✅");
      } else {
        // Turning OFF
        await unsubscribeFromPush(user.id);
        setNotifEnabled(false);
        alert("Notifications disabled.");
      }
    } catch (err) {
      console.error(err);
      alert(err?.message || "Notification setup failed.");
    } finally {
      setNotifBusy(false);
      // Re-check actual subscription state
      try {
        const existing = await getExistingPushSubscription();
        setNotifEnabled(!!existing);
      } catch (e) {}
    }
  }

  /* ---------------------------
     Derived UI
     --------------------------- */

  const handleHelper = useMemo(() => {
    if (!handle) return null;
    if (handleStatus === "invalid")
      return { text: "Only letters, numbers, underscores (3–20).", color: "#ff5a5a" };
    if (handleStatus === "taken") return { text: "Handle already taken.", color: "#ff5a5a" };
    if (handleStatus === "valid") return { text: "Available ✓", color: "#4ade80" };
    return null;
  }, [handle, handleStatus]);

  /* ---------------------------
     Render
     --------------------------- */

  return (
    <>
      {loading ? (
        <p style={{ padding: 20, opacity: 0.75 }}>Loading profile...</p>
      ) : (
        <div className="fade-in">
          <div
            style={{
              padding: "20px 16px 110px",
              maxWidth: 900,
              margin: "0 auto",
            }}
          >
            {/* HEADER */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 2 }}>Profile</h1>
                <div style={{ fontSize: 12, opacity: 0.6 }}>
                  {user?.email ? user.email : " "}
                </div>
              </div>

              <button
                onClick={openSettings}
                style={{
                  background: "#111",
                  borderRadius: "999px",
                  border: "1px solid rgba(255,255,255,0.12)",
                  width: 40,
                  height: 40,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
                aria-label="Settings"
              >
                <FiSettings size={20} />
              </button>
            </div>

            {/* STATS */}
            <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
              <SoftCard title="PRs" value={stats.prs} sub="Total PR entries" />
              <SoftCard title="Workouts" value={stats.workouts} sub="Saved workouts" />
              <SoftCard title="Measures" value={stats.measurements} sub="Logged measurements" />
            </div>

            {/* MAIN CARD */}
            <div
              style={{
                background: "#070708",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 18,
                padding: 16,
                marginBottom: 16,
              }}
            >
             {/* AVATAR */}
<div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14 }}>
  <div style={{ position: "relative", width: 92, height: 92 }}>
    <img
      src={avatarUrl || "https://via.placeholder.com/120?text=No+Avatar"}
      alt="avatar"
      style={{
        width: 92,
        height: 92,
        objectFit: "cover",
        borderRadius: "999px",
        border: "2px solid rgba(255,255,255,0.10)",
        background: "#0a0a0a",
      }}
    />

    {/* hidden file input */}
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      onChange={onSelectFile}
      style={{ display: "none" }}
    />

    {/* pencil icon ONLY */}
    <button
      onClick={() => fileInputRef.current?.click()}
      style={{
        position: "absolute",
        right: -2,
        bottom: -2,
        width: 32,
        height: 32,
        borderRadius: "999px",
        background: "#111",
        border: "1px solid rgba(255,255,255,0.25)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        boxShadow: "0 6px 14px rgba(0,0,0,0.5)",
      }}
      aria-label="Change profile picture"
    >
      <FiEdit2 size={16} color="#ffffff" />
    </button>
  </div>

  <div style={{ flex: 1, minWidth: 0 }}>
    <div style={{ fontSize: 12, opacity: 0.7 }}>
      Profile picture
    </div>
    <div style={{ fontSize: 12, opacity: 0.45, marginTop: 4 }}>
      Tap the pencil to change
    </div>
  </div>
</div>
                <div style={{ position: "relative", width: 92, height: 92 }}>
                  <img
                    src={avatarUrl || "https://via.placeholder.com/120?text=No+Avatar"}
                    alt="avatar"
                    style={{
                      width: 92,
                      height: 92,
                      objectFit: "cover",
                      borderRadius: "999px",
                      border: "2px solid rgba(255,255,255,0.10)",
                      background: "#0a0a0a",
                    }}
                  />

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onSelectFile}
                    style={{ display: "none" }}
                  />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      position: "absolute",
                      right: -2,
                      bottom: -2,
                      width: 32,
                      height: 32,
                      borderRadius: "999px",
                      background: "#ff2f2f",
                      border: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      boxShadow: "0 8px 18px rgba(255,47,47,0.25)",
                    }}
                    aria-label="Edit avatar"
                  >
                    <FiEdit2 size={16} />
                  </button>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
                    Profile picture
                  </div>
              
                </div>
              </div>

              {/* INPUTS GRID */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: 12,
                }}
              >
                {/* Username */}
                <div>
                  <label style={{ fontSize: 12, opacity: 0.85 }}>Username</label>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="yourname"
                    style={{
                      width: "100%",
                      padding: 12,
                      marginTop: 6,
                      borderRadius: 12,
                      background: "#0d0d0f",
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "white",
                      outline: "none",
                    }}
                  />
                </div>

                {/* Display Name */}
                <div>
                  <label style={{ fontSize: 12, opacity: 0.85 }}>Display Name</label>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Trent Rizzo"
                    style={{
                      width: "100%",
                      padding: 12,
                      marginTop: 6,
                      borderRadius: 12,
                      background: "#0d0d0f",
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "white",
                      outline: "none",
                    }}
                  />
                </div>

                {/* Handle */}
                <div>
                  <label style={{ fontSize: 12, opacity: 0.85 }}>Handle (@username)</label>
                  <input
                    value={handle}
                    onChange={(e) => onHandleChange(e.target.value)}
                    placeholder="armpal_trent"
                    style={{
                      width: "100%",
                      padding: 12,
                      marginTop: 6,
                      borderRadius: 12,
                      background: "#0d0d0f",
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "white",
                      outline: "none",
                    }}
                  />
                  {handleHelper ? (
                    <div style={{ marginTop: 6, fontSize: 12, color: handleHelper.color }}>
                      {handleHelper.text}
                    </div>
                  ) : (
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.55 }}>
                      3–20 chars. letters, numbers, underscores only.
                    </div>
                  )}
                </div>

                {/* Bio */}
                <div>
                  <label style={{ fontSize: 12, opacity: 0.85 }}>Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell people what you’re training for..."
                    rows={4}
                    style={{
                      width: "100%",
                      padding: 12,
                      marginTop: 6,
                      borderRadius: 12,
                      background: "#0d0d0f",
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "white",
                      outline: "none",
                      resize: "none",
                    }}
                  />
                </div>
              </div>

              {/* SAVE BUTTON */}
              <button
                onClick={saveProfile}
                style={{
                  width: "100%",
                  marginTop: 14,
                  padding: 14,
                  background: "#ff2f2f",
                  borderRadius: 14,
                  border: "none",
                  color: "white",
                  fontSize: 15,
                  fontWeight: 900,
                  cursor: "pointer",
                  boxShadow: "0 16px 28px rgba(255,47,47,0.18)",
                }}
              >
                Save Profile
              </button>
            </div>

            {/* QUICK SETTINGS PREVIEW (so “notifications” is visible even before opening drawer) */}
            <div
              style={{
                background: "#070708",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 18,
                padding: 16,
              }}
            >
              <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 10 }}>Quick Settings</div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 12px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "#0d0d0f",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>Notifications</div>
                  <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
                    {notifSupported
                      ? notifEnabled
                        ? "Enabled"
                        : "Disabled"
                      : "Not supported on this device/browser"}
                  </div>
                </div>

                <TogglePill on={notifEnabled} disabled={!notifSupported || notifBusy} onClick={toggleNotifications} />
              </div>
            </div>
          </div>

          {/* CROPPER OVERLAY */}
          {showCropper && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.86)",
                zIndex: 9999,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                padding: 18,
              }}
            >
              <div
                style={{
                  width: "92%",
                  maxWidth: 360,
                  height: 360,
                  background: "#000",
                  borderRadius: 16,
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
              >
                <Cropper
                  image={selectedImage}
                  crop={crop}
                  zoom={zoom}
                  cropShape="round"
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>

              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(e.target.value)}
                style={{ width: "86%", marginTop: 18 }}
              />

              <div style={{ marginTop: 16, display: "flex", gap: 12, width: "92%", maxWidth: 360 }}>
                <button
                  onClick={() => {
                    setShowCropper(false);
                    setSelectedImage(null);
                  }}
                  style={{
                    flex: 1,
                    padding: 12,
                    background: "#1a1a1a",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "white",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>

                <button
                  onClick={doSaveCroppedImage}
                  style={{
                    flex: 1,
                    padding: 12,
                    background: "#ff2f2f",
                    borderRadius: 14,
                    border: "none",
                    color: "white",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  {uploading ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          )}

          {/* SETTINGS DRAWER */}
          {settingsOpen && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.55)",
                zIndex: 9998,
                display: "flex",
                justifyContent: "flex-end",
              }}
              onClick={() => setSettingsOpen(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "74%",
                  maxWidth: 380,
                  minWidth: 270,
                  height: "100%",
                  background: "#0f0f10",
                  borderLeft: "1px solid rgba(255,255,255,0.12)",
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h2 style={{ fontSize: 18, fontWeight: 900 }}>Settings</h2>
                  <button
                    onClick={() => setSettingsOpen(false)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "rgba(255,255,255,0.75)",
                      fontSize: 26,
                      cursor: "pointer",
                    }}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                {/* NOTIFICATIONS ROW */}
                <div style={{ marginTop: 14 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 12px",
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "#0d0d0f",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <div style={{ fontSize: 14, fontWeight: 900 }}>Notifications</div>
                      <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
                        {notifSupported
                          ? notifEnabled
                            ? "On"
                            : "Off"
                          : "Not supported"}
                        {notifSupported && notifPermission === "denied" ? " • Permission denied" : ""}
                      </div>
                    </div>

                    <TogglePill on={notifEnabled} disabled={!notifSupported || notifBusy} onClick={toggleNotifications} />
                  </div>

                  {notifSupported ? (
                    <div style={{ fontSize: 11, opacity: 0.55, marginTop: 8, lineHeight: 1.35 }}>
                      Turn this ON to get chat message notifications. If iOS prompts you, hit <b>Allow</b>.
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, opacity: 0.55, marginTop: 8, lineHeight: 1.35 }}>
                      Push requires a supported browser + PWA install + service worker.
                    </div>
                  )}
                </div>

                {/* ACCOUNT */}
                <button
                  onClick={() => setShowAccountInfo((p) => !p)}
                  style={{
                    textAlign: "left",
                    padding: "12px 2px",
                    marginTop: 18,
                    background: "transparent",
                    border: "none",
                    color: "white",
                    fontSize: 14,
                    display: "flex",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  <span>Account</span>
                  <span style={{ opacity: 0.7 }}>{showAccountInfo ? "˄" : "˅"}</span>
                </button>

                {showAccountInfo && (
                  <div style={{ fontSize: 13, opacity: 0.9, paddingBottom: 12 }}>
                    <div style={{ opacity: 0.6, fontSize: 11 }}>Email</div>
                    <div style={{ wordBreak: "break-word" }}>{user?.email}</div>

                    <div style={{ height: 10 }} />

                    <div style={{ opacity: 0.6, fontSize: 11 }}>User ID</div>
                    <div style={{ wordBreak: "break-word", fontSize: 12 }}>{user?.id}</div>
                  </div>
                )}

                {/* SPACER */}
                <div style={{ flex: 1 }} />

                {/* LOG OUT */}
                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid rgba(255,47,47,0.6)",
                    background: "rgba(255,47,47,0.10)",
                    color: "#ff6b6b",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Log out
                </button>

                <div style={{ height: 10 }} />

                <div style={{ fontSize: 11, opacity: 0.45, textAlign: "center" }}>
                  ArmPal • Profile Settings
                </div>
              </div>
            </div>
          )}

          {/* LOGOUT CONFIRM MODAL */}
          {showLogoutConfirm && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.78)",
                zIndex: 9999,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: 20,
              }}
              onClick={() => setShowLogoutConfirm(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: "#111",
                  borderRadius: 16,
                  padding: 18,
                  width: "100%",
                  maxWidth: 360,
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
              >
                <h2 style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>Log out?</h2>

                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 14,
                    background: "#222",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "white",
                    marginBottom: 10,
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>

                <button
                  onClick={logout}
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 14,
                    background: "#ff2f2f",
                    border: "none",
                    color: "white",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Log out
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
