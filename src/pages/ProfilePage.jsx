// src/pages/ProfilePage.jsx
// ============================================================
// FULL FILE REPLACEMENT — PART 1 / 3
// ============================================================

import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";
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
   CONSTANTS
============================================================ */

const MAX_BIO_LENGTH = 240;
const PAGE_MAX_WIDTH = 960;

/* ============================================================
   UTILS
============================================================ */

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

function safe(v) {
  return typeof v === "string" ? v.trim() : "";
}

function displayNameFallback(name) {
  const n = safe(name);
  return n.length ? n : "User";
}

function formatHandle(h) {
  if (!h) return "";
  return `@${h}`;
}

/* ============================================================
   BIG UI BLOCKS
============================================================ */

function BigCard({ children, style }) {
  return (
    <div
      style={{
        background: "#070708",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 22,
        padding: 24,
        marginBottom: 28,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function ReactionPill({ emoji, count }) {
  return (
    <div
      style={{
        flex: 1,
        height: 72,
        borderRadius: 18,
        background: "#0b0b0c",
        border: "1px solid rgba(255,255,255,0.14)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        fontSize: 20,
        fontWeight: 900,
        color: "white",
      }}
    >
      <span style={{ fontSize: 28 }}>{emoji}</span>
      <span>{count}</span>
    </div>
  );
}
function BigActionCard({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        height: 72,
        borderRadius: 18,
        background: "#0b0b0c",
        border: "1px solid rgba(255,255,255,0.14)",
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "0 22px",
        color: "white",
        fontSize: 18,
        fontWeight: 900,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div>{icon}</div>
      <div>{label}</div>
    </button>
  );
}

/* ============================================================
   MAIN COMPONENT
============================================================ */

export default function ProfilePage() {
  const navigate = useNavigate();

  /* ---------------- CORE STATE ---------------- */

  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [user, setUser] = useState(null);

  /* ---------------- PROFILE DATA ---------------- */

  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  /* ---------------- EDIT MODE ---------------- */

  const [editMode, setEditMode] = useState(false);
  const [dirty, setDirty] = useState(false);

  /* ---------------- AVATAR ---------------- */

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
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;

      setUser(auth.user);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, handle, bio, avatar_url")
        .eq("id", auth.user.id)
        .single();

      if (error) throw error;

      setDisplayName(data?.display_name || "");
      setHandle(data?.handle || "");
      setBio(data?.bio || "");
      setAvatarUrl(data?.avatar_url || "");

      setEditMode(false);
      setDirty(false);
    } catch (e) {
      console.error("Profile load failed", e);
    } finally {
      setLoading(false);
    }
  }

  /* ============================================================
     ONLINE PRESENCE (UNCHANGED)
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

    const vis = () => {
      document.visibilityState === "hidden"
        ? setOffline()
        : setOnline();
    };

    document.addEventListener("visibilitychange", vis);

    return () => {
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", vis);
      setOffline();
    };
  }, [user?.id]);

  /* ============================================================
     AVATAR CROP HELPERS
  ============================================================ */

  const onCropComplete = useCallback((_, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  function onPickFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;

    const r = new FileReader();
    r.onloadend = () => {
      setSelectedImage(r.result);
      setShowCropper(true);
      setAvatarMenuOpen(false);
    };
    r.readAsDataURL(f);
    e.target.value = "";
  }

  const getCroppedImg = (src, pixelCrop) =>
    new Promise((resolve) => {
      const img = new Image();
      img.src = src;
      img.crossOrigin = "anonymous";
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
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92);
      };
    });

  async function saveCroppedAvatar() {
    if (!user || !selectedImage || !croppedAreaPixels) return;
    try {
      setUploading(true);
      const blob = await getCroppedImg(
        selectedImage,
        croppedAreaPixels
      );
      const path = `${user.id}-${Date.now()}.jpg`;

      await supabase.storage
        .from("avatars")
        .upload(path, blob, { upsert: true });

      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);

      setAvatarUrl(data.publicUrl);
      setDirty(true);

      await supabase
        .from("profiles")
        .upsert({ id: user.id, avatar_url: data.publicUrl });

      setShowCropper(false);
      setSelectedImage(null);
    } finally {
      setUploading(false);
    }
  }

  /* ============================================================
     DISPLAY VALUES
  ============================================================ */

  const headerName = useMemo(
    () => displayNameFallback(displayName),
    [displayName]
  );
  const headerHandle = useMemo(
    () => formatHandle(handle),
    [handle]
  );

  if (loading) {
    return (
      <div style={{ padding: 30, opacity: 0.7 }}>
        Loading profile…
      </div>
    );
  }
  /* ============================================================
     EDIT MODE ACTIONS
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
    if (!user) return;

    try {
      const updates = {
        id: user.id,
        display_name: displayName.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrl || "",
      };

      const { error } = await supabase
        .from("profiles")
        .upsert(updates);

      if (error) throw error;

      setEditMode(false);
      setDirty(false);
    } catch (err) {
      console.error("Save failed", err);
      alert("Failed to save profile");
    }
  }

  /* ============================================================
     MAIN RENDER — TOP + PROFILE BODY
  ============================================================ */

  return (
    <>
      <div
        style={{
          padding: "32px 20px 200px",
          maxWidth: PAGE_MAX_WIDTH,
          margin: "0 auto",
        }}
      >
        {/* ======================================================
            HEADER
        ====================================================== */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 36,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 36,
                fontWeight: 900,
                letterSpacing: -0.7,
                lineHeight: 1.1,
              }}
            >
              {headerName}
            </div>

            {headerHandle && (
              <div
                style={{
                  fontSize: 16,
                  opacity: 0.55,
                  marginTop: 6,
                  fontWeight: 600,
                }}
              >
                {headerHandle}
              </div>
            )}
          </div>

          <button
            onClick={() => setSettingsOpen(true)}
            style={{
              width: 46,
              height: 46,
              borderRadius: "50%",
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
        <BigCard>
          <div
            style={{
              display: "flex",
              gap: 28,
              alignItems: "flex-start",
            }}
          >
            {/* AVATAR */}
            <div style={{ position: "relative" }}>
              <img
                src={avatarUrl || "https://via.placeholder.com/160"}
                alt="avatar"
                style={{
                  width: 128,
                  height: 128,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid rgba(255,255,255,0.14)",
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
                      right: -6,
                      bottom: -6,
                      width: 38,
                      height: 38,
                      borderRadius: "50%",
                      background: "#111",
                      border: "1px solid rgba(255,255,255,0.28)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      boxShadow:
                        "0 8px 16px rgba(0,0,0,0.6)",
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
                    fontSize: 18,
                    lineHeight: 1.6,
                    opacity: bio ? 0.95 : 0.45,
                    fontWeight: 500,
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
                  rows={6}
                  placeholder="Tell people what you’re training for…"
                  style={{
                    width: "100%",
                    padding: 16,
                    borderRadius: 18,
                    background: "#0d0d0f",
                    border:
                      "1px solid rgba(255,255,255,0.16)",
                    color: "white",
                    outline: "none",
                    resize: "none",
                    fontSize: 16,
                  }}
                />
              )}
            </div>
          </div>

          {/* ======================================================
              REACTIONS BAR
          ====================================================== */}
          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 30,
            }}
          >
            <ReactionPill emoji="🔥" count={0} />
            <ReactionPill emoji="💪" count={0} />
            <ReactionPill emoji="❤️" count={0} />
            <ReactionPill emoji="👊" count={0} />
          </div>
        </BigCard>

        {/* EXTRA SPACING BEFORE SHORTCUTS */}
        <div style={{ height: 24 }} />
      </div>
        {/* ======================================================
            SHORTCUT CARDS — ROUTES (SPACED, LOWER, WORKING)
        ====================================================== */}
        <div style={{ padding: "0 20px", maxWidth: PAGE_MAX_WIDTH, margin: "0 auto" }}>
          <BigCard style={{ marginBottom: 40 }}>
            <div style={{ display: "grid", gap: 16 }}>
              <BigActionCard
                icon={<span style={{ fontSize: 26 }}>🏋️</span>}
                label="Workouts"
                onClick={() => navigate("/workouts")}
              />

              <BigActionCard
                icon={<span style={{ fontSize: 26 }}>📈</span>}
                label="Personal Records"
                onClick={() => navigate("/prs")}
              />

              <BigActionCard
                icon={<span style={{ fontSize: 26 }}>📏</span>}
                label="Measurements"
                onClick={() => navigate("/measurements")}
              />
            </div>
          </BigCard>
        </div>

      {/* ======================================================
          FLOATING ACTION BUTTONS
      ====================================================== */}
      {!editMode && (
        <button
          onClick={enterEditMode}
          style={{
            position: "fixed",
            right: 18,
            bottom: 96,
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "#ff2f2f",
            border: "none",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 14px 28px rgba(255,47,47,0.35)",
            cursor: "pointer",
            zIndex: 60,
          }}
          aria-label="Edit profile"
        >
          <FiEdit2 size={20} />
        </button>
      )}

      {editMode && (
        <div
          style={{
            position: "fixed",
            right: 18,
            bottom: 96,
            display: "flex",
            gap: 12,
            zIndex: 60,
          }}
        >
          <button
            onClick={cancelEditMode}
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "#1a1a1a",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <FiX size={18} />
          </button>

          <button
            onClick={saveProfile}
            disabled={!dirty}
            style={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              background: dirty ? "#22c55e" : "#2a2a2a",
              border: "none",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: dirty ? "pointer" : "not-allowed",
              boxShadow: dirty
                ? "0 16px 28px rgba(34,197,94,0.45)"
                : "none",
            }}
          >
            <FiCheck size={20} />
          </button>
        </div>
      )}

      {/* ======================================================
          AVATAR ACTION SHEET
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
              padding: 16,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 14 }}>
              Edit profile picture
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <button onClick={() => inputPhotoRef.current?.click()} style={sheetBtn}>
                Pick from Photos
              </button>
              <button onClick={() => inputCameraRef.current?.click()} style={sheetBtn}>
                Take a Picture
              </button>
              <button onClick={() => inputFileRef.current?.click()} style={sheetBtn}>
                Choose from Files
              </button>

              <button
                onClick={async () => {
                  setAvatarUrl("");
                  setDirty(true);
                  setAvatarMenuOpen(false);
                  await supabase.from("profiles").upsert({
                    id: user.id,
                    avatar_url: "",
                  });
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
                style={{ ...sheetBtn, background: "#1a1a1a" }}
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
          <div
            style={{
              height: 64,
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

            <div style={{ fontWeight: 900 }}>Crop Photo</div>

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
              onChange={(e) => setZoom(clamp(Number(e.target.value), 1, 3))}
              style={{ width: "100%" }}
            />
          </div>
        </div>
      )}

      {/* SETTINGS OVERLAY (UNTOUCHED) */}
      <SettingsOverlay open={settingsOpen} onClose={() => setSettingsOpen(false)} />
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
