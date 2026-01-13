import React, { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";

const MAX_PHOTOS = 12;
const BUCKET = "profile-media";

// subtle haptics helper (safe on non-iOS)
const haptic = (type = "light") => {
  try {
    if (window?.navigator?.vibrate) {
      window.navigator.vibrate(type === "medium" ? 20 : 10);
    }
  } catch {}
};

export default function ProfileMediaGallery({
  userId,
  isOwnProfile = false,
}) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profile_media")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      setPhotos(Array.isArray(data) ? data : []);
      setLoading(false);
    };

    load();
  }, [userId]);

  const uploadPhoto = async (file) => {
    if (!file || uploading || photos.length >= MAX_PHOTOS) return;

    try {
      setUploading(true);

      const ext = file.name.split(".").pop();
      const name = `${Date.now()}.${ext}`;
      const path = `${userId}/${name}`;

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(path);

      const { data: row } = await supabase
        .from("profile_media")
        .insert({
          user_id: userId,
          image_url: urlData.publicUrl,
        })
        .select()
        .single();

      setPhotos((prev) => [...prev, row]);
      haptic("light");
    } catch (e) {
      console.error(e);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (photo) => {
    try {
      const path = photo.image_url.split(`${BUCKET}/`)[1];

      await supabase.from("profile_media").delete().eq("id", photo.id);
      if (path) {
        await supabase.storage.from(BUCKET).remove([path]);
      }

      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      haptic("medium");
    } catch (e) {
      console.error(e);
      alert("Delete failed");
    } finally {
      setConfirmDelete(null);
    }
  };

  const emptySlots = Math.max(0, MAX_PHOTOS - photos.length);

  return (
    <div style={{ marginTop: 20 }}>
      <div
        style={{
          fontWeight: 800,
          marginBottom: 10,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>Photos · {photos.length} / {MAX_PHOTOS}</span>
      </div>

      {loading ? (
        <div style={{ opacity: 0.6 }}>Loading photos…</div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))",
            gap: 10,
          }}
        >
          {photos.map((photo, idx) => (
            <div
              key={photo.id}
              style={{
                position: "relative",
                aspectRatio: "1 / 1",
                borderRadius: 14,
                overflow: "hidden",
                cursor: "pointer",
              }}
              onClick={() => setViewerIndex(idx)}
            >
              <img
                src={photo.image_url}
                alt="profile"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />

              {isOwnProfile && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete(photo);
                  }}
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    background: "rgba(0,0,0,0.6)",
                    borderRadius: "50%",
                    padding: 6,
                    fontSize: 12,
                  }}
                >
                  🗑️
                </div>
              )}
            </div>
          ))}

          {isOwnProfile && emptySlots > 0 && (
            <label
              style={{
                aspectRatio: "1 / 1",
                borderRadius: 14,
                border: "2px dashed rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                cursor: "pointer",
                opacity: uploading ? 0.5 : 1,
              }}
            >
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  uploadPhoto(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              + Add Photo
            </label>
          )}

          {Array.from({ length: emptySlots - 1 }).map((_, i) => (
            <div
              key={`empty-${i}`}
              style={{
                aspectRatio: "1 / 1",
                borderRadius: 14,
                background: "rgba(255,255,255,0.04)",
              }}
            />
          ))}
        </div>
      )}

      {/* Fullscreen viewer */}
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
            src={photos[viewerIndex]?.image_url}
            alt="full"
            style={{
              maxWidth: "90%",
              maxHeight: "90%",
              borderRadius: 20,
            }}
          />
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#111",
              padding: 20,
              borderRadius: 16,
              width: 280,
              textAlign: "center",
            }}
          >
            <div style={{ marginBottom: 12, fontWeight: 700 }}>
              Delete this photo?
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                onClick={() => deletePhoto(confirmDelete)}
                style={{ flex: 1, color: "red" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
