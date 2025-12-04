// src/pages/ProfilePage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);

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

  async function uploadAvatar(event) {
    try {
      setUploading(true);
      const file = event.target.files[0];
      if (!file) return;

      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
    } catch (err) {
      console.error("Avatar upload error:", err.message);
    } finally {
      setUploading(false);
    }
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
            }}
          >
            {uploading ? "Uploading..." : "Change Avatar"}
            <input
              type="file"
              accept="image/*"
              onChange={uploadAvatar}
              style={{ display: "none" }}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {/* Username */}
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

      {/* Bio */}
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

      {/* Save Button */}
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

      {/* Logout Button */}
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
    </div>
  );
}
