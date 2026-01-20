import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";

function timeAgoNoMonths(dateStr) {
  if (!dateStr) return "";
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  if (diff < 0) return "now";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return `${Math.floor(day / 7)}w`;
}

function isOnline(lastActive) {
  if (!lastActive) return false;
  return Date.now() - new Date(lastActive).getTime() < 60000;
}

export default function FriendProfilePage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [me, setMe] = useState(null);
  const [profile, setProfile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Access control
  const [isFriend, setIsFriend] = useState(false);
  const [visibility, setVisibility] = useState("public"); // public | friends_only | private

  const online = useMemo(() => isOnline(profile?.last_active), [profile?.last_active]);

  const lastText = online
    ? "Online"
    : profile?.last_active
    ? `Last active ${timeAgoNoMonths(profile.last_active)}`
    : "Offline";

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);

      const { data: u } = await supabase.auth.getUser();
      if (!alive) return;
      const meUser = u?.user || null;
      setMe(meUser);

      if (!id) {
        setLoading(false);
        return;
      }

      // Load profile (best-effort; will not crash if schema changes)
      const { data: p } = await supabase
        .from("profiles")
        .select("id, username, handle, display_name, avatar_url, bio, last_active, profile_visibility, visibility, is_private")
        .eq("id", id)
        .maybeSingle();

      if (!alive) return;

      setProfile(p || null);

      // Determine visibility (best-effort)
      const v = normalizeVisibility(p);
      setVisibility(v);

      // Determine friendship (accepted) — supports 1-row or 2-row schemas
      const owner = meUser?.id && meUser.id === id;
      if (owner) {
        setIsFriend(true);
      } else if (meUser?.id && id) {
        let friendOk = false;
        try {
          const { data: frRows, error: frErr } = await supabase
            .from("friends")
            .select("id, status, user_id, friend_id")
            .or(
              `and(user_id.eq.${meUser.id},friend_id.eq.${id}),and(user_id.eq.${id},friend_id.eq.${meUser.id})`
            );

          if (!frErr && Array.isArray(frRows)) {
            friendOk = frRows.some(
              (r) => String(r?.status || "").toLowerCase() === "accepted"
            );
          }
        } catch {
          friendOk = false;
        }
        if (!alive) return;
        setIsFriend(friendOk);
      } else {
        setIsFriend(false);
      }

      setLoading(false);
    }

    load();
    return () => {
      alive = false;
    };
  }, [id]);

  function normalizeVisibility(p) {
    if (!p) return "public";

    // Prefer string fields if present
    const raw =
      String(p.profile_visibility || p.visibility || "")
        .toLowerCase()
        .trim();

    if (raw === "private") return "private";
    if (raw === "friends" || raw === "friends_only" || raw === "friends-only")
      return "friends_only";
    if (raw === "public") return "public";

    // Boolean fallback
    if (typeof p.is_private === "boolean") return p.is_private ? "private" : "public";

    // Default
    return "public";
  }

  async function addFriend() {
    if (!me?.id || !profile?.id) return;
    setBusy(true);

    try {
      // Best-effort insert (won't crash UI if table/constraint differs)
      await supabase.from("friend_requests").insert({
        sender_id: me.id,
        receiver_id: profile.id,
        status: "pending",
      });
    } catch {
      // ignore (you can surface a toast later if you want)
    } finally {
      setBusy(false);
    }
  }

  async function unaddFriend() {
    if (!me?.id || !profile?.id) return;
    if (!window.confirm("Remove this friend?")) return;

    setBusy(true);
    try {
      await supabase
        .from("friends")
        .delete()
        .or(
          `and(user_id.eq.${me.id},friend_id.eq.${profile.id}),and(user_id.eq.${profile.id},friend_id.eq.${me.id})`
        );

      await supabase
        .from("friend_requests")
        .delete()
        .eq("status", "accepted")
        .or(
          `and(sender_id.eq.${me.id},receiver_id.eq.${profile.id}),and(sender_id.eq.${profile.id},receiver_id.eq.${me.id})`
        );

      navigate("/friends", { replace: true });
      // (No reload; let routing handle it)
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div style={wrap}>
        <Header navigate={navigate} />
        <div style={card}>Loading…</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={wrap}>
        <Header navigate={navigate} />
        <div style={card}>User not found.</div>
      </div>
    );
  }

  const label = profile.display_name || profile.handle || profile.username || "User";
  const handle = profile.handle || profile.username || "";
  const owner = me?.id && me.id === profile.id;

  // RULES:
  // - Public: anyone sees full
  // - Private/Friends-only: friends (or owner) see full; non-friends see limited
  const canSeeFull =
    owner || visibility === "public" || (isFriend && (visibility === "friends_only" || visibility === "private"));

  return (
    <div style={wrap}>
      <Header navigate={navigate} />

      <div style={card}>
        <div style={topRow}>
          <div style={avatar}>
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={label}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              label.charAt(0).toUpperCase()
            )}
            {online && <span style={dot} />}
          </div>

          <div style={{ flex: 1 }}>
            <div style={name}>{label}</div>
            <div style={handleStyle}>@{handle}</div>
            <div style={last}>{lastText}</div>

            {!owner && (
              <div style={{ marginTop: 10 }}>
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

        {/* Bio (GATED) */}
        <div style={bio}>
          {canSeeFull ? profile.bio || "No bio yet." : "This profile is private."}
        </div>
      </div>

      {/* 🔒 Private notice (GATED) */}
      {!canSeeFull && !owner && (
        <div style={cardSmall}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>🔒 Private Profile</div>
          <div style={{ opacity: 0.7, lineHeight: "18px" }}>
            Only friends can view their full profile.
          </div>
        </div>
      )}

      {/* ADD / UN-ADD (as requested) */}
      {me?.id && profile?.id && me.id !== profile.id && !isFriend && (
        <button style={dangerBtn} disabled={busy} onClick={addFriend}>
          Add Friend
        </button>
      )}

      {me?.id && profile?.id && me.id !== profile.id && isFriend && (
        <button style={dangerBtn} disabled={busy} onClick={unaddFriend}>
          Un-add Friend
        </button>
      )}

      <button style={dangerBtn} disabled={busy} onClick={() => navigate("/friends")}>
        Back to Friends
      </button>

      <div style={{ height: 90 }} />
    </div>
  );
}

