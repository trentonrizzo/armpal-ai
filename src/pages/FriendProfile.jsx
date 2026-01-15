// src/pages/FriendProfile.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate, useParams } from "react-router-dom";

const REACTIONS = ["💪", "👊", "❤️", "🔥"];

/**
 * FriendProfile (Fixed)
 * - Enforces relationship + visibility BEFORE loading gated data (reactions + any future private sections)
 * - Unadd is idempotent and safe for either 1-row or 2-row "friends" schemas
 * - Prevents post-unadd crashes by re-checking access and redirecting/locking cleanly
 */
export default function FriendProfile() {
  const { friendId } = useParams();
  const navigate = useNavigate();

  const [me, setMe] = useState(null);

  // Profile basic
  const [p, setP] = useState(null);
  const [loading, setLoading] = useState(true);

  // Access control
  const [relLoading, setRelLoading] = useState(true);
  const [isFriend, setIsFriend] = useState(false);
  const [visibility, setVisibility] = useState("public"); // public | friends_only | private (best-effort)
  const [accessLost, setAccessLost] = useState(false);

  // UI
  const [showConfirm, setShowConfirm] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [busy, setBusy] = useState(false);

  // Reactions (gated)
  const [reactionCounts, setReactionCounts] = useState({});
  const [myReaction, setMyReaction] = useState(null);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ------------------------------------------------------------
  // Load: me + basic profile
  // ------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setRelLoading(true);
      setAccessLost(false);
      setReactionCounts({});
      setMyReaction(null);

      // 1) Current user
      const { data: auth } = await supabase.auth.getUser();
      const current = auth?.user || null;
      if (!cancelled) setMe(current);

      // 2) Basic profile fetch (never crashes if extra columns missing)
      const { data: prof } = await supabase
        .from("profiles")
        .select(
          "id, username, handle, display_name, avatar_url, bio, last_active, last_seen, is_online"
        )
        .eq("id", friendId)
        .maybeSingle();

      if (!cancelled) {
        setP(prof || null);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [friendId]);

  // ------------------------------------------------------------
  // Relationship + visibility enforcement
  // ------------------------------------------------------------
  useEffect(() => {
    if (!me?.id || !friendId) return;

    let cancelled = false;

    (async () => {
      setRelLoading(true);
      setAccessLost(false);

      const meId = me.id;
      const otherId = friendId;

      // Owner shortcut
      const owner = meId === otherId;

      // 1) Determine friendship (accepted) — supports both 1-row and 2-row schemas
      let friendOk = false;
      if (owner) {
        friendOk = true;
      } else {
        try {
          const { data: frRows, error: frErr } = await supabase
            .from("friends")
            .select("id, status, user_id, friend_id")
            .or(
              `and(user_id.eq.${meId},friend_id.eq.${otherId}),and(user_id.eq.${otherId},friend_id.eq.${meId})`
            );

          if (!frErr && Array.isArray(frRows)) {
            friendOk = frRows.some(
              (r) => String(r?.status || "").toLowerCase() === "accepted"
            );
          } else {
            // If schema differs, fail-safe: not friends
            friendOk = false;
          }
        } catch {
          friendOk = false;
        }
      }

      // 2) Determine visibility (best-effort, never crashes if columns missing)
      const vis = await fetchProfileVisibility(otherId);

      if (cancelled) return;

      setIsFriend(friendOk);
      setVisibility(vis);
      setRelLoading(false);

      // 3) Compute access
      const canView = owner || friendOk || vis === "public";

      // If you got here from friends list but you are no longer friends, lock + bounce safely
      if (!owner && !canView) {
        setAccessLost(true);

        // If it’s private/friends-only and you don't have access, push back to friends (safe)
        // This prevents any future sections from ever rendering incorrectly.
        // (We still render a locked view momentarily in case navigation fails on some devices.)
        try {
          navigate("/friends", { replace: true });
        } catch {
          // ignore
        }

        return;
      }

      // If access is OK, load reactions (only when permitted)
      if (canView) {
        await loadReactions(meId, otherId);
      } else {
        setReactionCounts({});
        setMyReaction(null);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, friendId]);

  // ------------------------------------------------------------
  // Visibility fetcher (best-effort)
  // Tries a few common schema variants without crashing.
  // Returns: "public" | "friends_only" | "private"
  // ------------------------------------------------------------
  async function fetchProfileVisibility(profileId) {
    // default safest behavior for a social app:
    // if we cannot detect visibility, treat as public (so you don't accidentally lock everyone out)
    // BUT: gating of private sections will still be handled by future additions.
    let v = "public";

    // Try 1: profile_visibility (string)
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, profile_visibility")
        .eq("id", profileId)
        .maybeSingle();

      if (!error && data) {
        const raw = String(data.profile_visibility || "").toLowerCase().trim();
        if (raw === "private") return "private";
        if (raw === "friends" || raw === "friends_only" || raw === "friends-only")
          return "friends_only";
        if (raw === "public") return "public";
      }
    } catch {
      // ignore
    }

    // Try 2: visibility (string)
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, visibility")
        .eq("id", profileId)
        .maybeSingle();

      if (!error && data) {
        const raw = String(data.visibility || "").toLowerCase().trim();
        if (raw === "private") return "private";
        if (raw === "friends" || raw === "friends_only" || raw === "friends-only")
          return "friends_only";
        if (raw === "public") return "public";
      }
    } catch {
      // ignore
    }

    // Try 3: is_private (boolean)
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, is_private")
        .eq("id", profileId)
        .maybeSingle();

      if (!error && data && typeof data.is_private === "boolean") {
        return data.is_private ? "private" : "public";
      }
    } catch {
      // ignore
    }

    return v;
  }

  // ------------------------------------------------------------
  // Reactions (GATED)
  // ------------------------------------------------------------
  async function loadReactions(meId, toId) {
    if (!meId || !toId) return;

    try {
      const { data } = await supabase
        .from("profile_reactions")
        .select("emoji, from_user_id")
        .eq("to_user_id", toId)
        .eq("reaction_date", today);

      const counts = {};
      let mine = null;

      (data || []).forEach((r) => {
        counts[r.emoji] = (counts[r.emoji] || 0) + 1;
        if (r.from_user_id === meId) mine = r.emoji;
      });

      if (!mountedRef.current) return;
      setReactionCounts(counts);
      setMyReaction(mine);
    } catch {
      if (!mountedRef.current) return;
      setReactionCounts({});
      setMyReaction(null);
    }
  }

  async function sendReaction(emoji) {
    if (!me?.id || !friendId) return;

    // Don’t allow reactions if access is lost
    const owner = me.id === friendId;
    const canView = owner || isFriend || visibility === "public";

    if (!canView || accessLost) return;

    setMyReaction(emoji);

    try {
      await supabase.from("profile_reactions").upsert(
        {
          from_user_id: me.id,
          to_user_id: friendId,
          emoji,
          reaction_date: today,
        },
        { onConflict: "from_user_id,to_user_id,reaction_date" }
      );
    } catch {
      // ignore; we still refresh counts below
    }

    await loadReactions(me.id, friendId);
  }

  // ------------------------------------------------------------
  // Online helpers (supports multiple schemas)
  // ------------------------------------------------------------
  function isOnline(profile) {
    if (!profile) return false;

    // schema A: is_online boolean
    if (profile.is_online === true) return true;

    // schema B: last_seen / last_active freshness
    const ts = profile.last_seen || profile.last_active;
    if (!ts) return false;

    return Date.now() - new Date(ts).getTime() < 90 * 1000;
  }

  function formatAgoNoMonths(ts) {
    if (!ts) return "";
    const ms = Date.now() - new Date(ts).getTime();
    if (ms < 0) return "";
    const min = Math.floor(ms / 60000);
    if (min < 1) return "now";
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d`;
    return `${Math.floor(day / 7)}w`;
  }

  // ------------------------------------------------------------
  // Unadd (SAFE + INSTANT)
  // - deletes any rows connecting the two users (works for 1-row or 2-row schemas)
  // - updates UI immediately by redirecting
  // - prevents crashes by setting accessLost
  // ------------------------------------------------------------
  async function confirmUnadd() {
    if (!me?.id || !friendId) return;
    setBusy(true);

    const meId = me.id;
    const otherId = friendId;

    // Optimistically lock the page so nothing else tries to load
    setAccessLost(true);

    try {
      await supabase
        .from("friends")
        .delete()
        .or(
          `and(user_id.eq.${meId},friend_id.eq.${otherId}),and(user_id.eq.${otherId},friend_id.eq.${meId})`
        );
    } catch {
      // ignore — idempotent behavior; even if it fails, we still redirect to avoid crashes
    } finally {
      setBusy(false);
      setShowConfirm(false);

      // Always leave this page after unadd (prevents any state mismatch crash)
      navigate("/friends", { replace: true });
    }
  }

  // ------------------------------------------------------------
  // Render gates
  // ------------------------------------------------------------
  if (loading) return <div style={wrap} />;

  const displayName = p?.display_name || p?.username || p?.handle || "Profile";
  const online = isOnline(p);
  const lastTs = p?.last_seen || p?.last_active;
  const lastAgo = formatAgoNoMonths(lastTs);

  const isOwner = me?.id && friendId && me.id === friendId;
  const canViewProfile = isOwner || isFriend || visibility === "public";

  const showUnadd = !isOwner && isFriend && canViewProfile && !accessLost;

  // If profile not found
  if (!p && !loading) {
    return (
      <div style={wrap}>
        <div style={topRow}>
          <button style={backBtn} onClick={() => navigate(-1)}>
            ←
          </button>
          <div style={topTitle}>Profile</div>
          <div style={{ width: 44 }} />
        </div>

        <div style={card}>
          <div style={name}>Profile not found</div>
          <div style={bio}>This user may not exist or is unavailable.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={topRow}>
        <button style={backBtn} onClick={() => navigate(-1)}>
          ←
        </button>
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

            {/* Visibility badge (small, doesn’t change your style system) */}
            {!isOwner && (
              <div style={visPillWrap}>
                <span style={visPill}>
                  {visibility === "public"
                    ? "Public"
                    : visibility === "friends_only"
                    ? "Friends Only"
                    : "Private"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bio is shown only if profile is viewable */}
        <div style={bio}>
          {canViewProfile ? p?.bio?.trim() || "No bio yet." : "This profile is private."}
        </div>
      </div>

      {/* 🔒 LOCKED NOTICE (if access is lost / not allowed) */}
      {!canViewProfile && !isOwner && (
        <div style={lockedCard}>
          <div style={lockedTitle}>🔒 Profile locked</div>
          <div style={lockedText}>
            You can’t view this profile due to their privacy settings.
          </div>
        </div>
      )}

      {/* 🔥 REACTIONS CARD (GATED) */}
      {canViewProfile && !accessLost && (
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
                disabled={relLoading}
              >
                <span style={{ fontSize: 24 }}>{emoji}</span>
                <span style={reactionCount}>{reactionCounts[emoji] || 0}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* UNADD (ONLY if still friends) */}
      {showUnadd && (
        <button style={unaddBtn} onClick={() => setShowConfirm(true)}>
          Unadd Friend
        </button>
      )}

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

const visPillWrap = { marginTop: 10 };
const visPill = {
  display: "inline-block",
  fontSize: 12,
  fontWeight: 900,
  opacity: 0.8,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid var(--border)",
  background: "color-mix(in srgb, var(--text) 6%, transparent)",
};

const lockedCard = {
  marginTop: 18,
  background: "var(--card)",
  borderRadius: 20,
  padding: 16,
  border: "1px solid var(--border)",
  opacity: 0.95,
};

const lockedTitle = { fontSize: 15, fontWeight: 900 };
const lockedText = { fontSize: 13, opacity: 0.75, marginTop: 6, lineHeight: "18px" };

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
