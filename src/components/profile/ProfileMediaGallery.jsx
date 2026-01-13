// src/components/profile/ProfileMediaGallery.jsx
// ============================================================================
// ArmPal — Profile Media Gallery (PATCH MODULE — FINAL)
// FULL FILE REPLACEMENT
// ----------------------------------------------------------------------------
// ✅ 12-photo grid (3x4), first empty slot = Add Photo, rest placeholders
// ✅ Light/Dark + Accent compatible via existing CSS vars (no context imports)
// ✅ Fullscreen viewer overlay with swipe left/right + smooth animation
// ✅ Background scroll locked while viewer open (no scroll bleed)
// ✅ Delete ONLY inside viewer (bottom, small), ArmPal-themed confirm modal
// ✅ Deletes DB row + storage object (best-effort path parsing)
// ----------------------------------------------------------------------------
// Requires:
// - Supabase bucket: profile-media (public is fine)
// - Table: profile_media with at least { id, user_id, image_url, created_at }
//   Optional columns supported: storage_path OR path
// ============================================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../supabaseClient";
import { FiPlus, FiTrash2, FiX } from "react-icons/fi";

const BUCKET = "profile-media";
const MAX_PHOTOS = 12;

// tiny haptics (subtle)
function haptic(ms = 10) {
  try {
    navigator?.vibrate?.(ms);
  } catch {}
}

