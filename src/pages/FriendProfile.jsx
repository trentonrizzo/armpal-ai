// src/pages/FriendProfile.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate, useParams } from "react-router-dom";

const REACTIONS = ["💪", "👊", "❤️", "🔥"];

export default function FriendProfile() {
  const { friendId } = useParams();
  const navigate = useNavigate();

  const [me, setMe] = useState(null);
  const [p, setP] = useState(null);
  const [loading, setLoading] = useState(true);

  const [showConfirm, setShowConfirm] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [busy, setBusy] = useState(false);

  // 🔥 reactions
  const [reactionCounts, setReactionCounts] = useState({});
  const [myReaction, setMyReaction] = useState(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMe(data?.user || null);

      const { data: prof } = await supabase
        .from("profiles")
        .select("id, username, handle, display_name, avatar_url, bio, last_active")
        .eq("id", friendId)
        .maybeSingle();

      setP(prof || null);
      setLoading(false);
    })();
  }, [friendId]);

  useEffect(() => {
    if (!me?.id || !friendId) return;
    loadReactions();
  }, [me?.id, friendId]);

  async function loadReactions() {
    const { data } = await supabase
      .from("profile_reactions")
      .select("emoji, from_user_id")
      .eq("to_user_id", friendId)
      .eq("reaction_date", today);

    const counts = {};
    let mine = null;

    (data || []).forEach((r) => {
      counts[r.emoji] = (counts[r.emoji] || 0) + 1;
      if (r.from_user_id === me.id) mine = r.emoji;
    });

    setReactionCounts(counts);
    setMyReaction(mine);
  }

  async function sendReaction(emoji) {
    if (!me?.id || !friendId) return;

    setMyReaction(emoji);

    await supabase.from("profile_reactions").upsert(
      {
        from_user_id: me.id,
        to_user_id: friendId,
        emoji,
        reaction_date: today,
      },
      { onConflict: "from_user_id,to_user_id,reaction_date" }
    );

    loadReactions();
  }

  function isOnline(lastActive) {
    if (!lastActive) return false;
    return Date.now() - new Date(lastActive).getTime() < 60 * 1000;
  }

  function formatAgoNoMonths(ts) {
    if (!ts) return "";
    const ms = Date.now() - new Date(ts).getTime();
    const min = Math.floor(ms / 60000);
    if (min < 1) return "now";
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d`;
    return `${Math.floor(day / 7)}w`;
  }

  async function confirmUnadd() {
    if (!me?.id || !friendId) return;
    setBusy(true);

    try {
      await supabase
        .from("friend_requests")
        .delete()
        .eq("status", "accepted")
        .or(
          `and(sender_id.eq.${me.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${me.id})`
        );

      navigate("/friends");
    } finally {
      setBusy(false);
      setShowConfirm(false);
    }
  }

if (loading) return <div style={wrap} />;
  const displayName =
    p?.display_name || p?.username || p?.handle || "Profile";
  const online = isOnline(p?.last_active);
  const lastAgo = formatAgoNoMonths(p?.last_active);

  return (
    <div style={wrap}>
      <div style={topRow}>
        <button style={backBtn} onClick={() => navigate(-1)}>←</button>
        <div style={topTitle}>Profile</div>
        <div style={{ width: 44 }} />
      </div>

      {/* PROFILE CARD */}
      <div style={card}>
        <div style={row}>
          <div style={avatar} onClick={() => setShowImage(true)}>
            {p?.avatar_url ? (
              <img src={p.avatar_url} alt="" style={avatarImg} />
            ) : (
              displayName.charAt(0).toUpperCase()
            )}
          </div>

          <div style={{ flex: 1 }}>
            <div style={name}>{displayName}</div>
            {p?.handle && <div style={handle}>@{p.handle}</div>}
            <div style={status}>
              {online ? "Online" : `Offline${lastAgo ? ` · ${lastAgo}` : ""}`}
            </div>
          </div>
        </div>

        <div style={bio}>{p?.bio?.trim() || "No bio yet."}</div>
      </div>

      {/* 🔥 REACTIONS CARD */}
      <div style={reactionCard}>
        <div style={reactionTitle}>Profile Reactions</div>

        <div style={reactionRow}>
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              style={{
                ...reactionBtn,
                ...(myReaction === emoji ? reactionActive : {}),
              }}
              onClick={() => sendReaction(emoji)}
            >
              <span style={{ fontSize: 24 }}>{emoji}</span>
              <span style={reactionCount}>
                {reactionCounts[emoji] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      <button style={unaddBtn} onClick={() => setShowConfirm(true)}>
        Unadd Friend
      </button>

      {/* IMAGE PREVIEW */}
      {showImage && p?.avatar_url && (
        <div style={overlay} onClick={() => setShowImage(false)}>
          <img src={p.avatar_url} alt="" style={previewImg} />
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
  background: "var(--bg)",
  color: "var(--text)",
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
  border: "1px solid var(--border)",
  background: "var(--border)",
  color: "var(--text)",
  fontSize: 18,
  fontWeight: 900,
};

const card = {
  background: "var(--card)",
  borderRadius: 20,
  padding: 18,
  border: "1px solid var(--border)",
};

const row = { display: "flex", alignItems: "center", gap: 18 };

const avatar = {
  width: 76,
  height: 76,
  borderRadius: "50%",
  background: "var(--card-2)",
  border: "1px solid var(--border)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 30,
  fontWeight: 900,
  overflow: "hidden",
  cursor: "pointer",
};

const avatarImg = { width: "100%", height: "100%", objectFit: "cover" };

const name = { fontSize: 24, fontWeight: 900 };
const handle = { fontSize: 14, opacity: 0.65, marginTop: 2 };
const status = { fontSize: 13, marginTop: 6, opacity: 0.7 };
const bio = { marginTop: 18, fontSize: 15, opacity: 0.85 };

const reactionCard = {
  marginTop: 18,
  background: "var(--card)",
  borderRadius: 20,
  padding: 16,
  border: "1px solid var(--border)",
};

const reactionTitle = {
  fontSize: 15,
  fontWeight: 900,
  marginBottom: 12,
  opacity: 0.85,
};

const reactionRow = {
  display: "flex",
  justifyContent: "space-between",
};

const reactionBtn = {
  flex: 1,
  margin: "0 4px",
  padding: "10px 0",
  borderRadius: 14,
  background: "var(--border)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  fontWeight: 900,
};

const reactionActive = {
  background: "color-mix(in srgb, var(--accent) 20%, transparent)",
  border: "1px solid color-mix(in srgb, var(--accent) 55%, transparent)",
};

const reactionCount = {
  display: "block",
  fontSize: 12,
  marginTop: 4,
  opacity: 0.75,
};

const unaddBtn = {
  width: "100%",
  marginTop: 22,
  padding: "16px",
  borderRadius: 18,
  background: "color-mix(in srgb, var(--accent) 35%, transparent)",
  border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)",
  color: "var(--text)",
  fontWeight: 900,
};

const overlay = {
  position: "fixed",
  inset: 0,
  background: "color-mix(in srgb, var(--bg) 75%, transparent)",
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
  background: "var(--card)",
  borderRadius: 18,
  padding: 18,
  border: "1px solid var(--border)",
};

const confirmTitle = { fontSize: 18, fontWeight: 900 };
const confirmText = { fontSize: 13, opacity: 0.7, marginTop: 6 };
const confirmActions = { display: "flex", gap: 10, marginTop: 18 };

const cancelBtn = {
  flex: 1,
  padding: "14px",
  borderRadius: 14,
  background: "var(--border)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  fontWeight: 800,
};

const confirmBtn = {
  flex: 1,
  padding: "14px",
  borderRadius: 14,
  background: "var(--accent)",
  color: "var(--text)",
  fontWeight: 900,
};
