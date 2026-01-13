
// src/components/profile/ProfileMediaGallery.jsx
// ARM PAL — PROFILE MEDIA GALLERY (PATCH MODULE)
// Drop-in component for ProfilePage.jsx
// ------------------------------------------------
// Features:
// - Upload up to 10 images
// - Supabase storage: profile-media/{userId}/
// - Friends-only by default (public-ready)
// - Horizontal gallery + fullscreen viewer
// ------------------------------------------------

import React, { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";

const MAX_MEDIA = 10;
const BUCKET = "profile-media";

export default function ProfileMediaGallery({ userId, isOwnProfile = true }) {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(null);

  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profile_media")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      setMedia(Array.isArray(data) ? data : []);
      setLoading(false);
    };

    load();
  }, [userId]);

  const upload = async (file) => {
    if (!file || uploading || media.length >= MAX_MEDIA) return;

    try {
      setUploading(true);
      const ext = file.name.split(".").pop();
      const name = `${Date.now()}.${ext}`;
      const path = `${userId}/${name}`;

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file);

      if (error) throw error;

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const url = data?.publicUrl;

      const { data: row } = await supabase
        .from("profile_media")
        .insert({
          user_id: userId,
          image_url: url,
          visibility: "friends",
        })
        .select()
        .single();

      setMedia((prev) => [row, ...prev]);
    } catch (e) {
      console.error(e);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ fontWeight: 900, marginBottom: 10 }}>Photos</div>

      {isOwnProfile && (
        <label style={{ cursor: "pointer", fontWeight: 800 }}>
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {uploading ? "Uploading..." : "Add Photo"}
        </label>
      )}

      {loading ? (
        <div style={{ opacity: 0.6 }}>Loading photos…</div>
      ) : media.length === 0 ? (
        <div style={{ opacity: 0.6 }}>No photos yet.</div>
      ) : (
        <div
          style={{
            display: "flex",
            gap: 12,
            overflowX: "auto",
            marginTop: 12,
          }}
        >
          {media.map((m, i) => (
            <img
              key={m.id}
              src={m.image_url}
              alt="profile media"
              onClick={() => setViewerIndex(i)}
              style={{
                width: 120,
                height: 120,
                objectFit: "cover",
                borderRadius: 16,
                cursor: "pointer",
              }}
            />
          ))}
        </div>
      )}

      {viewerIndex !== null && (
        <div
          onClick={() => setViewerIndex(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.9)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={media[viewerIndex].image_url}
            alt="full"
            style={{
              maxWidth: "90%",
              maxHeight: "90%",
              borderRadius: 20,
            }}
          />
        </div>
      )}
    </div>
  );
}