// best-effort parse storage object path from a public URL
function parseStoragePathFromUrl(url) {
  if (!url || typeof url !== "string") return null;
  // Expected public URLs often include: /storage/v1/object/public/<bucket>/<path>
  const marker = `/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

export default function ProfileMediaGallery({ userId, isOwnProfile = false }) {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // swipe state
  const startXRef = useRef(null);
  const deltaXRef = useRef(0);
  const [dragX, setDragX] = useState(0);
  const [animating, setAnimating] = useState(false);

  // ---------------------------------------------------------------------------
  // Load media
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profile_media")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (!alive) return;
      setMedia(Array.isArray(data) ? data : []);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  // ---------------------------------------------------------------------------
  // Lock background scroll while viewer open (and stop overscroll bounce)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!viewerOpen) return;

    const prevOverflow = document.body.style.overflow;
    const prevOverscroll = document.body.style.overscrollBehaviorY;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehaviorY = "none";

    return () => {
      document.body.style.overflow = prevOverflow || "";
      document.body.style.overscrollBehaviorY = prevOverscroll || "";
    };
  }, [viewerOpen]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const count = media.length;

  const tiles = useMemo(() => {
    const arr = [...media];
    if (isOwnProfile && arr.length < MAX_PHOTOS) arr.push({ __add: true });
    while (arr.length < MAX_PHOTOS) arr.push({ __empty: true, __k: `e-${arr.length}` });
    return arr;
  }, [media, isOwnProfile]);

  const current = viewerOpen ? media[activeIndex] : null;

  function clampIndex(i) {
    if (i < 0) return 0;
    if (i > media.length - 1) return media.length - 1;
    return i;
  }

  function openViewer(index) {
    const i = clampIndex(index);
    setActiveIndex(i);
    setViewerOpen(true);
    setConfirmOpen(false);
    setDragX(0);
    deltaXRef.current = 0;
    startXRef.current = null;
    setAnimating(false);
  }

  function closeViewer() {
    setConfirmOpen(false);
    setViewerOpen(false);
    setDragX(0);
    deltaXRef.current = 0;
    startXRef.current = null;
    setAnimating(false);
  }

  // ---------------------------------------------------------------------------
  // Upload
  // ---------------------------------------------------------------------------
  async function handleUpload(file) {
    if (!file || uploading) return;
    if (!userId) return;
    if (media.length >= MAX_PHOTOS) return;

    try {
      setUploading(true);

      const fileExt = (file.name || "jpg").split(".").pop();
      const filePath = `${userId}/${Date.now()}-${Math.random().toString(16).slice(2)}.${fileExt}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file, { upsert: false });

      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
      const imageUrl = pub?.publicUrl || "";

      const { data: row, error: insErr } = await supabase
        .from("profile_media")
        .insert({
          user_id: userId,
          image_url: imageUrl,
          storage_path: filePath, // optional column; harmless if exists
        })
        .select("*")
        .single();

      if (insErr) {
        // fallback if storage_path column doesn't exist
        await supabase
          .from("profile_media")
          .insert({
            user_id: userId,
            image_url: imageUrl,
          });
      } else {
        setMedia((p) => [...p, row]);
        haptic(10);
        return;
      }

      // reload as fallback
      const { data } = await supabase
        .from("profile_media")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      setMedia(Array.isArray(data) ? data : []);
      haptic(10);
    } catch (e) {
      console.error("ProfileMedia upload failed:", e);
      alert("Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete (best-effort: DB + storage)
  // ---------------------------------------------------------------------------
  async function confirmDelete() {
    if (!current || deleting) return;

    try {
      setDeleting(true);

      // Prefer explicit stored path columns if present
      const path =
        current.storage_path ||
        current.path ||
        parseStoragePathFromUrl(current.image_url);

      // Delete DB row by id when possible
      if (current.id) {
        await supabase.from("profile_media").delete().eq("id", current.id);
      } else {
        await supabase.from("profile_media").delete().eq("image_url", current.image_url);
      }

      // Delete storage object if we have a path
      if (path) {
        await supabase.storage.from(BUCKET).remove([path]);
      }

      // Update local state
      setMedia((prev) => prev.filter((_, idx) => idx !== activeIndex));
      setConfirmOpen(false);

      // adjust index
      const nextIndex = clampIndex(activeIndex >= media.length - 1 ? activeIndex - 1 : activeIndex);
      setActiveIndex(nextIndex);

      // close viewer if no images left
      if (media.length - 1 <= 0) {
        closeViewer();
      }

      haptic(20);
    } catch (e) {
      console.error("Delete failed:", e);
      alert("Delete failed. Try again.");
    } finally {
      setDeleting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Swipe (viewer)
  // - We prevent scroll bleed by preventing default on touchmove when viewer is open.
  // - Smooth animation: drag moves image, release snaps to next/prev with transition.
  // ---------------------------------------------------------------------------
  function onTouchStart(e) {
    if (!viewerOpen) return;
    if (confirmOpen) return;
    if (!e.touches?.length) return;

    setAnimating(false);
    startXRef.current = e.touches[0].clientX;
    deltaXRef.current = 0;
    setDragX(0);
  }

  function onTouchMove(e) {
    if (!viewerOpen) return;
    if (confirmOpen) return;
    if (startXRef.current == null) return;
    if (!e.touches?.length) return;

    // Lock the page from scrolling underneath
    e.preventDefault();

    const dx = e.touches[0].clientX - startXRef.current;
    deltaXRef.current = dx;
    setDragX(dx);
  }

  function onTouchEnd() {
    if (!viewerOpen) return;
    if (confirmOpen) return;

    const dx = deltaXRef.current || 0;
    const threshold = 70;

    // Snap animation
    setAnimating(true);

    if (dx <= -threshold && activeIndex < media.length - 1) {
      // swipe left -> next
      // animate offscreen then switch
      setDragX(-window.innerWidth * 0.6);
      setTimeout(() => {
        setActiveIndex((i) => clampIndex(i + 1));
        setDragX(0);
        setAnimating(false);
      }, 180);
      return;
    }

    if (dx >= threshold && activeIndex > 0) {
      // swipe right -> prev
      setDragX(window.innerWidth * 0.6);
      setTimeout(() => {
        setActiveIndex((i) => clampIndex(i - 1));
        setDragX(0);
        setAnimating(false);
      }, 180);
      return;
    }

    // snap back
    setDragX(0);
    setTimeout(() => setAnimating(false), 180);
  }

  // ---------------------------------------------------------------------------
  // Styles (use your theme CSS vars)
  // ---------------------------------------------------------------------------
  const styles = {
    card: {
      marginTop: 16,
      padding: 16,
      borderRadius: 20,
      border: "1.5px solid color-mix(in srgb, var(--accent) 55%, transparent)",
      background: "var(--card)",
      color: "var(--text)",
    },
    headerRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
      fontWeight: 900,
      letterSpacing: -0.2,
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 12,
    },
    tile: {
      aspectRatio: "1 / 1",
      borderRadius: 14,
      overflow: "hidden",
      background: "var(--card-2)",
    },
    thumb: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      display: "block",
    },
    addTile: {
      aspectRatio: "1 / 1",
      borderRadius: 14,
      border: "2px dashed var(--accent)",
      background: "transparent",
      color: "var(--accent)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 900,
      cursor: "pointer",
      gap: 10,
      userSelect: "none",
    },
    emptyTile: {
      aspectRatio: "1 / 1",
      borderRadius: 14,
      background: "var(--card-2)",
      opacity: 0.9,
    },
    viewerBackdrop: {
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      background: "rgba(0,0,0,0.92)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overscrollBehavior: "none",
      touchAction: "none",
    },
    viewerFrame: {
      width: "100%",
      maxWidth: 520,
      padding: 16,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 14,
    },
    viewerImg: {
      width: "100%",
      maxHeight: "78vh",
      objectFit: "contain",
      borderRadius: 18,
      transform: `translateX(${dragX}px)`,
      transition: animating ? "transform 180ms ease" : "none",
      boxShadow: "0 18px 60px rgba(0,0,0,0.45)",
      background: "rgba(0,0,0,0.15)",
    },
    viewerBottomRow: {
      width: "100%",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      gap: 10,
    },
    deleteSmall: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      padding: "10px 14px",
      borderRadius: 999,
      border: "1px solid color-mix(in srgb, var(--accent) 55%, transparent)",
      background: "rgba(0,0,0,0.25)",
      color: "var(--accent)",
      fontWeight: 900,
      cursor: "pointer",
      userSelect: "none",
    },
    closeBtn: {
      position: "absolute",
      top: 14,
      right: 14,
      width: 40,
      height: 40,
      borderRadius: 999,
      border: "1px solid rgba(255,255,255,0.15)",
      background: "rgba(0,0,0,0.35)",
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
    },
    modalBackdrop: {
      position: "fixed",
      inset: 0,
      zIndex: 10000,
      background: "rgba(0,0,0,0.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 18,
    },
    modalCard: {
      width: "100%",
      maxWidth: 360,
      borderRadius: 18,
      border: "1px solid color-mix(in srgb, var(--accent) 55%, transparent)",
      background: "var(--card)",
      color: "var(--text)",
      padding: 18,
      boxShadow: "0 18px 60px rgba(0,0,0,0.45)",
    },
    modalTitle: {
      fontWeight: 1000,
      fontSize: 18,
      letterSpacing: -0.2,
      marginBottom: 6,
      textAlign: "center",
    },
    modalText: {
      opacity: 0.75,
      fontSize: 14,
      lineHeight: 1.45,
      textAlign: "center",
      marginBottom: 14,
    },
    modalButtons: {
      display: "flex",
      gap: 10,
    },
    cancelBtn: {
      flex: 1,
      padding: "11px 12px",
      borderRadius: 14,
      border: "1px solid var(--border)",
      background: "var(--card-2)",
      color: "var(--accent)", // per request: cancel text should be accent color
      fontWeight: 900,
      cursor: "pointer",
    },
    deleteBtn: {
      flex: 1,
      padding: "11px 12px",
      borderRadius: 14,
      border: "none",
      background: "var(--accent)",
      color: "#fff",
      fontWeight: 1000,
      cursor: "pointer",
    },
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div style={styles.card}>
      <div style={styles.headerRow}>
        <div>Photos · {count}/{MAX_PHOTOS}</div>
        {loading && <div style={{ opacity: 0.65, fontWeight: 800 }}>Loading…</div>}
      </div>

      <div style={styles.grid}>
        {tiles.map((t, idx) => {
          if (t.__add) {
            return (
              <label key={`add-${idx}`} style={styles.addTile}>
                <FiPlus size={18} />
                <span>{uploading ? "Uploading…" : "Add Photo"}</span>
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                    e.target.value = "";
                  }}
                />
              </label>
            );
          }

          if (t.__empty) {
            return <div key={t.__k || `empty-${idx}`} style={styles.emptyTile} />;
          }

          // Real image tile
          return (
            <button
              key={t.id || `${t.image_url}-${idx}`}
              onClick={() => openViewer(idx)}
              style={{
                ...styles.tile,
                border: "none",
                padding: 0,
                cursor: "pointer",
                background: "transparent",
              }}
              aria-label="Open photo"
            >
              <div style={styles.tile}>
                <img src={t.image_url} alt="profile media" style={styles.thumb} />
              </div>
            </button>
          );
        })}
      </div>

      {/* FULLSCREEN VIEWER */}
      {viewerOpen && current && (
        <div
          style={styles.viewerBackdrop}
          onClick={() => closeViewer()}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <button
            style={styles.closeBtn}
            onClick={(e) => {
              e.stopPropagation();
              closeViewer();
            }}
            aria-label="Close"
          >
            <FiX size={18} />
          </button>

          <div
            style={styles.viewerFrame}
            onClick={(e) => e.stopPropagation()}
          >
            <img src={current.image_url} alt="photo" style={styles.viewerImg} />

            {isOwnProfile && (
              <div style={styles.viewerBottomRow}>
                <button
                  style={styles.deleteSmall}
                  onClick={() => {
                    setConfirmOpen(true);
                    haptic(10);
                  }}
                >
                  <FiTrash2 size={16} />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {confirmOpen && (
        <div
          style={styles.modalBackdrop}
          onClick={() => setConfirmOpen(false)}
        >
          <div
            style={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.modalTitle}>Confirm delete</div>
            <div style={styles.modalText}>
              This photo will be permanently removed.
            </div>

            <div style={styles.modalButtons}>
              <button
                style={styles.cancelBtn}
                onClick={() => {
                  setConfirmOpen(false);
                  haptic(10);
                }}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                style={styles.deleteBtn}
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
