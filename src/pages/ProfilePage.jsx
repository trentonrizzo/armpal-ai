// src/pages/ProfilePage.jsx
import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import Cropper from "react-easy-crop";
import imageCompression from "browser-image-compression";

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
      console.error("Error loading profile:", err.message);
    } finally {
      setLoading(false);
    }
  }

  // Converts crop selection to real image blob
  const getCroppedImg = async (imageSrc, pixelCrop) => {
    const img = new Image();
    img.src = imageSrc;
    await new Promise((resolve) => (img.onload = resolve));

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

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
    });
  };

  const onCropComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  function onSelectFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedImage(URL.createObjectURL(file));
    setShowCropper(true);
  }

  async function doSaveCroppedImage() {
    try {
      setUploading(true);

      // Convert cropped area into blob
      const croppedBlob = await getCroppedImg(selectedImage, croppedAreaPixels);

      // Compress image
      const compressed = await imageCompression(croppedBlob, {
        maxSizeMB: 0.4,
        maxWidthOrHeight: 600,
        useWebWorker: true,
      });

      const fileExt = "jpg";
      const filePath = `${user.id}-${Date.now()}.${fileExt}`;

      // Upload to storage
      let { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, compressed, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
      setShowCropper(false);
    } catch (err) {
      console.error(err);
      alert("Error processing image.");
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
      console.error("Save error:", err.message);
      alert("Error saving profile.");
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  if (loading) {
    return (
      <p style={{ padding: "20px", opacity: 0.7 }}>Loading profile...</p>
    );
  }

  return (
    <div
      style={{
        padding: "20px 16px 100px",
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      <h1
        style={{
          fontSize: "22px",
          marginBottom: "16px",
          fontWeight: 700,
        }}
      >
        Profile
      </h1>

      {/* Avatar */}
      <div style={{ marginBottom: "20px", textAlign: "center" }}>
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

        <div style={{ marginTop: "10px" }}>
          <label
            style={{
              fontSize: "13px",
              display: "inline-block",
              padding: "6px 12px",
              background: "#111",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.1)",
              cursor: "pointer",
              marginRight: "8px",
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

          {avatarUrl && (
            <button
              onClick={removeAvatar}
              style={{
                padding: "6px 12px",
                fontSize: "13px",
                background: "#331111",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                color: "white",
                cursor: "pointer",
              }}
            >
              Remove
            </button>
          )}
        </div>
      </div>

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

      {/* SAVE */}
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

      {/* LOGOUT */}
      <button
        onClick={logout}
        style={{
          width: "100%",
          padding: "12px",
          background: "#111",
          borderRadius: "10px",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "white",
          fontSize: "14px",
          cursor: "pointer",
        }}
      >
        Logout
      </button>

      {/* ---- CROPPER MODAL ---- */}
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

          {/* Controls */}
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(e.target.value)}
            style={{ width: "80%", marginTop: "20px" }}
          />

          <div style={{ marginTop: "20px", display: "flex", gap: "12px" }}>
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
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
