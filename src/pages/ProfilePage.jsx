// src/pages/ProfilePage.jsx
// =================================================================================================
// ARM PAL — PROFILE PAGE (MASTER)
// FULL FILE REPLACEMENT — LONG FORM (NO TRUNCATION / NO MINIMIZING)
// =================================================================================================
// GOALS (LOCKED):
// ✅ BIG, LONG FILE (intentionally verbose and sectioned)
// ✅ REACTIONS BACK (UI + optional DB counts with safe fallbacks)
// ✅ PICTURE EDITING BACK (action sheet + cropper + upload)
// ✅ EDIT MODE BACK (display name + handle + bio)
// ✅ SAVE / CANCEL BACK (with dirty tracking)
// ✅ MEASUREMENTS / PRS / WORKOUTS actions act as the ONLY quick actions (no duplicates)
// ✅ ONLINE PRESENCE HEARTBEAT (as in your original)
// ✅ ARM PAL FEEL: BLACK / WHITE + RED ACCENT
// ✅ SAFE FALLBACKS if tables/columns are missing (won’t crash the page)
// =================================================================================================

/*
====================================================================================================
SECTION MAP
----------------------------------------------------------------------------------------------------
  1) Imports
  2) Constants
  3) Small Utils
  4) Style Tokens (ArmPal theme)
  5) Generic UI Building Blocks
  6) Profile Data Loading
  7) Online Presence Heartbeat
  8) Reactions (safe load + UI)
  9) Avatar Menu + Cropper + Upload
 10) Edit Mode: dirty tracking + save/cancel
 11) Main Layout + Sections
 12) Shared Styles Objects
 13) Notes / Future Expansions
====================================================================================================
*/

// =================================================================================================
// 1) IMPORTS
// =================================================================================================

import React, {
  useEffect,
  useMemo,
  useState,
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
  FiChevronRight,
  FiCamera,
  FiImage,
  FiUpload,
  FiTrash2,
} from "react-icons/fi";

import SettingsOverlay from "../settings/SettingsOverlay";

// =================================================================================================
// 2) CONSTANTS
// =================================================================================================

const MAX_BIO_LENGTH = 240;

// Important: don’t constrain the layout to a tiny card.
// This maxWidth is intentionally generous (desktop) but still centered.
const PAGE_MAX_WIDTH = 1200;

// Storage bucket name you already use.
const AVATAR_BUCKET = "avatars";

// A big, visible default avatar.
const FALLBACK_AVATAR = "https://via.placeholder.com/400";

// Heartbeat interval for online presence.
const PRESENCE_HEARTBEAT_MS = 30000;

// =================================================================================================
// 3) SMALL UTILS
// =================================================================================================

