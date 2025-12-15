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

  async function unaddFriend() {
    if (!me?.id || !friendId) return;

    const ok = window.confirm("Unadd this friend?");
    if (!ok) return;

    await supabase
      .from("friends")
      .delete()
      .or(
        `and(user_id.eq.${me.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${me.id})`
      );

    navigate("/friends");
  }

  const displayName = p?.display_name || p?.username || p?.handle || "Profile";
  const online = isOnline(p?.last_active);
  const lastAgo = formatAgoNoMonths(p?.last_active);

  if (loading) return <div style={wrap} />;

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
        <div style={row}>
          <div style={avatar}>{(displayName || "?").trim().charAt(0).toUpperCase()}</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={name}>{displayName}</div>
            {p?.handle ? <div style={handle}>@{p.handle}</div> : null}
            <div style={status}>
              {online ? (
                <span style={onlineWrap}>
                  <span style={dot} /> Online
                </span>
              ) : (
                <span style={{ opacity: 0.65 }}>
                  Offline{lastAgo ? ` · ${lastAgo}` : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={bio}>{p?.bio?.trim() ? p.bio : "No bio yet."}</div>
      </div>

      <div style={statsRow}>
        <div style={statCard}>
          <div style={statNum}>0</div>
          <div style={statLbl}>PRs</div>
        </div>
        <div style={statCard}>
          <div style={statNum}>0</div>
          <div style={statLbl}>Workouts</div>
        </div>
        <div style={statCard}>
          <div style={statNum}>0</div>
          <div style={statLbl}>Measures</div>
        </div>
      </div>

      <button style={unaddBtn} onClick={unaddFriend}>
        Unadd Friend
      </button>
    </div>
  );
}

const wrap = {
  minHeight: "100vh",
  padding: "16px 16px 90px",
  background: "black",
  color: "white",
};

const topRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 14,
};

const topTitle = {
  fontSize: 18,
  fontWeight: 800,
  opacity: 0.8,
};

const backBtn = {
  width: 44,
  height: 44,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  color: "white",
  fontSize: 18,
  fontWeight: 900,
  cursor: "pointer",
};

const card = {
  background: "#101010",
  borderRadius: 18,
  padding: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
};

const row = {
  display: "flex",
  alignItems: "center",
  gap: 14,
};

const avatar = {
  width: 64,
  height: 64,
  borderRadius: "50%",
  background: "#000",
  border: "1px solid rgba(255,255,255,0.14)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 26,
  fontWeight: 900,
  flexShrink: 0,
};

const name = {
  fontSize: 22,
  fontWeight: 900,
};

const handle = {
  fontSize: 13,
  opacity: 0.65,
  marginTop: 2,
};

const status = {
  fontSize: 12,
  marginTop: 6,
};

const onlineWrap = { display: "inline-flex", alignItems: "center", gap: 8 };
const dot = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: "#1fbf61",
  boxShadow: "0 0 10px rgba(31,191,97,0.45)",
};

const bio = {
  marginTop: 14,
  fontSize: 14,
  opacity: 0.8,
  whiteSpace: "pre-wrap",
};

const statsRow = {
  display: "flex",
  gap: 12,
  marginTop: 14,
};

const statCard = {
  flex: 1,
  background: "#101010",
  borderRadius: 16,
  padding: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  textAlign: "center",
};

const statNum = { fontSize: 22, fontWeight: 900 };
const statLbl = { fontSize: 12, opacity: 0.7, marginTop: 4 };

const unaddBtn = {
  width: "100%",
  marginTop: 16,
  padding: "14px 16px",
  borderRadius: 16,
  border: "1px solid rgba(255,47,47,0.22)",
  background: "rgba(255,47,47,0.10)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 10px 30px rgba(255,47,47,0.10)",
};
