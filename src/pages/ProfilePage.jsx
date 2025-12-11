// src/pages/ProfilePage.jsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";
import Cropper from "react-easy-crop";
import { FiSettings, FiEdit2 } from "react-icons/fi";

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // EXISTING FIELDS
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // NEW FIELDS ADDED SAFELY
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [handleStatus, setHandleStatus] = useState(null); // valid, invalid, taken

  const [uploading, setUploading] = useState(false);

  // CROPPER STATES
  const [showCropper, setShowCropper] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null); 
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  // SETTINGS
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showAccountInfo, setShowAccountInfo] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const fileInputRef = useRef(null);

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

      // EXISTING
      setUsername(data.username || "");
      setBio(data.bio || "");
      setAvatarUrl(data.avatar_url || "");

      // NEW
      setDisplayName(data.display_name || "");
      setHandle(data.handle || "");

    } catch (err) {
      console.error("Error loading profile:", err);
    } finally {
      setLoading(false);
    }
  }

  // HANDLE VALIDATION
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

    if (data?.length) {
      setHandleStatus("taken");
    } else {
      setHandleStatus("valid");
    }
  }

  // CROPPING LOGIC UNCHANGED
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
                  reject(new Error("Canvas empty"));
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

      const croppedBlob = await getCroppedImg(selectedImage, croppedAreaPixels);
      const filePath = `${user.id}-${Date.now()}.jpg`;

      const { error } = await supabase.storage
        .from("avatars")
        .upload(filePath, croppedBlob, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      setAvatarUrl(urlData.publicUrl);
      setShowCropper(false);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    setAvatarUrl("");
  }

  // SAVE PROFILE (MERGED)
  async function saveProfile() {
    try {
      if (!user) return;

      if (handleStatus === "invalid") {
        alert("Handle format invalid.");
        return;
      }

      if (handleStatus === "taken") {
        alert("Handle already taken.");
        return;
      }

      const updates = {
        id: user.id,
        username,
        bio,
        avatar_url: avatarUrl,

        // NEW FIELDS
        display_name: displayName,
        handle: handle || null,
      };

      const { error } = await supabase.from("profiles").upsert(updates);
      if (error) throw error;

      alert("Profile saved!");
    } catch (err) {
      alert("Error saving profile: " + err.message);
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

  return (
    <>
      {loading ? (
        <p style={{ padding: 20, opacity: 0.7 }}>Loading profile...</p>
      ) : (
        <div className="fade-in">
          <div style={{ padding: "20px 16px 100px", maxWidth: 900, margin: "0 auto" }}>
            
            {/* HEADER */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700 }}>Profile</h1>

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
                }}
              >
                <FiSettings size={18} />
              </button>
            </div>

            {/* AVATAR + FIELDS */}
            <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
              
              {/* Avatar unchanged */}
              <div style={{ position: "relative", width: 110, height: 110 }}>
                <img
                  src={avatarUrl || "https://via.placeholder.com/120?text=No+Avatar"}
                  style={{
                    width: 110,
                    height: 110,
                    objectFit: "cover",
                    borderRadius: "999px",
                    border: "2px solid rgba(255,255,255,0.1)",
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
                    right: 0,
                    bottom: 0,
                    width: 30,
                    height: 30,
                    borderRadius: "999px",
                    background: "#ff2f2f",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <FiEdit2 size={16} />
                </button>
              </div>

              <div style={{ flex: 1 }}>
                
                {/* EXISTING USERNAME INPUT */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 13, opacity: 0.9 }}>Username</label>
                  <input
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

                {/* NEW: DISPLAY NAME */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 13, opacity: 0.9 }}>Display Name</label>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
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

                {/* NEW: HANDLE */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 13, opacity: 0.9 }}>Handle (@username)</label>
                  <input
                    value={handle}
                    onChange={(e) => onHandleChange(e.target.value)}
                    style={{
                      width: "100%",
                      padding: 10,
                      borderRadius: 8,
                      background: "#0d0d0d",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "white",
                    }}
                  />

                  {handleStatus === "invalid" && (
                    <p style={{ color: "red", fontSize: 12, marginTop: 4 }}>
                      Only letters, numbers, underscores (3–20).
                    </p>
                  )}

                  {handleStatus === "taken" && (
                    <p style={{ color: "red", fontSize: 12, marginTop: 4 }}>
                      Handle already taken.
                    </p>
                  )}

                  {handleStatus === "valid" && (
                    <p style={{ color: "#4ade80", fontSize: 12, marginTop: 4 }}>
                      Available ✓
                    </p>
                  )}
                </div>

                {/* BIO unchanged */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 13, opacity: 0.9 }}>Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows="3"
                    style={{
                      width: "100%",
                      padding: 10,
                      borderRadius: 8,
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
                padding: 12,
                background: "#ff2f2f",
                borderRadius: 10,
                border: "none",
                color: "white",
                fontSize: 15,
                fontWeight: 600,
                marginBottom: 14,
                cursor: "pointer",
              }}
            >
              Save Profile
            </button>
          </div>

          {/* CROPPER OVERLAY (UNCHANGED) */}
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

              <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
                <button
                  onClick={() => setShowCropper(false)}
                  style={{
                    padding: "10px 20px",
                    background: "#222",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "white",
                  }}
                >
                  Cancel
                </button>

                <button
                  onClick={doSaveCroppedImage}
                  style={{
                    padding: "10px 20px",
                    background: "#ff2f2f",
                    borderRadius: 10,
                    border: "none",
                    color: "white",
                    fontWeight: 600,
                  }}
                >
                  {uploading ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          )}

          {/* SETTINGS + LOGOUT (UNCHANGED) */}
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
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <h2 style={{ fontSize: 18, fontWeight: 600 }}>Settings</h2>
                  <button
                    onClick={() => setSettingsOpen(false)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "rgba(255,255,255,0.7)",
                      fontSize: 24,
                    }}
                  >
                    ×
                  </button>
                </div>

                <button
                  onClick={() => setShowAccountInfo((p) => !p)}
                  style={{
                    textAlign: "left",
                    padding: "10px 2px",
                    background: "transparent",
                    border: "none",
                    color: "white",
                    fontSize: 14,
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>Account</span>
                  <span>{showAccountInfo ? "˄" : "˅"}</span>
                </button>

                {showAccountInfo && (
                  <div style={{ fontSize: 13, opacity: 0.85, paddingBottom: 12 }}>
                    <div style={{ opacity: 0.6, fontSize: 11 }}>Email</div>
                    <div>{user?.email}</div>
                  </div>
                )}

                <div style={{ flex: 1 }} />

                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  style={{
                    width: "100%",
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
                  padding: 18,
                  width: "100%",
                  maxWidth: 360,
                }}
              >
                <h2 style={{ fontSize: 18, fontWeight: 600 }}>Log out?</h2>

                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 10,
                    background: "#333",
                    color: "white",
                    marginBottom: 10,
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
                    background: "#ff2f2f",
                    color: "white",
                    fontWeight: 600,
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
