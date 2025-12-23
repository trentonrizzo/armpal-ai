// src/pages/ProfilePage.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import Cropper from "react-easy-crop";
import { FiSettings, FiEdit2 } from "react-icons/fi";
import SettingsOverlay from "../settings/SettingsOverlay";

/* ============================
   UI HELPERS
============================ */

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
      <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.1 }}>{value}</div>
      {sub ? <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>{sub}</div> : null}
    </div>
  );
}

function ToggleRow({ title, subtitle, right }) {
  return (
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
      <div style={{ paddingRight: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 900 }}>{title}</div>
        {subtitle ? (
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>{subtitle}</div>
        ) : null}
      </div>
      {right}
    </div>
  );
}

/* ============================
   MAIN
============================ */

export default function ProfilePage() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Profile fields
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [handleStatus, setHandleStatus] = useState(null); // null | "invalid" | "taken" | "valid"
  const [handleLocked, setHandleLocked] = useState(false);
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // Stats
  const [stats, setStats] = useState({ prs: 0, workouts: 0, measurements: 0 });

  // Avatar menu + pickers
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);

  const inputPhotoRef = useRef(null);   // choose photo
  const inputCameraRef = useRef(null);  // take photo (mobile)
  const inputFileRef = useRef(null);    // choose file

  // Cropper
  const [uploading, setUploading] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
