import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../../supabaseClient";

const MAX_PHOTOS = 12;
const BUCKET = "profile-media";

// subtle haptics
const haptic = (ms = 10) => {
  try {
    navigator?.vibrate?.(ms);
  } catch {}
};

// detect light / dark safely
const detectLightMode = () => {
  const root = document.documentElement;
  if (root.dataset?.theme) return root.dataset.theme === "light";
  if (document.body.classList.contains("light")) return true;
  if (document.body.classList.contains("dark")) return false;
  return window.matchMedia("(prefers-color-scheme: light)").matches;
};

export default function ProfileMediaGallery({ userId, isOwnProfile = false }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [viewerIndex, setViewerIndex] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [isLight, setIsLight] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const touchStartX = useRef(null);

  // pull accent color from CSS var
  const rootStyles =
    typeof window !== "undefined"
      ? getComputedStyle(document.documentElement)
      : null;

  const accent =
    rootStyles?.getPropertyValue("--accent")?.trim() || "#7c5cff";

  useEffect(() => {
    setIsLight(detectLightMode());
  }, []);

  const cardBg = isLight ? "#ffffff" : "#111111";
  const softBg = isLight ? "#f1f1f1" : "rgba(255,255,255,0.08)";
  const text = isLight ? "#111" : "#fff";

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
      if (path) await supabase.storage.from(BUCKET).remove([path]);

      setPhotos((p) => p.filter((x) => x.id !== photo.id));
      setConfirmDelete(false);
      setViewerIndex(null);
      haptic(20);
    } catch {
      alert("Delete failed");
    }
  };

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchMove = (e) => {
    if (touchStartX.current === null) return;
    setSwipeOffset(e.touches[0].clientX - touchStartX.current);
  };

  const onTouchEnd = () => {
    if (Math.abs(swipeOffset) > 60) {
      setViewerIndex((i) =>
        swipeOffset < 0
          ? Math.min(i + 1, photos.length - 1)
          : Math.max(i - 1, 0)
      );
    }
    setSwipeOffset(0);
    touchStartX.current = null;
  };

  const emptySlots = Math.max(0, MAX_PHOTOS - photos.length);

  return (
    <div
      style={{
        marginTop: 20,
        padding: 16,
        borderRadius: 20,
        background: cardBg,
        border: `1.5px solid ${accent}55`,
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
                border: `2px dashed ${accent}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                cursor: "pointer",
                color: accent,
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
                background: softBg,
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
          <div
            onClick={(e) => e.stopPropagation()}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            style={{
              transform: `translateX(${swipeOffset}px)`,
              transition: swipeOffset === 0 ? "transform 0.25s ease" : "none",
            }}
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
                  color: accent,
                  cursor: "pointer",
                }}
              >
                Delete photo
              </div>
            )}
          </div>
        </div>
      )}

      {confirmDelete && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: cardBg,
              padding: 24,
              borderRadius: 20,
              width: 300,
              textAlign: "center",
              color: text,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>
              Confirm delete
            </div>
            <div style={{ opacity: 0.7, marginBottom: 16 }}>
              This photo will be permanently removed.
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
                  background: accent,
                  color: "#fff",
                  fontWeight: 700,
                  borderRadius: 12,
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