function Header({ navigate }) {
  return (
    <div style={headerRow}>
      <button style={backBtn} onClick={() => navigate(-1)}>
        ←
      </button>
      <div style={{ fontWeight: 900, fontSize: 18 }}>Profile</div>
      <div style={{ width: 40 }} />
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

const headerRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 18,
};

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

const cardSmall = {
  marginTop: 14,
  background: "var(--card)",
  borderRadius: 20,
  padding: 16,
  border: "1px solid var(--border)",
};

const topRow = { display: "flex", alignItems: "center", gap: 18 };

const avatar = {
  width: 68,
  height: 68,
  borderRadius: "50%",
  background: "var(--card-2)",
  border: "1px solid var(--border)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 24,
  fontWeight: 900,
  position: "relative",
  overflow: "hidden",
};

const dot = {
  position: "absolute",
  bottom: 6,
  right: 6,
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: "var(--accent)",
};

const name = { fontSize: 22, fontWeight: 900 };
const handleStyle = { fontSize: 14, opacity: 0.65 };
const last = { fontSize: 13, marginTop: 4, opacity: 0.7 };
const bio = { marginTop: 18, fontSize: 15, opacity: 0.85 };

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

const dangerBtn = {
  width: "100%",
  marginTop: 22,
  padding: "16px",
  borderRadius: 18,
  background: "color-mix(in srgb, var(--accent) 35%, transparent)",
  border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)",
  color: "var(--text)",
  fontWeight: 900,
};
