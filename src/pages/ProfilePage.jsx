// src/pages/ProfilePage.jsx
import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { supabase } from "../supabaseClient";
import Cropper from "react-easy-crop";
import {
  FiSettings,
  FiEdit2,
  FiBell,
  FiBellOff,
} from "react-icons/fi";

/* =========================================================
   PROFILE PAGE
   - NO FEATURES REMOVED
   - NOTIFICATIONS ADDED SAFELY
   ========================================================= */

export default function ProfilePage() {
  /* ---------------- AUTH ---------------- */
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ---------------- PROFILE FIELDS ---------------- */
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [handleStatus, setHandleStatus] = useState(null);

  /* ---------------- NOTIFICATIONS ---------------- */
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notifSupported, setNotifSupported] = useState(true);
  const [notifBusy, setNotifBusy] = useState(false);

  /* ---------------- UI ---------------- */
  const [uploading, setUploading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showAccountInfo, setShowAccountInfo] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  /* ---------------- CROPPER ---------------- */
  const [showCropper, setShowCropper] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const fileInputRef = useRef(null);

  /* =========================================================
     LOAD PROFILE
     ========================================================= */
  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
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

      setUsername(data.username || "");
      setBio(data.bio || "");
      setAvatarUrl(data.avatar_url || "");

      setDisplayName(data.display_name || "");
      setHandle(data.handle || "");

      setNotificationsEnabled(
        data.notifications_enabled === true
      );

      // Feature detection
      if (!("Notification" in window)) {
        setNotifSupported(false);
      }
    } catch (err) {
      console.error("Error loading profile:", err);
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     HANDLE VALIDATION
     ========================================================= */
  function validateHandle(h) {
    return /^[a-z0-9_]{3,20}$/.test(h);
  }

  async function onHandleChange(val) {
    const clean = val.toLowerCase();
    setHandle(clean);

    if (!validateHandle(clean)) {
      setHandleStatus("invalid");
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("handle", clean)
      .neq("id", user?.id);

    setHandleStatus(data?.length ? "taken" : "valid");
  }

  /* =========================================================
     NOTIFICATIONS TOGGLE
     ========================================================= */
  async function toggleNotifications() {
    if (!user || !notifSupported || notifBusy) return;

    setNotifBusy(true);

    try {
      if (!notificationsEnabled) {
        // Request permission
        const permission = await Notification.requestPermission();

        if (permission !== "granted") {
          alert("Notifications were blocked.");
          setNotifBusy(false);
          return;
        }
      }

      const next = !notificationsEnabled;
      setNotificationsEnabled(next);

      await supabase
        .from("profiles")
        .update({ notifications_enabled: next })
        .eq("id", user.id);
    } catch (err) {
      console.error("Notification toggle error:", err);
    } finally {
      setNotifBusy(false);
    }
  }

  /* =========================================================
     IMAGE CROPPING (UNCHANGED)
     ========================================================= */
  const getCroppedImg = async (imageSrc, pixelCrop) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageSrc;

      img.onload = () => {
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
          (blob) => (blob ? resolve(blob) : reject()),
          "image/jpeg",
          0.9
        );
      };

      img.onerror = reject;
    });

  const onCropComplete = useCallback((_, p) => {
    setCroppedAreaPixels(p);
  }, []);

  function onSelectFile(e) {
    const f = e.target.files[0];
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
      setUploading(true);

      const croppedBlob = await getCroppedImg(
        selectedImage,
        croppedAreaPixels
      );

      const path = `${user.id}-${Date.now()}.jpg`;

      await supabase.storage
        .from("avatars")
        .upload(path, croppedBlob, { upsert: true });

      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);

      setAvatarUrl(data.publicUrl);
      setShowCropper(false);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  }

  /* =========================================================
     SAVE PROFILE
     ========================================================= */
  async function saveProfile() {
    if (!user) return;

    if (handleStatus === "invalid" || handleStatus === "taken") {
      alert("Fix handle issues first.");
      return;
    }

    await supabase.from("profiles").upsert({
      id: user.id,
      username,
      bio,
      avatar_url: avatarUrl,
      display_name: displayName,
      handle: handle || null,
      notifications_enabled: notificationsEnabled,
    });

    alert("Profile saved!");
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  /* =========================================================
     UI
     ========================================================= */
  if (loading) {
    return (
      <p style={{ padding: 20, opacity: 0.7 }}>
        Loading profile…
      </p>
    );
  }

  return (
    <div className="fade-in">
      <div
        style={{
          padding: "20px 16px 100px",
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>
            Profile
          </h1>

          <button
            onClick={() => setSettingsOpen(true)}
            style={{
              background: "#111",
              borderRadius: "999px",
              border: "1px solid rgba(255,255,255,0.12)",
              width: 34,
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FiSettings size={18} />
          </button>
        </div>

        {/* SAVE */}
        <button
          onClick={saveProfile}
          style={{
            width: "100%",
            padding: 12,
            background: "#ff2f2f",
            borderRadius: 10,
            border: "none",
            color: "white",
            fontWeight: 600,
          }}
        >
          Save Profile
        </button>
      </div>

      {/* SETTINGS PANEL */}
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
              width: "70%",
              maxWidth: 360,
              background: "#0f0f10",
              padding: 16,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <h2
              style={{
                fontSize: 18,
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
              Settings
            </h2>

            {/* NOTIFICATIONS */}
            <button
              onClick={toggleNotifications}
              disabled={!notifSupported || notifBusy}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 6px",
                background: "transparent",
                border: "none",
                color: "white",
                fontSize: 14,
              }}
            >
              <span style={{ display: "flex", gap: 8 }}>
                {notificationsEnabled ? (
                  <FiBell />
                ) : (
                  <FiBellOff />
                )}
                Notifications
              </span>

              <span
                style={{
                  width: 42,
                  height: 22,
                  borderRadius: 999,
                  background: notificationsEnabled
                    ? "#22c55e"
                    : "#333",
                  position: "relative",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    left: notificationsEnabled ? 22 : 2,
                    width: 18,
                    height: 18,
                    background: "#fff",
                    borderRadius: "50%",
                    transition: "0.2s",
                  }}
                />
              </span>
            </button>

            <div style={{ flex: 1 }} />

            <button
              onClick={() => setShowLogoutConfirm(true)}
              style={{
                padding: 10,
                borderRadius: 8,
                border: "1px solid rgba(255,47,47,0.6)",
                background: "rgba(255,47,47,0.08)",
                color: "#ff4b4b",
                fontWeight: 600,
              }}
            >
              Log out
            </button>
          </div>
        </div>
      )}

      {/* LOGOUT CONFIRM */}
      {showLogoutConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#111",
              borderRadius: 12,
              padding: 18,
              width: "90%",
              maxWidth: 360,
            }}
          >
            <h2 style={{ fontSize: 18 }}>Log out?</h2>
            <button
              onClick={logout}
              style={{
                marginTop: 12,
                width: "100%",
                padding: 10,
                background: "#ff2f2f",
                color: "#fff",
                border: "none",
                borderRadius: 8,
              }}
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