useEffect(() => {
  if (!user?.id) return;

  let heartbeat;

  const setOnline = async () => {
    await supabase
      .from("profiles")
      .update({
        is_online: true,
        last_active: new Date().toISOString(),
      })
      .eq("id", user.id);
  };

  const setOffline = async () => {
    await supabase
      .from("profiles")
      .update({
        is_online: false,
        last_seen: new Date().toISOString(),
      })
      .eq("id", user.id);
  };

  // mark online immediately
  setOnline();

  // heartbeat every 30s while app is open
  heartbeat = setInterval(setOnline, 30000);

  // handle tab close / app background
  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      setOffline();
    } else {
      setOnline();
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);

  return () => {
    clearInterval(heartbeat);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    setOffline();
  };
}, [user?.id]);

  async function loadProfile() {
    try {
      setLoading(true);

      const { data: auth } = await supabase.auth.getUser();
      const authUser = auth?.user;
      if (!authUser) return;

      setUser(authUser);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, handle, bio, avatar_url")
        .eq("id", authUser.id)
        .single();

      if (error) throw error;

      setDisplayName(data?.display_name || "");
      setHandle(data?.handle || "");
      setBio(data?.bio || "");
      setAvatarUrl(data?.avatar_url || "");

      // Handle is one-time set: once it exists, lock it.
      const existing = (data?.handle || "").trim();
      setHandleLocked(!!existing);
      setHandleStatus(existing ? "valid" : null);

      await loadStats(authUser.id);
    } catch (err) {
      console.error("Error loading profile:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats(userId) {
    const next = { prs: 0, workouts: 0, measurements: 0 };

    try {
      const { count } = await supabase
        .from("prs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      next.prs = count || 0;
    } catch {}

    try {
      const { count } = await supabase
        .from("workouts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      next.workouts = count || 0;
    } catch {}

    try {
      const { count } = await supabase
        .from("measurements")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      next.measurements = count || 0;
    } catch {}

    setStats(next);
  }

  /* ============================
     HANDLE VALIDATION (required, unique, lowercase, 3-20, underscores ok)
     - If handle already exists: it cannot change (locked).
  ============================ */

  function validateHandle(h) {
    return /^[a-z0-9_]{3,20}$/.test(h);
  }

  async function onHandleChange(val) {
    if (handleLocked) return;

    const clean = (val || "").toLowerCase();
    setHandle(clean);

    if (!clean) {
      setHandleStatus(null);
      return;
    }

    if (!validateHandle(clean)) {
      setHandleStatus("invalid");
      return;
    }

    if (!user?.id) {
      setHandleStatus("valid");
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("handle", clean)
      .neq("id", user.id);

    if (data?.length) setHandleStatus("taken");
    else setHandleStatus("valid");
  }

  const handleHelper = useMemo(() => {
    if (!handle) return null;

    if (handleLocked) {
      return { text: "Handle is locked (cannot be changed).", color: "rgba(255,255,255,0.55)" };
    }

    if (handleStatus === "invalid")
      return { text: "Only letters, numbers, underscores (3–20).", color: "#ff5a5a" };
    if (handleStatus === "taken") return { text: "Handle already taken.", color: "#ff5a5a" };
    if (handleStatus === "valid") return { text: "Available ✓", color: "#4ade80" };
    return null;
  }, [handle, handleStatus, handleLocked]);

  /* ============================
     AVATAR CROP + UPLOAD
     - Pencil only opens action sheet
     - Round crop
     - Buttons are in TOP BAR so they never get covered
  ============================ */

  const onCropComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  function openAvatarMenu() {
    setAvatarMenuOpen(true);
  }

  function closeAvatarMenu() {
    setAvatarMenuOpen(false);
  }

  function onPickFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result);
      setShowCropper(true);
      setAvatarMenuOpen(false);
    };
    reader.readAsDataURL(f);

    // allow picking same file twice
    e.target.value = "";
  }

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

  async function doSaveCroppedImage() {
    try {
      if (!user) return;
      if (!selectedImage || !croppedAreaPixels) return;

      setUploading(true);

      const croppedBlob = await getCroppedImg(selectedImage, croppedAreaPixels);
      const filePath = `${user.id}-${Date.now()}.jpg`;

      const { error } = await supabase.storage.from("avatars").upload(filePath, croppedBlob, {
        upsert: true,
        contentType: "image/jpeg",
      });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const publicUrl = urlData?.publicUrl || "";

      setAvatarUrl(publicUrl);

      await supabase.from("profiles").upsert({ id: user.id, avatar_url: publicUrl });

      setShowCropper(false);
      setSelectedImage(null);
    } catch (err) {
      console.error(err);
      alert("Avatar upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    try {
      if (!user) return;
      setAvatarUrl("");
      await supabase.from("profiles").upsert({ id: user.id, avatar_url: "" });
      setAvatarMenuOpen(false);
    } catch (e) {
      alert("Failed to remove avatar");
    }
  }

  /* ============================
     SAVE PROFILE
     - Handle is REQUIRED if not locked yet
  ============================ */

  async function saveProfile() {
    try {
      if (!user) return;

      // Handle required, unless already set & locked
      if (!handleLocked) {
        if (!handle || !handle.trim()) {
          alert("Handle is required.");
          return;
        }
        if (handleStatus === "invalid") {
          alert("Handle format invalid.");
          return;
        }
        if (handleStatus === "taken") {
          alert("Handle already taken.");
          return;
        }
        // If user typed valid format but status hasn't updated yet:
        if (handleStatus !== "valid") {
          // force validate now
          if (!validateHandle(handle)) {
            alert("Handle format invalid.");
            return;
          }
          const { data } = await supabase
            .from("profiles")
            .select("id")
            .eq("handle", handle)
            .neq("id", user.id);

          if (data?.length) {
            alert("Handle already taken.");
            setHandleStatus("taken");
            return;
          }
        }
      }

      const updates = {
        id: user.id,
        display_name: displayName || "",
        bio: bio || "",
        avatar_url: avatarUrl || "",
      };

      // Handle only set once
      if (!handleLocked) {
        updates.handle = handle.trim();
      }

      const { error } = await supabase.from("profiles").upsert(updates);
      if (error) throw error;

      // After first save with handle, lock it
      if (!handleLocked && updates.handle) {
        setHandleLocked(true);
        setHandleStatus("valid");
      }

      alert("Profile saved!");
      await loadProfile();
    } catch (err) {
      console.error(err);
      alert("Error saving profile");
    }
  }

  /* ============================
     RENDER
  ============================ */

  return (
    <>
      {loading ? (
        <p style={{ padding: 20, opacity: 0.75 }}>Loading profile...</p>
      ) : (
        <div className="fade-in">
          <div style={{ padding: "20px 16px 110px", maxWidth: 900, margin: "0 auto" }}>
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
                <div style={{ fontSize: 12, opacity: 0.6 }}>{user?.email || ""}</div>
              </div>

              <button
                onClick={() => setSettingsOpen(true)}
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

            {/* PROFILE CARD */}
            <div
              style={{
                background: "#070708",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 18,
                padding: 16,
                marginBottom: 16,
              }}
            >
              {/* AVATAR ROW */}
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

                  {/* Hidden pickers */}
                  <input
                    ref={inputPhotoRef}
                    type="file"
                    accept="image/*"
                    onChange={onPickFile}
                    style={{ display: "none" }}
                  />
                  <input
                    ref={inputCameraRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={onPickFile}
                    style={{ display: "none" }}
                  />
                  <input
                    ref={inputFileRef}
                    type="file"
                    accept="image/*"
                    onChange={onPickFile}
                    style={{ display: "none" }}
                  />

                  {/* Pencil only */}
                  <button
                    onClick={openAvatarMenu}
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
                    aria-label="Edit avatar"
                  >
                    <FiEdit2 size={16} color="#ffffff" />
                  </button>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Profile picture</div>
                  <div style={{ fontSize: 12, opacity: 0.45, marginTop: 4 }}>
                    Tap the pencil to change
                  </div>
                </div>
              </div>

              {/* INPUTS */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
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
                  <label style={{ fontSize: 12, opacity: 0.85 }}>
                    Handle (required) <span style={{ opacity: 0.6 }}>(@username)</span>
                  </label>
                  <input
                    value={handle}
                    onChange={(e) => onHandleChange(e.target.value)}
                    placeholder="armpal_trent"
                    disabled={handleLocked}
                    style={{
                      width: "100%",
                      padding: 12,
                      marginTop: 6,
                      borderRadius: 12,
                      background: handleLocked ? "#0a0a0a" : "#0d0d0f",
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "white",
                      outline: "none",
                      opacity: handleLocked ? 0.7 : 1,
                      cursor: handleLocked ? "not-allowed" : "text",
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
          </div>

          {/* ================= AVATAR ACTION SHEET ================= */}
          {avatarMenuOpen && (
            <div
              onClick={closeAvatarMenu}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.70)",
                zIndex: 9998,
                display: "flex",
                justifyContent: "center",
                alignItems: "flex-end",
                padding: 16,
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "100%",
                  maxWidth: 420,
                  background: "#0f0f10",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 18,
                  padding: 12,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 10 }}>
                  Edit profile picture
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <button
                    onClick={() => inputPhotoRef.current?.click()}
                    style={{
                      width: "100%",
                      padding: 14,
                      borderRadius: 14,
                      background: "#111",
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "white",
                      fontWeight: 900,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    Pick from Photos
                  </button>

                  <button
                    onClick={() => inputCameraRef.current?.click()}
                    style={{
                      width: "100%",
                      padding: 14,
                      borderRadius: 14,
                      background: "#111",
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "white",
                      fontWeight: 900,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    Take a Picture
                  </button>

                  <button
                    onClick={() => inputFileRef.current?.click()}
                    style={{
                      width: "100%",
                      padding: 14,
                      borderRadius: 14,
                      background: "#111",
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "white",
                      fontWeight: 900,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    Choose from Files
                  </button>

                  <button
                    onClick={removeAvatar}
                    style={{
                      width: "100%",
                      padding: 14,
                      borderRadius: 14,
                      background: "rgba(255,47,47,0.10)",
                      border: "1px solid rgba(255,47,47,0.35)",
                      color: "#ff6b6b",
                      fontWeight: 900,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    Remove Picture
                  </button>

                  <button
                    onClick={closeAvatarMenu}
                    style={{
                      width: "100%",
                      padding: 14,
                      borderRadius: 14,
                      background: "#1a1a1a",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "white",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================= CROPPER OVERLAY (TOP BUTTONS) ================= */}
          {showCropper && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.90)",
                zIndex: 9999,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* TOP BAR (buttons never covered) */}
              <div
                style={{
                  height: 64,
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderBottom: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(0,0,0,0.92)",
                }}
              >
                <button
                  onClick={() => {
                    setShowCropper(false);
                    setSelectedImage(null);
                  }}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: "#1a1a1a",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "white",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>

                <div style={{ fontWeight: 900, opacity: 0.9 }}>Crop Photo</div>

                <button
                  onClick={doSaveCroppedImage}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: "#ff2f2f",
                    border: "none",
                    color: "white",
                    fontWeight: 900,
                    cursor: "pointer",
                    opacity: uploading ? 0.8 : 1,
                  }}
                >
                  {uploading ? "Saving..." : "Save"}
                </button>
              </div>

              {/* CROPPER AREA */}
              <div style={{ flex: 1, position: "relative" }}>
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

              {/* ZOOM SLIDER */}
              <div
                style={{
                  padding: "12px 18px 18px",
                  borderTop: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(0,0,0,0.92)",
                }}
              >
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* SETTINGS OVERLAY (separate file, safe) */}
      <SettingsOverlay open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
