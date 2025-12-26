// src/pages/ProfilePage.jsx
// PART 1 / 3
// ------------------------------------------------------------
// FULL FILE REPLACEMENT — DO NOT MERGE, DO NOT MIX
// This is PART 1 only. Parts 2 and 3 will follow.
// ------------------------------------------------------------

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { supabase } from "../supabaseClient";
import Cropper from "react-easy-crop";
import {
  FiSettings,
  FiEdit2,
  FiCheck,
  FiX,
} from "react-icons/fi";
import SettingsOverlay from "../settings/SettingsOverlay";

/* ============================================================
   CONSTANTS / HELPERS
============================================================ */

const MAX_BIO_LENGTH = 220;

function formatDisplayName(name) {
  if (!name) return "";
  return name.trim();
}

function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

/* ============================================================
   SOFT UI BUILDING BLOCKS
============================================================ */

function StatChip({ icon, value, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        height: 56,
        borderRadius: 14,
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
      {icon}
      <span style={{ fontSize: 18 }}>{value}</span>
    </button>
  );
}

function SectionCard({ children }) {
  return (
    <div
      style={{
        background: "#070708",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 20,
        padding: 18,
        marginBottom: 18,
      }}
    >
      {children}
    </div>
  );
}

/* ============================================================
   MAIN PROFILE PAGE
============================================================ */

