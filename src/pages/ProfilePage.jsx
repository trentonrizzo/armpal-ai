// src/pages/ProfilePage.jsx
import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import Cropper from "react-easy-crop";
import { FiSettings } from "react-icons/fi";
import { FiLogOut } from "react-icons/fi";
import { FiMail } from "react-icons/fi";

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  // CROPPER
  const [showCropper, setShowCropper] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  // RIGHT SIDE DRAWER
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showEmail, setShowEmail] = useState(false);

  // LOGOUT CONFIRM
  const [confirmLogout, setConfirmLogout] = useState(false);

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

  // IMAGE CROPPING
  const getCroppedImg = async (imageSrc, pixelCrop) => {
    return new Promise((resolve, reject) => {
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
          (blob) => {
            if (!blob) return reject(new Error("Canvas empty"));
            resolve(blob);
          },
          "image/jpeg",
          0.9
        );
      };

      img.onerror = (err) => reject(err);
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
      if (!selectedImage || !croppedAreaPixels) return;

      setUploading(true);

      const croppedBlob = await getCroppedImg(selectedImage, croppedAreaPixels);

      const ext = "jpg";
      const filePath = `${user.id}-${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(filePath, croppedBlob, { upsert: true });

      if (uploadErr) throw uploadErr;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
      setShowCropper(false);
    } catch (err) {
      alert("Image error: " + err?.message);
    } finally {
      setUploading(false);
    }
  }

  async function saveProfile() {
    try {
      const updates = {
        id: user.id,
        username,
        bio,
        avatar_url: avatarUrl,
      };

      const { error } = await supabase.from("profiles").upsert(updates);

      if (error) throw error;

      alert("Profile updated!");
    } catch (err) {
      alert("Save error: " + err?.message);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  // ⭐ Drawer width = 70% of screen
  const drawerWidth = "70%";

  return (
    <>
      {loading ? (
        <p style={{ padding: 20, opacity: 0.7 }}>Loading profile...</p>
      ) : (
        <div className="fade-in">
          <div
            style={{
              padding: "20px 16px 100px",
              maxWidth: "900px",
              margin: "0 auto",
              position: "relative",
            }}
          >
            {/* SETTINGS ICON */}
            <div
              onClick={() => setDrawerOpen(true)}
              style={{
                position: "absolute",
                top: 20,
                right: 16,
                cursor: "pointer",
                fontSize: "26px",
                color: "white",
              }}
            >
              <FiSettings />
            </div>

            <h1
              style={{
                fontSize: 22,
                marginBottom: 20,
                fontWeight: 700,
              }}
            >
              Profile
            </h1>

            {/* AVATAR + USERNAME + BIO */}
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <img
                src={
                  avatarUrl ||
                  "https://via.placeholder.com/120?text=Avatar"
                }
                alt="avatar"
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: "999px",
                  objectFit: "cover",
                  border: "2px solid rgba(255,255,255,0.1)",
                }}
              />

              <div style={{ flex: 1 }}>
                <h2
                  style={{
                    fontSize: 20,
                    margin: 0,
                    fontWeight: 700,
                  }}
                >
                  {username || "Unnamed User"}
                </h2>
                <p style={{ opacity: 0.7, marginTop: 4 }}>{bio || ""}</p>

                {/* EDIT AVATAR BUTTON */}
                <label
                  style={{
                    marginTop: 8,
                    display: "inline-block",
                    padding: "8px 14px",
                    background: "#111",
                    fontSize: 13,
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.1)",
                    cursor: "pointer",
                  }}
                >
                  Change Avatar
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onSelectFile}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
            </div>

            {/* USERNAME */}
            <div style={{ marginTop: 24 }}>
              <label style={{ fontSize: 13, opacity: 0.8 }}>Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: 10,
                  borderRadius: 8,
                  background: "#0d0d0d",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "white",
                }}
              />
            </div>

            {/* BIO */}
            <div style={{ marginTop: 18 }}>
              <label style={{ fontSize: 13, opacity: 0.8 }}>Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                style={{
                  width: "100%",
                  marginTop: 6,
                  padding: 10,
                  borderRadius: 8,
                  background: "#0d0d0d",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "white",
                }}
              />
            </div>

            {/* SAVE */}
            <button
              onClick={saveProfile}
              style={{
                width: "100%",
                marginTop: 20,
                padding: 14,
                background: "#ff2f2f",
                border: "none",
                borderRadius: 10,
                color: "white",
                fontWeight: 700,
                fontSize: 15,
              }}
            >
              Save Profile
            </button>
          </div>
        </div>
      )}

      {/* ==========================
            SLIDE OUT DRAWER
      =========================== */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: drawerOpen
            ? "rgba(0,0,0,0.55)"
            : "rgba(0,0,0,0)",
          backdropFilter: drawerOpen ? "blur(2px)" : "none",
          transition: "0.25s",
          pointerEvents: drawerOpen ? "auto" : "none",
          zIndex: 9999,
        }}
        onClick={() => setDrawerOpen(false)}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: drawerWidth,
            height: "100%",
            background: "#0d0d0d",
            borderLeft: "1px solid rgba(255,255,255,0.08)",
            transform: drawerOpen
              ? "translateX(0)"
              : "translateX(100%)",
            transition: "0.25s",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* SETTINGS TITLE */}
          <h2 style={{ fontSize: 20, marginBottom: 20 }}>Settings</h2>

          {/* ACCOUNT BUTTON */}
          <button
            onClick={() => setShowEmail(!showEmail)}
            style={{
              padding: "12px",
              background: "#111",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.1)",
              color: "white",
              textAlign: "left",
              fontSize: 15,
              marginBottom: 14,
            }}
          >
            Account
          </button>

          {/* EMAIL SECTION */}
          {showEmail && (
            <div
              style={{
                padding: "12px",
                background: "#151515",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.05)",
                marginBottom: 18,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FiMail size={18} />
                <span style={{ opacity: 0.8 }}>
                  {user?.email || "No Email"}
                </span>
              </div>
            </div>
          )}

          {/* LOGOUT */}
          <button
            onClick={() => setConfirmLogout(true)}
            style={{
              marginTop: "auto",
              padding: "12px",
              background: "#330000",
              borderRadius: 10,
              border: "1px solid rgba(255,0,0,0.4)",
              color: "#ff3b3b",
              fontWeight: 600,
              fontSize: 15,
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
            }}
          >
            <FiLogOut size={18} /> Logout
          </button>
        </div>
      </div>

      {/* ==========================
            LOGOUT CONFIRM MODAL
      =========================== */}
      {confirmLogout && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 99999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
          onClick={() => setConfirmLogout(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 350,
              background: "#111",
              borderRadius: 12,
              padding: 20,
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <h3 style={{ margin: 0, marginBottom: 14, fontSize: 18 }}>
              Confirm Logout
            </h3>

            <p style={{ opacity: 0.7, marginBottom: 20 }}>
              Are you sure you want to logout?
            </p>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setConfirmLogout(false)}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "#222",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "white",
                }}
              >
                Cancel
              </button>

              <button
                onClick={logout}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "#ff2f2f",
                  border: "none",
                  borderRadius: 8,
                  color: "white",
                  fontWeight: 700,
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================
            CROPPER MODAL
      =========================== */}
      {showCropper && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            zIndex: 999999,
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
            style={{
              marginTop: 20,
              display: "flex",
              gap: 12,
            }}
          >
            <button
              onClick={() => setShowCropper(false)}
              style={{
                padding: "10px 20px",
                background: "#222",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 10,
                color: "white",
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
                border: "none",
                borderRadius: 10,
                color: "white",
                fontWeight: 700,
              }}
            >
              {uploading ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
