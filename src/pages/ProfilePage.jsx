// src/pages/ProfilePage.jsx
import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import Cropper from "react-easy-crop";

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  // CROPPER STATES
  const [showCropper, setShowCropper] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  // SETTINGS DRAWER
  const [showSettings, setShowSettings] = useState(false);

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

  function onSelectFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
  }

  async function doSaveCroppedImage() {
    try {
      if (!selectedImage || !croppedAreaPixels) {
        alert("Please adjust crop first.");
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
      alert("Error: " + err.message);
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

      alert("Profile saved!");
    } catch (err) {
      console.error("Save error:", err);
      alert("Error saving: " + err.message);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  return (
    <>
      {loading ? (
        <p style={{ padding: 20, opacity: 0.7 }}>Loading profile...</p>
      ) : (
        <div className="fade-in">
          <div
            style={{
              padding: "20px 16px 100px",
              maxWidth: 900,
              margin: "0 auto",
              position: "relative",
            }}
          >
            {/* SETTINGS ICON */}
            <div
              onClick={() => setShowSettings(true)}
              style={{
                position: "absolute",
                top: 20,
                right: 16,
                fontSize: 26,
                cursor: "pointer",
                opacity: 0.9,
              }}
            >
              ⚙️
            </div>

            <h1
              style={{
                fontSize: 22,
                marginBottom: 16,
                fontWeight: 700,
              }}
            >
              Profile
            </h1>

            {/* AVATAR WITH EDIT ICON */}
            <div
              style={{
                width: "120px",
                height: "120px",
                marginBottom: 20,
                position: "relative",
              }}
            >
              <img
                src={
                  avatarUrl ||
                  "https://via.placeholder.com/120?text=No+Avatar"
                }
                alt="Avatar"
                style={{
                  width: "120px",
                  height: "120px",
                  objectFit: "cover",
                  borderRadius: "999px",
                  border: "2px solid rgba(255,255,255,0.1)",
                }}
              />

              {/* EDIT ICON */}
              <label
                style={{
                  position: "absolute",
                  bottom: 4,
                  right: 4,
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.65)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  backdropFilter: "blur(4px)",
                }}
              >
                <span style={{ fontSize: 16 }}>✏️</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={onSelectFile}
                  style={{ display: "none" }}
                  disabled={uploading}
                />
              </label>
            </div>

            {/* REMOVE AVATAR BUTTON */}
            {avatarUrl && (
              <button
                onClick={removeAvatar}
                style={{
                  padding: "6px 12px",
                  fontSize: 13,
                  background: "#331111",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  color: "white",
                  cursor: "pointer",
                  marginBottom: 20,
                }}
              >
                Remove Avatar
              </button>
            )}

            {/* USERNAME */}
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "block",
                  marginBottom: 6,
                  fontSize: 13,
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
                  padding: 10,
                  borderRadius: 8,
                  background: "#0d0d0d",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "white",
                }}
              />
            </div>

            {/* BIO */}
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: "block",
                  marginBottom: 6,
                  fontSize: 13,
                  opacity: 0.9,
                }}
              >
                Bio
              </label>
              <textarea
                rows="3"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 8,
                  background: "#0d0d0d",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "white",
                  resize: "none",
                }}
              />
            </div>

            <button
              onClick={saveProfile}
              style={{
                width: "100%",
                padding: 12,
                background: "#ff2f2f",
                borderRadius: 10,
                border: "none",
                color: "white",
                fontSize: 15,
                fontWeight: 600,
                marginBottom: 14,
              }}
            >
              Save Profile
            </button>

            {/* SETTINGS DRAWER */}
            {showSettings && (
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  right: 0,
                  height: "100%",
                  width: "65%",
                  background: "#0d0d0d",
                  borderLeft: "1px solid rgba(255,255,255,0.1)",
                  padding: 20,
                  zIndex: 9999,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Close */}
                <div
                  onClick={() => setShowSettings(false)}
                  style={{
                    fontSize: 24,
                    marginBottom: 20,
                    cursor: "pointer",
                    alignSelf: "flex-end",
                  }}
                >
                  ✖
                </div>

                <h2 style={{ margin: "0 0 10px" }}>Account</h2>

                <p
                  style={{
                    opacity: 0.7,
                    marginBottom: 30,
                    wordBreak: "break-all",
                  }}
                >
                  {user?.email}
                </p>

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* LOGOUT */}
                <button
                  onClick={logout}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: "#330000",
                    borderRadius: 10,
                    border: "1px solid rgba(255,0,0,0.4)",
                    color: "white",
                    fontSize: 14,
                    fontWeight: 600,
                    marginBottom: 12,
                  }}
                >
                  Logout
                </button>
              </div>
            )}

            {/* CROPPER */}
            {showCropper && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.8)",
                  zIndex: 9999,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  padding: 20,
                }}
              >
                <div
                  style={{
                    width: "90%",
                    maxWidth: 350,
                    height: 350,
                    background: "#000",
                    borderRadius: 12,
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
                  style={{ width: "80%", marginTop: 20 }}
                />

                <div
                  style={{ marginTop: 20, display: "flex", gap: 12 }}
                >
                  <button
                    onClick={() => setShowCropper(false)}
                    style={{
                      padding: "10px 20px",
                      background: "#222",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: 10,
                      color: "white",
                      fontSize: 14,
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    onClick={doSaveCroppedImage}
                    disabled={uploading}
                    style={{
                      padding: "10px 20px",
                      background: "#ff2f2f",
                      borderRadius: 10,
                      border: "none",
                      color: "white",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    {uploading ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