export default function ProfilePage() {
  /* ---------------------------
     CORE STATE
  ---------------------------- */
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ---------------------------
     PROFILE DATA
  ---------------------------- */
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  /* ---------------------------
     EDIT MODE
  ---------------------------- */
  const [editMode, setEditMode] = useState(false);
  const [dirty, setDirty] = useState(false);

  /* ---------------------------
     AVATAR / IMAGE
  ---------------------------- */
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [uploading, setUploading] = useState(false);

  const inputPhotoRef = useRef(null);
  const inputCameraRef = useRef(null);
  const inputFileRef = useRef(null);

  /* ============================================================
     LOAD PROFILE
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

      setDirty(false);
      setEditMode(false);
    } catch (err) {
      console.error("Profile load error:", err);
    } finally {
      setLoading(false);
    }
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
     AVATAR CROP LOGIC
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
        };
      } catch (e) {
        reject(e);
      }
    });
  };

  async function saveCroppedAvatar() {
    try {
      if (!user || !selectedImage || !croppedAreaPixels) return;

      setUploading(true);

      const croppedBlob = await getCroppedImg(
        selectedImage,
        croppedAreaPixels
      );
      const filePath = `${user.id}-${Date.now()}.jpg`;

      const { error } = await supabase.storage
        .from("avatars")
        .upload(filePath, croppedBlob, {
          upsert: true,
          contentType: "image/jpeg",
        });

      if (error) throw error;

      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const publicUrl = data?.publicUrl || "";

      setAvatarUrl(publicUrl);
      await supabase
        .from("profiles")
        .upsert({ id: user.id, avatar_url: publicUrl });

      setShowCropper(false);
      setSelectedImage(null);
      setDirty(true);
    } catch (err) {
      console.error(err);
      alert("Avatar upload failed");
    } finally {
      setUploading(false);
    }
  }

  /* ============================================================
     END PART 1
     (HEADER, CORE STATE, AVATAR SYSTEM)
     PART 2 WILL CONTINUE RENDER + EDIT MODE + UI
  ============================================================ */
// ------------------------------------------------------------
// PART 2 / 3 — ProfilePage.jsx
// ------------------------------------------------------------
// UI RENDER, HEADER REWORK, PROFILE BODY, EDIT MODE LOGIC
// ------------------------------------------------------------

  /* ============================================================
     EDIT MODE HELPERS
  ============================================================ */

  function enterEditMode() {
    setEditMode(true);
  }

  function cancelEditMode() {
    setEditMode(false);
    setDirty(false);
    loadProfile();
  }

  async function saveProfile() {
    try {
      if (!user) return;

      const updates = {
        id: user.id,
        display_name: displayName.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrl || "",
      };

      const { error } = await supabase.from("profiles").upsert(updates);
      if (error) throw error;

      setEditMode(false);
      setDirty(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save profile");
    }
  }

  /* ============================================================
     MEMOIZED HEADER TEXT
  ============================================================ */

  const headerName = useMemo(
    () => formatDisplayName(displayName) || "User",
    [displayName]
  );

  const headerHandle = useMemo(() => {
    if (!handle) return "";
    return `@${handle}`;
  }, [handle]);

  /* ============================================================
     RENDER
  ============================================================ */

  if (loading) {
    return (
      <div style={{ padding: 24, color: "white", opacity: 0.75 }}>
        Loading profile…
      </div>
    );
  }

  return (
    <>
      <div style={{ padding: "26px 18px 140px", maxWidth: 900, margin: "0 auto" }}>
        {/* ======================================================
            HEADER (REWORKED)
        ====================================================== */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 22,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 900,
                letterSpacing: -0.5,
              }}
            >
              {headerName}
            </div>

            {headerHandle && (
              <div
                style={{
                  fontSize: 15,
                  opacity: 0.6,
                  marginTop: 4,
                }}
              >
                {headerHandle}
              </div>
            )}
          </div>

          <button
            onClick={() => setSettingsOpen(true)}
            style={{
              width: 42,
              height: 42,
              borderRadius: "999px",
              background: "#111",
              border: "1px solid rgba(255,255,255,0.14)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            aria-label="Settings"
          >
            <FiSettings size={20} />
          </button>
        </div>

        {/* ======================================================
            PROFILE CARD
        ====================================================== */}
        <SectionCard>
          {/* AVATAR ROW */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              marginBottom: 20,
            }}
          >
            <div style={{ position: "relative", width: 96, height: 96 }}>
              <img
                src={avatarUrl || "https://via.placeholder.com/120"}
                alt="avatar"
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid rgba(255,255,255,0.12)",
                  background: "#0a0a0a",
                }}
              />

              {editMode && (
                <>
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

                  <button
                    onClick={() => setAvatarMenuOpen(true)}
                    style={{
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
                    }}
                    aria-label="Edit avatar"
                  >
                    <FiEdit2 size={16} />
                  </button>
                </>
              )}
            </div>

            {/* BIO */}
            <div style={{ flex: 1 }}>
              {!editMode ? (
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 500,
                    opacity: bio ? 0.9 : 0.45,
                    lineHeight: 1.5,
                  }}
                >
                  {bio || "No bio yet."}
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
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 14,
                    background: "#0d0d0f",
                    border: "1px solid rgba(255,255,255,0.14)",
                    color: "white",
                    outline: "none",
                    resize: "none",
                  }}
                />
              )}
            </div>
          </div>

          {/* REACTION BAR PLACEHOLDER */}
          <div
            style={{
              display: "flex",
              gap: 12,
              marginTop: 8,
            }}
          >
            <StatChip value="🔥 0" />
            <StatChip value="💪 0" />
            <StatChip value="❤️ 0" />
          </div>
        </SectionCard>
      </div>

      {/* ======================================================
          FLOATING ACTION BUTTONS (BOTTOM RIGHT)
      ====================================================== */}
      {!editMode && (
        <button
          onClick={enterEditMode}
          style={{
            position: "fixed",
            right: 18,
            bottom: 90,
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "#ff2f2f",
            border: "none",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 18px 30px rgba(255,47,47,0.35)",
            cursor: "pointer",
            zIndex: 50,
          }}
        >
          <FiEdit2 size={22} />
        </button>
      )}

      {editMode && (
        <div
          style={{
            position: "fixed",
            right: 18,
            bottom: 90,
            display: "flex",
            gap: 14,
            zIndex: 50,
          }}
        >
          <button
            onClick={cancelEditMode}
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "#1a1a1a",
              border: "1px solid rgba(255,255,255,0.18)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <FiX size={22} />
          </button>

          <button
            onClick={saveProfile}
            disabled={!dirty}
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: dirty ? "#22c55e" : "#2a2a2a",
              border: "none",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: dirty ? "pointer" : "not-allowed",
              boxShadow: dirty
                ? "0 18px 30px rgba(34,197,94,0.45)"
                : "none",
            }}
          >
            <FiCheck size={24} />
          </button>
        </div>
      )}

      {/* SETTINGS OVERLAY */}
      <SettingsOverlay
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

