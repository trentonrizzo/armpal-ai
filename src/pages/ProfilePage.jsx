import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";
import Cropper from "react-easy-crop";
import { FiSettings, FiEdit2, FiCheck, FiX } from "react-icons/fi";
import SettingsOverlay from "../settings/SettingsOverlay";

/* ============================================================
   ProfilePage.jsx — FULL REPLACEMENT (NO PART TEXT IN UI)
   - Header: BIG Display Name, small @handle
   - Card: Avatar + Bio
   - Reactions row (4)
   - Bottom row: PRs / Workouts / Measures shortcuts
   - Edit FAB bottom-right; Save only if dirty
   - Avatar action sheet + cropper preserved
   - SettingsOverlay untouched
============================================================ */

const MAX_BIO_LENGTH = 220;

function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

function safeTrim(s) {
  return (s || "").toString().trim();
}

function niceName(name, fallback = "User") {
  const n = safeTrim(name);
  return n || fallback;
}

function iconStyle() {
  return { width: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center" };
}

/* ============================================================
   UI PIECES
============================================================ */

function ReactionPill({ emoji, count, onClick, disabled }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        flex: 1,
        height: 56,
        borderRadius: 16,
        background: "#0b0b0c",
        border: "1px solid rgba(255,255,255,0.10)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        color: "white",
        fontWeight: 900,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.92 : 1,
      }}
    >
      <span style={{ fontSize: 22, lineHeight: 1 }}>{emoji}</span>
      <span style={{ fontSize: 18 }}>{count}</span>
    </button>
  );
}

function ShortcutPill({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        height: 58,
        borderRadius: 18,
        background: "#0b0b0c",
        border: "1px solid rgba(255,255,255,0.10)",
        color: "white",
        fontWeight: 900,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        cursor: "pointer",
      }}
    >
      <span style={{ opacity: 0.95 }}>{icon}</span>
      <span style={{ fontSize: 18 }}>{label}</span>
    </button>
  );
}

function SectionCard({ children }) {
  return (
    <div
      style={{
        background: "#070708",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 22,
        padding: 18,
        marginBottom: 18,
        boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
      }}
    >
      {children}
    </div>
  );
}

/* ============================================================
   MAIN
============================================================ */

