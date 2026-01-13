import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../../supabaseClient";
import { useAppContext } from "../../context/AppContext";

const MAX_PHOTOS = 12;
const BUCKET = "profile-media";

// subtle haptics (safe)
const haptic = (ms = 10) => {
  try {
    navigator?.vibrate?.(ms);
  } catch {}
};

export default function ProfileMediaGallery({ userId, isOwnProfile = false }) {
  const { theme, accentColor } = useAppContext();

  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const touchStartX = useRef(null);

  const isDark = theme === "dark";
  const bg = isDark ? "#0b0b0b" : "#f6f7f8";
  const cardBg = isDark ? "#111" : "#fff";
  const text = isDark ? "#fff" : "#111";
  const soft = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";

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

      await supabase.storage.from(BUCKET).upload(path, file);

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

      setPhotos((p) => [...p, row]);
      haptic(10);
    } catch {
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const deleteCurrent = async () => {
    const photo = photos[viewerIndex];
    if (!photo) return;

    try {
      const path = photo.image_url.split(`${BUCKET}/`)[1];
      await supabase.from("profile_media").delete().eq("id", photo.id);
      if (path) {
        await supabase.storage.from(BUCKET).remove([path]);
      }

      setPhotos((p) => p.filter((x) => x.id !== photo.id));
      setViewerIndex(null);
      setConfirmDelete(false);
      haptic(20);
    } catch {
      alert("Delete failed");
    }
  };

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      setViewerIndex((i) =>
        dx < 0
          ? Math.min(i + 1, photos.length - 1)
          : Math.max(i - 1, 0)
      );
    }
    touchStartX.current = null;
  };

  const emptySlots = Math.max(0, MAX_PHOTOS - photos.length);

  return (
    <div
      style={{
        marginTop: 20,
        padding: 16,
        borderRadius: 18,
        border: `1.5px solid ${accentColor}55`,
        background: cardBg,
        color: text,
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 12 }}>
        Photos · {photos.length} / {MAX_PHOTOS}
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
          {photos.map((p, i) => (
            <div
              key={p.id}
              onClick={() => setViewerIndex(i)}
              style={{
                aspectRatio: "1/1",
                borderRadius: 14,
                overflow: "hidden",
                cursor: "pointer",
              }}
            >
              <img
                src={p.image_url}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          ))}

          {isOwnProfile && emptySlots > 0 && (
            <label
              style={{
                aspectRatio: "1/1",
                borderRadius: 14,
                border: `2px dashed ${accentColor}88`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                cursor: "pointer",
                color: accentColor,
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
              key={i}
              style={{
                aspectRatio: "1/1",
                borderRadius: 14,
                background: soft,
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
          <div
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={photos[viewerIndex]?.image_url}
              alt=""
              style={{
                maxWidth: "90vw",
                maxHeight: "80vh",
                borderRadius: 20,
              }}
            />

            {isOwnProfile && (
              <div
                onClick={() => setConfirmDelete(true)}
                style={{
                  marginTop: 16,
                  textAlign: "center",
                  fontSize: 14,
                  color: accentColor,
                  cursor: "pointer",
                }}
              >
                Delete photo
              </div>
            )}
          </div>
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
              background: cardBg,
              padding: 22,
              borderRadius: 18,
              width: 280,
              color: text,
              textAlign: "center",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 14 }}>
              Delete this photo?
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                onClick={deleteCurrent}
                style={{
                  flex: 1,
                  color: accentColor,
                  fontWeight: 700,
                }}
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