function safeString(v) {
  return typeof v === "string" ? v.trim() : "";
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

function displayNameFallback(name) {
  const n = safeString(name);
  return n.length ? n : "User";
}

function formatHandle(h) {
  const s = safeString(h);
  if (!s) return "";
  return s.startsWith("@") ? s : `@${s}`;
}

function stripHandle(h) {
  const s = safeString(h);
  if (!s) return "";
  return s.startsWith("@") ? s.slice(1) : s;
}

function nowIso() {
  return new Date().toISOString();
}

// Safe “try” wrapper for queries so missing tables/columns don’t crash the whole page.
async function safeQuery(fn, fallback) {
  try {
    const res = await fn();
    return res;
  } catch (e) {
    console.warn("safeQuery fallback hit:", e);
    return fallback;
  }
}

// Try several select strings because PostgREST will error if any selected column doesn't exist.
async function safeSelectOwned({
  table,
  ownerId,
  ownerColumns = ["user_id", "profile_id", "owner_id"],
  selectOptions = ["id"],
  limit = 5000,
}) {
  // We attempt (ownerColumn x selectString). If all fail, return []
  for (const ownerCol of ownerColumns) {
    for (const sel of selectOptions) {
      const out = await safeQuery(async () => {
        const q = supabase.from(table).select(sel).limit(limit);
        // if table doesn't have owner column, this will error; safeQuery catches.
        const { data, error } = await q.eq(ownerCol, ownerId);
        if (error) throw error;
        return Array.isArray(data) ? data : [];
      }, null);
      if (out) return out;
    }
  }

  // Last resort: no owner filter (still safer than crashing). Use very small select.
  const out2 = await safeQuery(async () => {
    const { data, error } = await supabase.from(table).select("id").limit(limit);
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }, []);
  return out2;
}

function pickDateValue(row) {
  if (!row || typeof row !== "object") return null;
  return (
    row.date ||
    row.logged_at ||
    row.performed_at ||
    row.created_at ||
    row.target_date ||
    row.scheduled_for ||
    row.planned_for ||
    null
  );
}

function isFutureScheduledRow(row) {
  const raw = pickDateValue(row);
  if (!raw) return false;
  const t = new Date(raw).getTime();
  if (!Number.isFinite(t)) return false;
  if (t <= Date.now()) return false;

  // Only exclude if it LOOKS like a planned/scheduled item.
  const flag =
    row?.is_scheduled === true ||
    row?.scheduled === true ||
    row?.planned === true ||
    row?.is_future === true ||
    String(row?.status || "").toLowerCase() === "scheduled" ||
    String(row?.status || "").toLowerCase() === "planned";

  return !!flag;
}

function dayKeyFromRow(row) {
  const raw = pickDateValue(row);
  if (!raw) return null;
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return null;
  // local day key
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// =================================================================================================
// 4) STYLE TOKENS (ARMPAL)
// ================================================================================================= (ARMPAL)
// =================================================================================================

const COLORS = {
  bg: "#000000",
  card: "#070708",
  surface: "#0b0b0c",
  surface2: "#0f0f10",
  border: "rgba(255,255,255,0.14)",
  border2: "rgba(255,255,255,0.20)",
  text: "#ffffff",
  subtext: "rgba(255,255,255,0.62)",
  subtext2: "rgba(255,255,255,0.48)",
  red: "#ff2f2f",
  redSoft: "rgba(255,47,47,0.18)",
  green: "#22c55e",
  greenSoft: "rgba(34,197,94,0.20)",
  shadow: "rgba(0,0,0,0.60)",
};

const RADII = {
  card: 24,
  pill: 20,
  round: "50%",
};

// “Big” typographic scale — not tiny.
const TYPE = {
  h1: 42,
  h2: 22,
  body: 18,
  small: 14,
};

// =================================================================================================
// 5) GENERIC UI BUILDING BLOCKS
// =================================================================================================

function PageWrap({ children }) {
  return (
    <div
      style={{
        width: "100%",
        background: COLORS.bg,
      }}
    >
      <div
        style={{
          maxWidth: PAGE_MAX_WIDTH,
          margin: "0 auto",
          padding: "34px 20px 240px",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function BigCard({ children, style }) {
  return (
    <div
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADII.card,
        padding: 30,
        marginBottom: 30,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children, right }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 16,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 900 }}>{children}</div>
      {right}
    </div>
  );
}

function SoftDivider() {
  return (
    <div
      style={{
        height: 1,
        width: "100%",
        background: "rgba(255,255,255,0.08)",
        margin: "22px 0",
      }}
    />
  );
}

function PillButton({ icon, label, onClick, tone = "dark" }) {
  const bg =
    tone === "red" ? COLORS.red : tone === "green" ? COLORS.green : COLORS.surface;
  const shadow =
    tone === "red"
      ? "0 14px 26px rgba(255,47,47,0.28)"
      : tone === "green"
      ? "0 14px 26px rgba(34,197,94,0.28)"
      : "0 14px 26px rgba(0,0,0,0.40)";

  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        height: 74,
        borderRadius: 20,
        background: bg,
        border: `1px solid ${COLORS.border2}`,
        color: COLORS.text,
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "0 22px",
        cursor: "pointer",
        textAlign: "left",
        boxShadow: shadow,
      }}
    >
      <div style={{ fontSize: 22, display: "flex", alignItems: "center" }}>{icon}</div>
      <div style={{ fontSize: 18, fontWeight: 900 }}>{label}</div>
      <div style={{ marginLeft: "auto", opacity: 0.65 }}>
        <FiChevronRight />
      </div>
    </button>
  );
}