export default function ProfilePage() {
  // overlays
  const [settingsOpen, setSettingsOpen] = useState(false);

  // auth
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // profile
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // stats counts
  const [stats, setStats] = useState({ prs: 0, workouts: 0, measurements: 0 });

  // reactions counts (view-only on own profile)
  const [reactions, setReactions] = useState({
    fire: 0,
    flex: 0,
    heart: 0,
    shake: 0,
  });

  // edit mode
  const [editMode, setEditMode] = useState(false);
  const [dirty, setDirty] = useState(false);

  // avatar menu + pickers
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const inputPhotoRef = useRef(null);
  const inputCameraRef = useRef(null);
  const inputFileRef = useRef(null);

  // cropper
  const [uploading, setUploading] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  /* ============================================================
     LOAD
  ============================================================ */

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);

      const { data: auth } = await supabase.auth.getUser();
      const authUser = auth?.user;
      if (!authUser) return;

      setUser(authUser);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, handle, bio, avatar_url")
        .eq("id", authUser.id)
        .single();

      if (error) throw error;

      setDisplayName(data?.display_name || "");
      setHandle(data?.handle || "");
      setBio(data?.bio || "");
      setAvatarUrl(data?.avatar_url || "");

      setEditMode(false);
      setDirty(false);

      await loadStats(authUser.id);
      await loadReactionCounts(authUser.id);
    } catch (err) {
      console.error("Profile load error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats(userId) {
    const next = { prs: 0, workouts: 0, measurements: 0 };

    try {
      const { count } = await supabase
        .from("prs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      next.prs = count || 0;
    } catch {}

    try {
      const { count } = await supabase
        .from("workouts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      next.workouts = count || 0;
    } catch {}

    try {
      const { count } = await supabase
        .from("measurements")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      next.measurements = count || 0;
    } catch {}

    setStats(next);
  }

  // Safe: tries common tables/views; if missing, stays at 0 (won’t break UI)
  async function loadReactionCounts(userId) {
    try {
      // Option A: profile_reaction_totals view/table
      const { data, error } = await supabase
        .from("profile_reaction_totals")
        .select("fire, flex, heart, shake")
        .eq("user_id", userId)
        .maybeSingle();

      if (!error && data) {
        setReactions({
          fire: Number(data.fire || 0),
          flex: Number(data.flex || 0),
          heart: Number(data.heart || 0),
          shake: Number(data.shake || 0),
        });
        return;
      }
    } catch {}

    try {
      // Option B: raw log table
      const { data } = await supabase
        .from("profile_reactions")
        .select("emoji")
        .eq("to_user_id", userId);

      if (Array.isArray(data)) {
        const agg = { fire: 0, flex: 0, heart: 0, shake: 0 };
        for (const r of data) {
          const e = r.emoji;
          if (e === "🔥") agg.fire++;
          if (e === "💪") agg.flex++;
          if (e === "❤️") agg.heart++;
          if (e === "🤝") agg.shake++;
        }
        setReactions(agg);
      }
    } catch {}
  }

  /* ============================================================
     ONLINE PRESENCE (DO NOT TOUCH)
  ============================================================ */
  useEffect(() => {
    if (!user?.id) return;

    let heartbeat;

    const setOnline = async () => {
      await supabase
        .from("profiles")
        .update({
          is_online: true,
          last_active: new Date().toISOString(),
        })
        .eq("id", user.id);
    };

    const setOffline = async () => {
      await supabase
        .from("profiles")
        .update({
          is_online: false,
          last_seen: new Date().toISOString(),
        })
        .eq("id", user.id);
    };

    setOnline();
    heartbeat = setInterval(setOnline, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        setOffline();
      } else {
        setOnline();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      setOffline();
    };
  }, [user?.id]);

  /* ============================================================
     AVATAR CROP LOGIC (PRESERVE)
  ============================================================ */

  const onCropComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  function onPickFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result);
      setShowCropper(true);
      setAvatarMenuOpen(false);
    };
    reader.readAsDataURL(f);
    e.target.value = "";
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
                if (!blob) return reject(new Error("Empty crop"));
                resolve(blob);
              },
              "image/jpeg",
              0.92
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

  async function saveCroppedAvatar() {
    try {
      if (!user || !selectedImage || !croppedAreaPixels) return;

      setUploading(true);

      const croppedBlob = await getCroppedImg(selectedImage, croppedAreaPixels);
      const filePath = `${user.id}-${Date.now()}.jpg`;

      const { error } = await supabase.storage.from("avatars").upload(filePath, croppedBlob, {
        upsert: true,
        contentType: "image/jpeg",
      });

      if (error) throw error;

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const publicUrl = data?.publicUrl || "";

      setAvatarUrl(publicUrl);

      // keep this behavior
      await supabase.from("profiles").upsert({ id: user.id, avatar_url: publicUrl });

      // mark dirty only if user is editing
      if (editMode) setDirty(true);

      setShowCropper(false);
      setSelectedImage(null);
    } catch (err) {
      console.error(err);
      alert("Avatar upload failed");
    } finally {
      setUploading(false);
    }
  }
  /* ============================================================
     EDIT MODE
  ============================================================ */

  function enterEditMode() {
    setEditMode(true);
  }

  async function cancelEditMode() {
    // revert fields to DB state
    setEditMode(false);
    setDirty(false);
    await loadProfile();
  }

  async function saveProfile() {
    try {
      if (!user) return;

      const updates = {
        id: user.id,
        display_name: safeTrim(displayName),
        bio: safeTrim(bio),
        avatar_url: avatarUrl || "",
      };

      const { error } = await supabase.from("profiles").upsert(updates);
      if (error) throw error;

      setDirty(false);
      setEditMode(false);

      // refresh stats/reactions too
      await loadStats(user.id);
      await loadReactionCounts(user.id);
    } catch (err) {
      console.error(err);
      alert("Failed to save profile");
    }
  }

  const headerName = useMemo(() => niceName(displayName, "User"), [displayName]);
  const headerHandle = useMemo(() => (safeTrim(handle) ? `@${safeTrim(handle)}` : ""), [handle]);

  if (loading) {
    return <div style={{ padding: 24, color: "white", opacity: 0.75 }}>Loading profile…</div>;
  }

  return (
    <>
      <div style={styles.pageWrap}>
        {/* HEADER */}
        <div style={styles.headerRow}>
          <div style={{ minWidth: 0 }}>
            <div style={styles.headerName}>{headerName}</div>
            {headerHandle ? <div style={styles.headerHandle}>{headerHandle}</div> : null}
          </div>

          <button
            onClick={() => setSettingsOpen(true)}
            style={styles.settingsBtn}
            aria-label="Settings"
          >
            <FiSettings size={20} />
          </button>
        </div>

        {/* MAIN CARD */}
        <SectionCard>
          {/* TOP: avatar + bio */}
          <div style={styles.avatarBioRow}>
            <div style={{ position: "relative", width: 104, height: 104 }}>
              <img
                src={avatarUrl || "https://via.placeholder.com/140?text=No+Avatar"}
                alt="avatar"
                style={styles.avatarImg}
              />

              {/* hidden inputs always exist, but pencil only shows in edit mode */}
              <input
                ref={inputPhotoRef}
                type="file"
                accept="image/*"
                onChange={onPickFile}
                style={{ display: "none" }}
              />
              <input
                ref={inputCameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={onPickFile}
                style={{ display: "none" }}
              />
              <input
                ref={inputFileRef}
                type="file"
                accept="image/*"
                onChange={onPickFile}
                style={{ display: "none" }}
              />

              {editMode ? (
                <button
                  onClick={() => setAvatarMenuOpen(true)}
                  style={styles.avatarEditBtn}
                  aria-label="Edit avatar"
                >
                  <FiEdit2 size={16} />
                </button>
              ) : null}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {!editMode ? (
                <div style={styles.bioText}>
                  {safeTrim(bio) ? bio : <span style={{ opacity: 0.55 }}>No bio yet.</span>}
                </div>
              ) : (
                <textarea
                  value={bio}
                  onChange={(e) => {
                    setBio(e.target.value.slice(0, MAX_BIO_LENGTH));
                    setDirty(true);
                  }}
                  rows={4}
                  placeholder="Tell people what you’re training for..."
                  style={styles.bioInput}
                />
              )}
            </div>
          </div>

          {/* REACTIONS ROW (4) */}
          <div style={styles.reactionsRow}>
            <ReactionPill emoji="🔥" count={reactions.fire} disabled />
            <ReactionPill emoji="💪" count={reactions.flex} disabled />
            <ReactionPill emoji="❤️" count={reactions.heart} disabled />
            <ReactionPill emoji="🤝" count={reactions.shake} disabled />
          </div>

          {/* SHORTCUT ROW */}
          <div style={styles.shortcutsRow}>
            <ShortcutPill
              icon={<span style={iconStyle()}>🏆</span>}
              label="PRs"
              onClick={() => (window.location.href = "/prs")}
            />
            <ShortcutPill
              icon={<span style={iconStyle()}>📋</span>}
              label="Workouts"
              onClick={() => (window.location.href = "/workouts")}
            />
            <ShortcutPill
              icon={<span style={iconStyle()}>📏</span>}
              label="Measures"
              onClick={() => (window.location.href = "/measure")}
            />
          </div>
        </SectionCard>
      </div>

      {/* FLOATING BUTTONS (BOTTOM RIGHT) */}
      {!editMode ? (
        <button onClick={enterEditMode} style={styles.fabEdit} aria-label="Edit profile">
          <FiEdit2 size={20} />
        </button>
      ) : (
        <div style={styles.fabRow}>
          <button onClick={cancelEditMode} style={styles.fabCancel} aria-label="Cancel edit">
            <FiX size={20} />
          </button>

          <button
            onClick={saveProfile}
            disabled={!dirty}
            style={{
              ...styles.fabSave,
              background: dirty ? "#22c55e" : "#2a2a2a",
              cursor: dirty ? "pointer" : "not-allowed",
              boxShadow: dirty ? "0 18px 30px rgba(34,197,94,0.45)" : "none",
            }}
            aria-label="Save profile"
          >
            <FiCheck size={22} />
          </button>
        </div>
      )}

      {/* SETTINGS OVERLAY (UNTOUCHED) */}
      <SettingsOverlay open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {/* AVATAR ACTION SHEET (EDIT MODE ONLY) */}
      {avatarMenuOpen && editMode && (
        <div onClick={() => setAvatarMenuOpen(false)} style={styles.sheetBackdrop}>
          <div onClick={(e) => e.stopPropagation()} style={styles.sheetCard}>
            <div style={styles.sheetTitle}>Edit profile picture</div>

            <div style={{ display: "grid", gap: 12 }}>
              <button onClick={() => inputPhotoRef.current?.click()} style={styles.sheetBtn}>
                Pick from Photos
              </button>

              <button onClick={() => inputCameraRef.current?.click()} style={styles.sheetBtn}>
                Take a Picture
              </button>

              <button onClick={() => inputFileRef.current?.click()} style={styles.sheetBtn}>
                Choose from Files
              </button>

              <button
                onClick={async () => {
                  try {
                    if (!user?.id) return;
                    setAvatarUrl("");
                    await supabase.from("profiles").upsert({ id: user.id, avatar_url: "" });
                    setDirty(true);
                    setAvatarMenuOpen(false);
                  } catch {
                    alert("Failed to remove avatar");
                  }
                }}
                style={{
                  ...styles.sheetBtn,
                  background: "rgba(255,47,47,0.12)",
                  border: "1px solid rgba(255,47,47,0.35)",
                  color: "#ff6b6b",
                }}
              >
                Remove Picture
              </button>

              <button
                onClick={() => setAvatarMenuOpen(false)}
                style={{ ...styles.sheetBtn, background: "#1a1a1a" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CROPPER OVERLAY */}
      {showCropper && (
        <div style={styles.cropperWrap}>
          <div style={styles.cropTopBar}>
            <button
              onClick={() => {
                setShowCropper(false);
                setSelectedImage(null);
              }}
              style={styles.cropTopBtn}
            >
              Cancel
            </button>

            <div style={styles.cropTitle}>Crop Photo</div>

            <button
              onClick={saveCroppedAvatar}
              disabled={uploading}
              style={{
                ...styles.cropTopBtn,
                background: "#ff2f2f",
                border: "none",
                opacity: uploading ? 0.7 : 1,
              }}
            >
              {uploading ? "Saving…" : "Save"}
            </button>
          </div>

          <div style={{ flex: 1, position: "relative" }}>
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

          <div style={styles.cropBottomBar}>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(clamp(Number(e.target.value), 1, 3))}
              style={{ width: "100%" }}
            />
          </div>
        </div>
      )}
    </>
  );
}

/* ============================================================
   STYLES (NO TEXT LEAKS INTO UI)
============================================================ */

const styles = {
  pageWrap: {
    padding: "26px 18px 140px",
    maxWidth: 900,
    margin: "0 auto",
  },

  headerRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 22,
  },

  headerName: {
    fontSize: 36,
    fontWeight: 950,
    letterSpacing: -0.7,
    lineHeight: 1.05,
  },

  headerHandle: {
    fontSize: 16,
    opacity: 0.62,
    marginTop: 6,
    fontWeight: 700,
  },

  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: "999px",
    background: "#111",
    border: "1px solid rgba(255,255,255,0.14)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  },

  avatarBioRow: {
    display: "flex",
    alignItems: "center",
    gap: 18,
    marginBottom: 16,
  },

  avatarImg: {
    width: 104,
    height: 104,
    borderRadius: "50%",
    objectFit: "cover",
    border: "2px solid rgba(255,255,255,0.12)",
    background: "#0a0a0a",
  },

  avatarEditBtn: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 34,
    height: 34,
    borderRadius: "50%",
    background: "#111",
    border: "1px solid rgba(255,255,255,0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "0 6px 14px rgba(0,0,0,0.5)",
  },

  bioText: {
    fontSize: 17,
    fontWeight: 650,
    opacity: 0.92,
    lineHeight: 1.45,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },

  bioInput: {
    width: "100%",
    padding: 12,
    borderRadius: 14,
    background: "#0d0d0f",
    border: "1px solid rgba(255,255,255,0.14)",
    color: "white",
    outline: "none",
    resize: "none",
    fontSize: 15,
    lineHeight: 1.45,
  },

  reactionsRow: {
    display: "flex",
    gap: 12,
    marginTop: 8,
    marginBottom: 14,
  },

  shortcutsRow: {
    display: "flex",
    gap: 12,
    marginTop: 6,
  },

  fabEdit: {
    position: "fixed",
    right: 18,
    bottom: 90,
    width: 54,
    height: 54,
    borderRadius: "50%",
    background: "#ff2f2f",
    border: "none",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 18px 30px rgba(255,47,47,0.32)",
    cursor: "pointer",
    zIndex: 50,
  },

  fabRow: {
    position: "fixed",
    right: 18,
    bottom: 90,
    display: "flex",
    gap: 14,
    zIndex: 50,
  },

  fabCancel: {
    width: 50,
    height: 50,
    borderRadius: "50%",
    background: "#1a1a1a",
    border: "1px solid rgba(255,255,255,0.18)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },

  fabSave: {
    width: 54,
    height: 54,
    borderRadius: "50%",
    border: "none",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  sheetBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.72)",
    zIndex: 9998,
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-end",
    padding: 16,
  },

  sheetCard: {
    width: "100%",
    maxWidth: 420,
    background: "#0f0f10",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 20,
    padding: 14,
  },

  sheetTitle: {
    fontSize: 15,
    fontWeight: 900,
    marginBottom: 12,
  },

  sheetBtn: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 16,
    background: "#111",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "white",
    fontWeight: 900,
    textAlign: "left",
    cursor: "pointer",
  },

  cropperWrap: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.92)",
    zIndex: 9999,
    display: "flex",
    flexDirection: "column",
  },

  cropTopBar: {
    height: 66,
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid rgba(255,255,255,0.12)",
    background: "#000",
  },

  cropTitle: {
    fontWeight: 900,
    fontSize: 15,
    opacity: 0.9,
  },

  cropTopBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    background: "#1a1a1a",
    border: "1px solid rgba(255,255,255,0.14)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  },

  cropBottomBar: {
    padding: "14px 18px 20px",
    borderTop: "1px solid rgba(255,255,255,0.12)",
    background: "#000",
  },
};