/* ============================================================
   PART 3 WILL CONTINUE:
   - AVATAR ACTION SHEET
   - CROPPER OVERLAY
   - FINAL EXPORT
============================================================ */
// ------------------------------------------------------------
// PART 3 / 3 — ProfilePage.jsx
// ------------------------------------------------------------
// AVATAR ACTION SHEET, CROPPER OVERLAY, FINAL EXPORT
// BIG. COMPLETE. FINISHES THE FILE.
// ------------------------------------------------------------

      {/* ======================================================
          AVATAR ACTION SHEET
          (ONLY WHEN EDIT MODE)
      ====================================================== */}
      {avatarMenuOpen && editMode && (
        <div
          onClick={() => setAvatarMenuOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            zIndex: 9998,
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-end",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 420,
              background: "#0f0f10",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 20,
              padding: 14,
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 900,
                marginBottom: 12,
              }}
            >
              Edit profile picture
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <button
                onClick={() => inputPhotoRef.current?.click()}
                style={sheetBtn}
              >
                Pick from Photos
              </button>

              <button
                onClick={() => inputCameraRef.current?.click()}
                style={sheetBtn}
              >
                Take a Picture
              </button>

              <button
                onClick={() => inputFileRef.current?.click()}
                style={sheetBtn}
              >
                Choose from Files
              </button>

              <button
                onClick={async () => {
                  try {
                    setAvatarUrl("");
                    await supabase
                      .from("profiles")
                      .upsert({ id: user.id, avatar_url: "" });
                    setDirty(true);
                    setAvatarMenuOpen(false);
                  } catch {
                    alert("Failed to remove avatar");
                  }
                }}
                style={{
                  ...sheetBtn,
                  background: "rgba(255,47,47,0.12)",
                  border: "1px solid rgba(255,47,47,0.35)",
                  color: "#ff6b6b",
                }}
              >
                Remove Picture
              </button>

              <button
                onClick={() => setAvatarMenuOpen(false)}
                style={{
                  ...sheetBtn,
                  background: "#1a1a1a",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          CROPPER OVERLAY
      ====================================================== */}
      {showCropper && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.92)",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* TOP BAR */}
          <div
            style={{
              height: 66,
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid rgba(255,255,255,0.12)",
              background: "#000",
            }}
          >
            <button
              onClick={() => {
                setShowCropper(false);
                setSelectedImage(null);
              }}
              style={cropTopBtn}
            >
              Cancel
            </button>

            <div
              style={{
                fontWeight: 900,
                fontSize: 15,
                opacity: 0.9,
              }}
            >
              Crop Photo
            </div>

            <button
              onClick={saveCroppedAvatar}
              disabled={uploading}
              style={{
                ...cropTopBtn,
                background: "#ff2f2f",
                border: "none",
                opacity: uploading ? 0.7 : 1,
              }}
            >
              {uploading ? "Saving…" : "Save"}
            </button>
          </div>

          {/* CROPPER */}
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

          {/* ZOOM SLIDER */}
          <div
            style={{
              padding: "14px 18px 20px",
              borderTop: "1px solid rgba(255,255,255,0.12)",
              background: "#000",
            }}
          >
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) =>
                setZoom(clamp(Number(e.target.value), 1, 3))
              }
              style={{ width: "100%" }}
            />
          </div>
        </div>
      )}
    </>
  );
}

/* ============================================================
   SHARED STYLES
============================================================ */

const sheetBtn = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 16,
  background: "#111",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "white",
  fontWeight: 900,
  textAlign: "left",
  cursor: "pointer",
};

const cropTopBtn = {
  padding: "10px 14px",
  borderRadius: 12,
  background: "#1a1a1a",
  border: "1px solid rgba(255,255,255,0.14)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

/* ============================================================
   END OF FILE — ProfilePage.jsx
============================================================ */