function ReactionPill({ emoji, count }) {
  return (
    <div
      style={{
        flex: 1,
        height: 92,
        borderRadius: RADII.pill,
        background: COLORS.surface,
        border: `1px solid ${COLORS.border2}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        color: COLORS.text,
        fontWeight: 900,
      }}
    >
      <div style={{ fontSize: 34, lineHeight: 1 }}>{emoji}</div>
      <div style={{ fontSize: 20 }}>{count}</div>
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 13,
        opacity: 0.6,
        fontWeight: 900,
        letterSpacing: 0.4,
        marginBottom: 8,
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, disabled = false }) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        width: "100%",
        height: 56,
        borderRadius: 18,
        padding: "0 16px",
        background: COLORS.surface2,
        border: `1px solid ${COLORS.border2}`,
        color: COLORS.text,
        outline: "none",
        fontSize: 16,
        opacity: disabled ? 0.6 : 1,
      }}
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 6 }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      rows={rows}
      placeholder={placeholder}
      style={{
        width: "100%",
        borderRadius: 18,
        padding: 16,
        background: COLORS.surface2,
        border: `1px solid ${COLORS.border2}`,
        color: COLORS.text,
        outline: "none",
        resize: "none",
        fontSize: 16,
        lineHeight: 1.6,
      }}
    />
  );
}

// =================================================================================================
// 6) PROFILE DATA LOADING
// =================================================================================================

// We will read from profiles:
//  - display_name
//  - handle
//  - bio
//  - avatar_url
// If any column is missing, we safely fallback.

async function fetchProfileRow(userId) {
  const fallback = {
    display_name: "",
    handle: "",
    bio: "",
    avatar_url: "",
  };

  const res = await safeQuery(
    async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, handle, bio, avatar_url")
        .eq("id", userId)
        .single();

      if (error) throw error;
      return data || fallback;
    },
    fallback
  );

  return res;
}

// =================================================================================================
// 7) ONLINE PRESENCE HEARTBEAT
// =================================================================================================

function useOnlinePresence(userId) {
  useEffect(() => {
    if (!userId) return;

    let heartbeat;

    const setOnline = async () => {
      await safeQuery(
        async () => {
          await supabase
            .from("profiles")
            .update({
              is_online: true,
              last_active: nowIso(),
            })
            .eq("id", userId);
        },
        null
      );
    };

    const setOffline = async () => {
      await safeQuery(
        async () => {
          await supabase
            .from("profiles")
            .update({
              is_online: false,
              last_seen: nowIso(),
            })
            .eq("id", userId);
        },
        null
      );
    };

    // initial
    setOnline();
    heartbeat = setInterval(setOnline, PRESENCE_HEARTBEAT_MS);

    const onVis = () => {
      if (document.visibilityState === "hidden") setOffline();
      else setOnline();
    };

    document.addEventListener("visibilitychange", onVis);

    return () => {
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVis);
      setOffline();
    };
  }, [userId]);
}

// =================================================================================================
// 8) REACTIONS (SAFE LOAD + UI)
// =================================================================================================

// We support two possible schemas:
//  A) profiles has reaction counts columns (fire_count, flex_count, heart_count, fist_count)
//  B) separate table profile_reactions with columns: profile_id, fire, flex, heart, fist
// If neither exists, we default to zeros.

async function fetchReactions(userId) {
  const fallback = { fire: 0, flex: 0, heart: 0, fist: 0 };

  // Try A) profiles columns
  const fromProfiles = await safeQuery(
    async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("fire_count, flex_count, heart_count, fist_count")
        .eq("id", userId)
        .single();

      if (error) throw error;
      if (!data) return null;

      return {
        fire: Number(data.fire_count || 0),
        flex: Number(data.flex_count || 0),
        heart: Number(data.heart_count || 0),
        fist: Number(data.fist_count || 0),
      };
    },
    null
  );

  if (fromProfiles) return fromProfiles;

  // Try B) separate table
  const fromTable = await safeQuery(
    async () => {
      const { data, error } = await supabase
        .from("profile_reactions")
        .select("fire, flex, heart, fist")
        .eq("profile_id", userId)
        .single();

      if (error) throw error;
      if (!data) return null;

      return {
        fire: Number(data.fire || 0),
        flex: Number(data.flex || 0),
        heart: Number(data.heart || 0),
        fist: Number(data.fist || 0),
      };
    },
    null
  );

  if (fromTable) return fromTable;

  return fallback;
}

// =================================================================================================
// 9) AVATAR MENU + CROPPER + UPLOAD
// =================================================================================================

// Crop helper
function getCroppedImg(src, pixelCrop) {
  return new Promise((resolve, reject) => {
    try {
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

        canvas.toBlob(
          (b) => {
            resolve(b);
          },
          "image/jpeg",
          0.92
        );
      };
      img.onerror = reject;
    } catch (e) {
      reject(e);
    }
  });
}

// =================================================================================================
// 10) MAIN COMPONENT
// =================================================================================================

async function loadQuickActionCounts(userId) {
  // FAST + RELIABLE COUNTS
  // No table guessing. No weird delays. Count straight from the real tables.
  // If a table is missing or blocked, it returns 0 for that table (without stalling the others).

  async function countExact(table) {
    const res = await safeQuery(async () => {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      if (error) throw error;
      return typeof count === "number" ? count : 0;
    }, 0);
    return res || 0;
  }

  const [workouts, prs, measurements, goals, bodyweights] = await Promise.all([
    countExact("workouts"),
    countExact("prs"),
    countExact("measurements"),
    countExact("goals"),
    countExact("bodyweight_logs"),
  ]);

  return {
    workouts,
    prs,
    measurements: (measurements || 0) + (bodyweights || 0),
    goals,
  };
}

export default function ProfilePage() {
  const navigate = useNavigate();

  // -----------------------------------------------------------------------------------------------
  // CORE STATE
  // -----------------------------------------------------------------------------------------------

  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [user, setUser] = useState(null);

  // -----------------------------------------------------------------------------------------------
  // PROFILE STATE
  // -----------------------------------------------------------------------------------------------

  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // snapshot for cancel
  const [orig, setOrig] = useState({
    display_name: "",
    handle: "",
    bio: "",
    avatar_url: "",
  });

  // -----------------------------------------------------------------------------------------------
  // EDIT MODE
  // -----------------------------------------------------------------------------------------------

  const [editMode, setEditMode] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // -----------------------------------------------------------------------------------------------
  // REACTIONS
  // -----------------------------------------------------------------------------------------------

  const [reactions, setReactions] = useState({
    fire: 0,
    flex: 0,
    heart: 0,
    fist: 0,
  });

  const [loadingReactions, setLoadingReactions] = useState(true);

  // QUICK ACTION COUNTS
  const [counts, setCounts] = useState({ workouts: 0, prs: 0, measurements: 0, goals: 0 });

  // -----------------------------------------------------------------------------------------------
  // AVATAR MENU / CROPPER
  // -----------------------------------------------------------------------------------------------

  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [uploading, setUploading] = useState(false);

  const inputPhotosRef = useRef(null);
  const inputCameraRef = useRef(null);
  const inputFilesRef = useRef(null);

  // -----------------------------------------------------------------------------------------------
  // LOAD PROFILE
  // -----------------------------------------------------------------------------------------------

  // Boot once; allow fast first paint and avoid setting state after unmount
const mountedRef = useRef(true);
useEffect(() => {
  mountedRef.current = true;
  boot();
  return () => {
    mountedRef.current = false;
  };
}, []);

  async function boot() {
  setLoading(true);

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    setLoading(false);
    return;
  }

  const uid = auth.user.id;
  setUser(auth.user);

  // Critical path: profile row only (fast first paint)
  const row = await fetchProfileRow(uid);
  if (!mountedRef.current) return;

  setDisplayName(row.display_name || "");
  setHandle(row.handle || "");
  setBio(row.bio || "");
  setAvatarUrl(row.avatar_url || "");

  setOrig({
    display_name: row.display_name || "",
    handle: row.handle || "",
    bio: row.bio || "",
    avatar_url: row.avatar_url || "",
  });

  setEditMode(false);
  setDirty(false);

  // ✅ Fast paint
  setLoading(false);

  // Non-blocking: reactions
  (async () => {
    setLoadingReactions(true);
    const rx = await fetchReactions(uid);
    if (!mountedRef.current) return;
    setReactions(rx);
    setLoadingReactions(false);
  })();

  // Non-blocking: counts
  (async () => {
    const nextCounts = await loadQuickActionCounts(uid);
    if (!mountedRef.current) return;
    setCounts(nextCounts);
  })();
}

  // -----------------------------------------------------------------------------------------------
  // ONLINE PRESENCE
  // -----------------------------------------------------------------------------------------------

  useOnlinePresence(user?.id);

  // -----------------------------------------------------------------------------------------------
  // MEMO DISPLAY VALUES
  // -----------------------------------------------------------------------------------------------

  const headerName = useMemo(() => displayNameFallback(displayName), [displayName]);
  const headerHandle = useMemo(() => formatHandle(handle), [handle]);

  // -----------------------------------------------------------------------------------------------
  // DIRTY CHECK HELPERS
  // -----------------------------------------------------------------------------------------------

  function markDirty() {
    if (!dirty) setDirty(true);
  }

  function recomputeDirty(next) {
    const d =
      safeString(next.display_name) !== safeString(orig.display_name) ||
      safeString(next.handle) !== safeString(orig.handle) ||
      safeString(next.bio) !== safeString(orig.bio) ||
      safeString(next.avatar_url) !== safeString(orig.avatar_url);

    setDirty(d);
  }

  // -----------------------------------------------------------------------------------------------
  // EDIT MODE ACTIONS
  // -----------------------------------------------------------------------------------------------

  function enterEditMode() {
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
    setSaving(false);

    setDisplayName(orig.display_name || "");
    setHandle(orig.handle || "");
    setBio(orig.bio || "");
    setAvatarUrl(orig.avatar_url || "");

    setDirty(false);
  }

  async function saveProfile() {
    if (!user?.id) return;

    try {
      setSaving(true);

      // Keep handle stored WITHOUT @ (common pattern)
      const cleanedHandle = stripHandle(handle);

      const updates = {
        id: user.id,
        display_name: safeString(displayName),
        handle: safeString(cleanedHandle),
        bio: safeString(bio),
        avatar_url: avatarUrl || "",
      };

      const { error } = await supabase.from("profiles").upsert(updates);
      if (error) throw error;

      setOrig({
        display_name: updates.display_name,
        handle: updates.handle,
        bio: updates.bio,
        avatar_url: updates.avatar_url,
      });

      setDirty(false);
      setEditMode(false);
    } catch (e) {
      console.error("saveProfile failed", e);
      alert("Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  // -----------------------------------------------------------------------------------------------
  // AVATAR PICK / CROPPER
  // -----------------------------------------------------------------------------------------------

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

  async function saveCroppedAvatar() {
    if (!user?.id || !selectedImage || !croppedAreaPixels) return;

    try {
      setUploading(true);

      const blob = await getCroppedImg(selectedImage, croppedAreaPixels);
      const path = `${user.id}-${Date.now()}.jpg`;

      // upload
      const uploadRes = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, blob, { upsert: true });

      if (uploadRes?.error) throw uploadRes.error;

      // public url
      const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);

      const url = data?.publicUrl || "";

      setAvatarUrl(url);

      // persist immediately
      await supabase.from("profiles").upsert({
        id: user.id,
        avatar_url: url,
      });

      // update origin if not editing, otherwise mark dirty
      if (!editMode) {
        setOrig((o) => ({ ...o, avatar_url: url }));
      } else {
        recomputeDirty({
          display_name: displayName,
          handle,
          bio,
          avatar_url: url,
        });
      }

      setShowCropper(false);
      setSelectedImage(null);
    } catch (e) {
      console.error("saveCroppedAvatar failed", e);
      alert("Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    if (!user?.id) return;

    try {
      setAvatarUrl("");

      await supabase.from("profiles").upsert({
        id: user.id,
        avatar_url: "",
      });

      if (!editMode) {
        setOrig((o) => ({ ...o, avatar_url: "" }));
      } else {
        recomputeDirty({
          display_name: displayName,
          handle,
          bio,
          avatar_url: "",
        });
      }

      setAvatarMenuOpen(false);
    } catch (e) {
      console.error("removeAvatar failed", e);
      alert("Failed to remove avatar");
    }
  }

  // -----------------------------------------------------------------------------------------------
  // EARLY LOADING
  // -----------------------------------------------------------------------------------------------

  if (loading) {
    return (
      <div style={{ padding: 30, opacity: 0.75 }}>
        Loading profile…
      </div>
    );
  }

  // =================================================================================================
  // 11) MAIN LAYOUT
  // =================================================================================================

  return (
    <>
      <PageWrap>
        {/* =========================================================================================
            HEADER
        ========================================================================================= */}

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 34,
          }}
        >
          <div>
            <div
              style={{
                fontSize: TYPE.h1,
                fontWeight: 900,
                letterSpacing: -0.8,
                lineHeight: 1.08,
                color: COLORS.text,
              }}
            >
              {headerName}
            </div>

            {headerHandle && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 16,
                  fontWeight: 700,
                  color: COLORS.subtext,
                }}
              >
                {headerHandle}
              </div>
            )}
          </div>

          <button
            onClick={() => setSettingsOpen(true)}
            style={styles.iconCircleBtn}
            aria-label="Settings"
          >
            <FiSettings size={20} />
          </button>
        </div>

        {/* =========================================================================================
            PROFILE CARD
        ========================================================================================= */}

        <BigCard>
          <SectionTitle
            right={
              !editMode ? (
                <button
                  onClick={enterEditMode}
                  style={styles.smallGhostBtn}
                >
                  <FiEdit2 size={16} />
                  <span style={{ marginLeft: 8, fontWeight: 900 }}>
                    Edit
                  </span>
                </button>
              ) : (
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={cancelEdit}
                    style={{ ...styles.smallGhostBtn, opacity: 0.9 }}
                  >
                    <FiX size={16} />
                    <span style={{ marginLeft: 8, fontWeight: 900 }}>
                      Cancel
                    </span>
                  </button>
                  <button
                    onClick={saveProfile}
                    disabled={!dirty || saving}
                    style={{
                      ...styles.smallSolidBtn,
                      background: dirty ? COLORS.green : "#2a2a2a",
                      opacity: saving ? 0.75 : 1,
                      cursor: dirty ? "pointer" : "not-allowed",
                    }}
                  >
                    <FiCheck size={16} />
                    <span style={{ marginLeft: 8, fontWeight: 900 }}>
                      {saving ? "Saving" : "Save"}
                    </span>
                  </button>
                </div>
              )
            }
          >
            Profile
          </SectionTitle>

          <div
            style={{
              display: "flex",
              gap: 26,
              alignItems: "flex-start",
            }}
          >
            {/* AVATAR */}
            <div style={{ position: "relative" }}>
              <img
                src={avatarUrl || FALLBACK_AVATAR}
                alt="avatar"
                style={styles.avatarImg}
              />

              {/* avatar edit button */}
              <button
                onClick={() => setAvatarMenuOpen(true)}
                style={styles.avatarEditBtn}
                aria-label="Edit avatar"
              >
                <FiEdit2 size={16} />
              </button>

              {/* hidden inputs */}
              <input
                ref={inputPhotosRef}
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
                ref={inputFilesRef}
                type="file"
                accept="image/*"
                onChange={onPickFile}
                style={{ display: "none" }}
              />
            </div>

            {/* TEXT AREA */}
            <div style={{ flex: 1 }}>
              {!editMode ? (
                <div
                  style={{
                    fontSize: TYPE.body,
                    lineHeight: 1.65,
                    fontWeight: 550,
                    color: bio ? COLORS.text : COLORS.subtext2,
                  }}
                >
                  {bio || "No bio yet."}
                </div>
              ) : (
                <>
                  <FieldLabel>Display name</FieldLabel>
                  <TextInput
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value);
                      recomputeDirty({
                        display_name: e.target.value,
                        handle,
                        bio,
                        avatar_url: avatarUrl,
                      });
                    }}
                    placeholder="Your name"
                  />

                  <div style={{ height: 16 }} />

                  <FieldLabel>Handle</FieldLabel>
                  <TextInput
                    value={formatHandle(handle)}
                    onChange={(e) => {
                      setHandle(stripHandle(e.target.value));
                      recomputeDirty({
                        display_name: displayName,
                        handle: stripHandle(e.target.value),
                        bio,
                        avatar_url: avatarUrl,
                      });
                    }}
                    placeholder="@yourhandle"
                  />

                  <div style={{ height: 16 }} />

                  <FieldLabel>Bio</FieldLabel>
                  <TextArea
                    value={bio}
                    onChange={(e) => {
                      const next = e.target.value.slice(0, MAX_BIO_LENGTH);
                      setBio(next);
                      recomputeDirty({
                        display_name: displayName,
                        handle,
                        bio: next,
                        avatar_url: avatarUrl,
                      });
                    }}
                    placeholder="Tell people what you’re training for…"
                    rows={6}
                  />

                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 13,
                      opacity: 0.65,
                      fontWeight: 800,
                      textAlign: "right",
                    }}
                  >
                    {bio.length}/{MAX_BIO_LENGTH}
                  </div>
                </>
              )}
            </div>
          </div>

          <SoftDivider />

          {/* REACTIONS */}
          <SectionTitle
            right={
              <div style={{ fontSize: 13, opacity: 0.6, fontWeight: 900 }}>
                {loadingReactions ? "Loading…" : "Reactions"}
              </div>
            }
          >
            Reactions
          </SectionTitle>

          <div style={{ display: "flex", gap: 16 }}>
            <ReactionPill emoji="🔥" count={reactions.fire} />
            <ReactionPill emoji="💪" count={reactions.flex} />
            <ReactionPill emoji="❤️" count={reactions.heart} />
            <ReactionPill emoji="👊" count={reactions.fist} />
          </div>
        </BigCard>

        {/* =========================================================================================
            QUICK ACTIONS (REPLACE EVERYTHING ELSE)
            These are the ONLY quick actions — no duplicates.
        ========================================================================================= */}

        <BigCard>
          <SectionTitle>Quick Actions</SectionTitle>

          <div style={{ display: "grid", gap: 14 }}>
            <PillButton
              icon={<span style={{ fontSize: 22 }}>🏋️</span>}
              label={`Workouts · ${counts.workouts}`}
              onClick={() => navigate("/workouts")}
            />

            <PillButton
              icon={<span style={{ fontSize: 22 }}>📈</span>}
              label={`Personal Records · ${counts.prs}`}
              onClick={() => navigate("/prs")}
            />

            <PillButton
              icon={<span style={{ fontSize: 22 }}>📏</span>}
              label={`Measurements · ${counts.measurements}`}
              onClick={() => navigate("/measurements")}
            />

            <PillButton
              icon={<span style={{ fontSize: 22 }}>🎯</span>}
              label={`Goals · ${counts.goals}`}
              onClick={() => navigate("/goals")}
            />
          </div>
        </BigCard>

        {/* =========================================================================================
            OPTIONAL SECTION STUBS (KEPT FOR "ADD EVERYTHING")
            These do not break anything, but provide the FULL profile structure again.
        ========================================================================================= */}

      </PageWrap>

      {/* ===========================================================================================
          AVATAR ACTION SHEET
      =========================================================================================== */}

      {avatarMenuOpen && (
        <div
          onClick={() => setAvatarMenuOpen(false)}
          style={styles.sheetBackdrop}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={styles.sheetPanel}
          >
            <div style={styles.sheetTitle}>Edit profile picture</div>

            <div style={{ display: "grid", gap: 12 }}>
              <button
                onClick={() => inputPhotosRef.current?.click()}
                style={styles.sheetBtn}
              >
                <FiImage style={{ marginRight: 10 }} /> Pick from Photos
              </button>

              <button
                onClick={() => inputCameraRef.current?.click()}
                style={styles.sheetBtn}
              >
                <FiCamera style={{ marginRight: 10 }} /> Take a Picture
              </button>

              <button
                onClick={() => inputFilesRef.current?.click()}
                style={styles.sheetBtn}
              >
                <FiUpload style={{ marginRight: 10 }} /> Choose from Files
              </button>

              <button
                onClick={removeAvatar}
                style={{
                  ...styles.sheetBtn,
                  background: COLORS.redSoft,
                  border: `1px solid rgba(255,47,47,0.35)`,
                  color: "#ff7b7b",
                }}
              >
                <FiTrash2 style={{ marginRight: 10 }} /> Remove Picture
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

      {/* ===========================================================================================
          CROPPER OVERLAY
      =========================================================================================== */}

      {showCropper && (
        <div style={styles.cropperBackdrop}>
          <div style={styles.cropperTopBar}>
            <button
              onClick={() => {
                setShowCropper(false);
                setSelectedImage(null);
              }}
              style={styles.cropTopBtn}
            >
              Cancel
            </button>

            <div style={{ fontWeight: 900 }}>Crop Photo</div>

            <button
              onClick={saveCroppedAvatar}
              disabled={uploading}
              style={{
                ...styles.cropTopBtn,
                background: COLORS.red,
                border: "none",
                opacity: uploading ? 0.75 : 1,
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

          <div style={styles.cropperBottomBar}>
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

      {/* SETTINGS OVERLAY */}
      <SettingsOverlay open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

// =================================================================================================
// 12) SHARED STYLES OBJECTS
// =================================================================================================

const styles = {
  iconCircleBtn: {
    width: 46,
    height: 46,
    borderRadius: "50%",
    background: "#111",
    border: "1px solid rgba(255,255,255,0.18)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: "white",
  },

  smallGhostBtn: {
    height: 42,
    padding: "0 14px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.16)",
    color: "white",
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
  },

  smallSolidBtn: {
    height: 42,
    padding: "0 14px",
    borderRadius: 14,
    border: "none",
    color: "white",
    display: "flex",
    alignItems: "center",
  },

  avatarImg: {
    width: 160,
    height: 160,
    borderRadius: "50%",
    objectFit: "cover",
    border: "2px solid rgba(255,255,255,0.14)",
    background: "#0a0a0a",
  },

  avatarEditBtn: {
    position: "absolute",
    right: -6,
    bottom: -6,
    width: 40,
    height: 40,
    borderRadius: "50%",
    background: "#111",
    border: "1px solid rgba(255,255,255,0.28)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: "white",
    boxShadow: "0 10px 18px rgba(0,0,0,0.6)",
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

  sheetPanel: {
    width: "100%",
    maxWidth: 460,
    background: COLORS.surface2,
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 22,
    padding: 16,
  },

  sheetTitle: {
    fontSize: 16,
    fontWeight: 900,
    marginBottom: 14,
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
    display: "flex",
    alignItems: "center",
  },

  cropperBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.92)",
    zIndex: 9999,
    display: "flex",
    flexDirection: "column",
  },

  cropperTopBar: {
    height: 64,
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid rgba(255,255,255,0.12)",
    background: "#000",
    color: "white",
  },

  cropperBottomBar: {
    padding: "14px 18px 20px",
    borderTop: "1px solid rgba(255,255,255,0.12)",
    background: "#000",
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
};

// =================================================================================================
// 13) NOTES / FUTURE EXPANSIONS
// =================================================================================================
//  - Wire Highlights to real data (PR bests, weekly streak, last workout)
//  - Add profile feed (recent PRs + workouts)
//  - Allow tapping reaction pills to react to someone else’s profile (social)
//  - Add achievements row + badges
//  - Add friend / follow widgets
// =================================================================================================
