// src/pages/ProfilePage.jsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";
import Cropper from "react-easy-crop";
import { FiSettings, FiEdit2 } from "react-icons/fi";

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  // CROPPER STATES
  const [showCropper, setShowCropper] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null); // dataURL
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  // SETTINGS DRAWER
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showAccountInfo, setShowAccountInfo] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Hidden file input for avatar edit icon
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      if (!user) return;

      setUser(user);

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      setUsername(data.username || "");
      setBio(data.bio || "");
      setAvatarUrl(data.avatar_url || "");
    } catch (err) {
      console.error("Error loading profile:", err);
    } finally {
      setLoading(false);
    }
  }

  // PWA-safe: imageSrc is a dataURL, safe for canvas
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
                if (!blob) {
                  reject(new Error("Canvas is empty"));
                  return;
                }
                resolve(blob);
              },
              "image/jpeg",
              0.9
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

  // File reader to dataURL
  function onSelectFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result); // base64 dataURL
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
  }

  async function doSaveCroppedImage() {
    try {
      if (!selectedImage || !croppedAreaPixels) {
        alert("Please adjust the crop before saving.");
        return;
      }

      setUploading(true);

      const croppedBlob = await getCroppedImg(selectedImage, croppedAreaPixels);

      const fileExt = "jpg";
      const filePath = `${user.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, croppedBlob, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
      setShowCropper(false);
    } catch (err) {
      console.error("Crop/Upload error:", err);
      alert("Error processing image: " + (err?.message || String(err)));
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    setAvatarUrl("");
  }

  async function saveProfile() {
    try {
      if (!user) return;

      const updates = {
        id: user.id,
        username,
        bio,
        avatar_url: avatarUrl,
      };

      const { error } = await supabase.from("profiles").upsert(updates);
      if (error) throw error;

      alert("Profile saved successfully!");
    } catch (err) {
      console.error("Save error:", err);
      alert("Error saving profile: " + (err?.message || String(err)));
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  // Open settings drawer; reset inner toggles
  function openSettings() {
    setSettingsOpen(true);
    setShowAccountInfo(false);
  }

  return (
    <>
      {loading ? (
        <p style={{ padding: "20px", opacity: 0.7 }}>Loading profile...</p>
      ) : (
        <div className="fade-in">
          <div
            style={{
              padding: "20px 16px 100px",
              maxWidth: "900px",
              margin: "0 auto",
            }}
          >
            {/* HEADER ROW WITH SETTINGS ICON */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h1
                style={{
                  fontSize: "22px",
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                Profile
              </h1>

              <button
                onClick={openSettings}
                style={{
                  background: "#111",
                  borderRadius: "999px",
                  border: "1px solid rgba(255,255,255,0.12)",
                  width: 34,
                  height: 34,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <FiSettings size={18} />
              </button>
            </div>

            {/* AVATAR + USER INFO (avatar top-left) */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 16,
                marginBottom: 24,
              }}
            >
              {/* Avatar with edit icon bottom-right */}
              <div style={{ position: "relative", width: 110, height: 110 }}>
                <img
                  src={
                    avatarUrl ||
                    "https://via.placeholder.com/120?text=No+Avatar"
                  }
                  alt="Avatar"
                  style={{
                    width: "110px",
                    height: "110px",
                    objectFit: "cover",
                    borderRadius: "999px",
                    border: "2px solid rgba(255,255,255,0.1)",
                  }}
                />

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onSelectFile}
                  style={{ display: "none" }}
                  disabled={uploading}
                />

                {/* Edit pencil icon overlay */}
                <button
                  type="button"
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  style={{
                    position: "absolute",
                    right: 0,
                    bottom: 0,
                    width: 30,
                    height: 30,
                    borderRadius: "999px",
                    border: "none",
                    background: "#ff2f2f",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: uploading ? "not-allowed" : "pointer",
                    boxShadow: "0 0 8px rgba(0,0,0,0.4)",
                  }}
                >
                  <FiEdit2 size={16} />
                </button>
              </div>

              {/* Username + Bio inputs stacked */}
              <div style={{ flex: 1 }}>
                {/* USERNAME */}
                <div style={{ marginBottom: "16px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontSize: "13px",
                      opacity: 0.9,
                    }}
                  >
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "8px",
                      background: "#0d0d0d",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "white",
                    }}
                  />
                </div>

                {/* BIO */}
                <div style={{ marginBottom: "16px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "6px",
                      fontSize: "13px",
                      opacity: 0.9,
                    }}
                  >
                    Bio
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows="3"
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "8px",
                      background: "#0d0d0d",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "white",
                      resize: "none",
                    }}
                  ></textarea>
                </div>
              </div>
            </div>

            {/* SAVE BUTTON */}
            <button
              onClick={saveProfile}
              style={{
                width: "100%",
                padding: "12px",
                background: "#ff2f2f",
                borderRadius: "10px",
                border: "none",
                color: "white",
                fontSize: "15px",
                fontWeight: 600,
                marginBottom: "14px",
                cursor: "pointer",
              }}
            >
              Save Profile
            </button>
          </div>

          {/* CROPPER OVERLAY (unchanged logic) */}
          {showCropper && (
            <div
              style={{
                position: "fixed",
                inset: "0",
                background: "rgba(0,0,0,0.8)",
                zIndex: 9999,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                padding: "20px",
              }}
            >
              <div
                style={{
                  width: "90%",
                  maxWidth: "350px",
                  height: "350px",
                  background: "#000",
                  borderRadius: "12px",
                  position: "relative",
                  overflow: "hidden",
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
                style={{ width: "80%", marginTop: "20px" }}
              />

              <div
                style={{ marginTop: "20px", display: "flex", gap: "12px" }}
              >
                <button
                  onClick={() => setShowCropper(false)}
                  style={{
                    padding: "10px 20px",
                    background: "#222",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "10px",
                    color: "white",
                    fontSize: "14px",
                  }}
                >
                  Cancel
                </button>

                <button
                  onClick={doSaveCroppedImage}
                  style={{
                    padding: "10px 20px",
                    background: "#ff2f2f",
                    borderRadius: "10px",
                    border: "none",
                    color: "white",
                    fontSize: "14px",
                    fontWeight: 600,
                  }}
                  disabled={uploading}
                >
                  {uploading ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          )}

          {/* SETTINGS DRAWER (slides over right side) */}
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
                  width: "68%",
                  maxWidth: 360,
                  minWidth: 260,
                  height: "100%",
                  background: "#0f0f10",
                  borderLeft: "1px solid rgba(255,255,255,0.12)",
                  padding: "16px 16px 20px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 18,
                      fontWeight: 600,
                    }}
                  >
                    Settings
                  </h2>
                  <button
                    onClick={() => setSettingsOpen(false)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "rgba(255,255,255,0.7)",
                      fontSize: 24,
                      lineHeight: 1,
                      cursor: "pointer",
                    }}
                  >
                    ×
                  </button>
                </div>

                {/* ACCOUNT ROW (click to reveal email) */}
                <button
                  onClick={() =>
                    setShowAccountInfo((prev) => !prev)
                  }
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 2px",
                    border: "none",
                    background: "transparent",
                    color: "white",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  <span>Account</span>
                  <span style={{ fontSize: 18, opacity: 0.8 }}>
                    {showAccountInfo ? "˄" : "˅"}
                  </span>
                </button>

                {showAccountInfo && (
                  <div
                    style={{
                      fontSize: 13,
                      opacity: 0.85,
                      padding: "4px 2px 12px",
                      borderBottom:
                        "1px solid rgba(255,255,255,0.12)",
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        opacity: 0.6,
                        marginBottom: 2,
                      }}
                    >
                      Email
                    </div>
                    <div>{user?.email || "Unknown"}</div>
                  </div>
                )}

                {/* spacer to push logout to bottom */}
                <div style={{ flex: 1 }} />

                {/* LOGOUT BUTTON (opens confirm modal) */}
                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,47,47,0.6)",
                    background: "rgba(255,47,47,0.08)",
                    color: "#ff4b4b",
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: "pointer",
                    marginTop: 8,
                  }}
                >
                  Log out
                </button>
              </div>
            </div>
          )}

          {/* LOGOUT CONFIRM MODAL */}
          {showLogoutConfirm && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.75)",
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
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.18)",
                  padding: 18,
                  width: "100%",
                  maxWidth: 360,
                }}
              >
                <h2
                  style={{
                    margin: "0 0 10px",
                    fontSize: 18,
                    fontWeight: 600,
                  }}
                >
                  Log out?
                </h2>
                <p
                  style={{
                    fontSize: 13,
                    opacity: 0.8,
                    margin: "0 0 16px",
                  }}
                >
                  Are you sure you want to log out of this account?
                </p>

                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 10,
                    border: "none",
                    background: "#333",
                    color: "white",
                    marginBottom: 10,
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  Cancel
                </button>

                <button
                  onClick={logout}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 10,
                    border: "none",
                    background: "#ff2f2f",
                    color: "white",
                    fontWeight: 600,
                    fontSize: 14,
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
