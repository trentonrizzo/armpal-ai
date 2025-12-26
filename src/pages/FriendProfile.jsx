// src/pages/FriendProfile.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate, useParams } from "react-router-dom";

export default function FriendProfile() {
  const { friendId } = useParams();
  const navigate = useNavigate();

  const [me, setMe] = useState(null);
  const [p, setP] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMe(data?.user || null);

      const { data: prof, error } = await supabase
        .from("profiles")
        .select("id, username, handle, display_name, avatar_url, bio, last_active")
        .eq("id", friendId)
        .maybeSingle();

      if (error) console.error("FriendProfile load error:", error);
      setP(prof || null);
      setLoading(false);
    })();
  }, [friendId]);

  function isOnline(lastActive) {
    if (!lastActive) return false;
    return Date.now() - new Date(lastActive).getTime() < 60 * 1000;
  }

  function formatAgoNoMonths(ts) {
    if (!ts) return "";
    const ms = Date.now() - new Date(ts).getTime();
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d`;
    const wk = Math.floor(day / 7);
    if (wk <= 53) return `${wk}w`;
    const yr = Math.floor(day / 365);
    return `${yr}y`;
  }

  async function confirmUnadd() {
    if (!me?.id || !friendId) return;
    setBusy(true);

    try {
      await supabase
        .from("friends")
        .delete()
        .or(
          `and(user_id.eq.${me.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${me.id})`
        );

      navigate("/friends");
    } finally {
      setBusy(false);
      setShowConfirm(false);
    }
  }

  const displayName = p?.display_name || p?.username || p?.handle || "Profile";
  const online = isOnline(p?.last_active);
  const lastAgo = formatAgoNoMonths(p?.last_active);

  if (loading) return <div style={wrap} />;

  return (
    <div style={wrap}>
      <div style={topRow}>
        <button style={backBtn} onClick={() => navigate(-1)}>←</button>
        <div style={topTitle}>Profile</div>
        <div style={{ width: 44 }} />
      </div>

      <div style={card}>
        <div style={row}>
          <div style={avatar} onClick={() => setShowImage(true)}>
            {p?.avatar_url ? (
              <img
                src={p.avatar_url}
                alt={displayName}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              displayName.charAt(0).toUpperCase()
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={name}>{displayName}</div>
            {p?.handle && <div style={handle}>@{p.handle}</div>}
            <div style={status}>
              {online ? "Online" : `Offline${lastAgo ? ` · ${lastAgo}` : ""}`}
            </div>
          </div>
        </div>

        <div style={bio}>{p?.bio?.trim() || "No bio yet."}</div>
      </div>

      <button style={unaddBtn} onClick={() => setShowConfirm(true)}>
        Unadd Friend
      </button>
      {/* IMAGE PREVIEW */}
      {showImage && p?.avatar_url && (
        <div style={overlay} onClick={() => setShowImage(false)}>
          <img src={p.avatar_url} alt="profile" style={previewImg} />
        </div>
      )}

      {/* CONFIRM UNADD */}
      {showConfirm && (
        <div style={overlay}>
          <div style={confirmCard}>
            <div style={confirmTitle}>Unadd this friend?</div>
            <div style={confirmText}>
              They will be removed from your friends list.
            </div>

            <div style={confirmActions}>
              <button
                style={cancelBtn}
                onClick={() => setShowConfirm(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                style={confirmBtn}
                onClick={confirmUnadd}
                disabled={busy}
              >
                {busy ? "Unadding…" : "Unadd"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- STYLES ---------------- */

const wrap = {
  minHeight: "100vh",
  padding: "18px 16px 90px",
  background: "black",
  color: "white",
};

const topRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 18,
};

const topTitle = { fontSize: 19, fontWeight: 900 };

const backBtn = {
  width: 44,
  height: 44,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  color: "white",
  fontSize: 18,
  fontWeight: 900,
};

const card = {
  background: "#101010",
  borderRadius: 20,
  padding: 18,
  border: "1px solid rgba(255,255,255,0.08)",
};

const row = { display: "flex", alignItems: "center", gap: 18 };

const avatar = {
  width: 76,
  height: 76,
  borderRadius: "50%",
  background: "#000",
  border: "1px solid rgba(255,255,255,0.14)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 30,
  fontWeight: 900,
  overflow: "hidden",
  cursor: "pointer",
};

const name = { fontSize: 24, fontWeight: 900 };
const handle = { fontSize: 14, opacity: 0.65, marginTop: 2 };
const status = { fontSize: 13, marginTop: 6, opacity: 0.7 };
const bio = { marginTop: 18, fontSize: 15, opacity: 0.85 };

const unaddBtn = {
  width: "100%",
  marginTop: 22,
  padding: "16px",
  borderRadius: 18,
  background: "rgba(255,47,47,0.12)",
  border: "1px solid rgba(255,47,47,0.35)",
  color: "white",
  fontWeight: 900,
};

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.75)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
};

const previewImg = {
  width: "90%",
  maxWidth: 360,
  borderRadius: 18,
};

const confirmCard = {
  width: "90%",
  maxWidth: 340,
  background: "#0f0f0f",
  borderRadius: 18,
  padding: 18,
  border: "1px solid rgba(255,255,255,0.08)",
};

const confirmTitle = { fontSize: 18, fontWeight: 900 };
const confirmText = { fontSize: 13, opacity: 0.7, marginTop: 6 };

const confirmActions = { display: "flex", gap: 10, marginTop: 18 };

const cancelBtn = {
  flex: 1,
  padding: "14px",
  borderRadius: 14,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.15)",
  color: "white",
  fontWeight: 800,
};

const confirmBtn = {
  flex: 1,
  padding: "14px",
  borderRadius: 14,
  background: "#ff2f2f",
  color: "white",
  fontWeight: 900,
};
