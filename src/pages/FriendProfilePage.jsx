// src/pages/FriendProfilePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";

function timeAgoNoMonths(dateStr) {
  if (!dateStr) return "";
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  if (diff < 0) return "now";

  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  const week = Math.floor(day / 7);
  const year = Math.floor(day / 365);

  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  if (hr < 24) return `${hr}h`;
  if (day < 7) return `${day}d`;
  if (week <= 53) return `${week}w`;
  return `${Math.max(1, year)}y`;
}

function isOnline(lastActive) {
  if (!lastActive) return false;
  return Date.now() - new Date(lastActive).getTime() < 60_000;
}

export default function FriendProfilePage() {
  const navigate = useNavigate();
  const { id } = useParams(); // friend id

  const [me, setMe] = useState(null);
  const [profile, setProfile] = useState(null);
  const [counts, setCounts] = useState({ prs: 0, workouts: 0, measures: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

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
      const current = u?.user || null;
      if (!alive) return;
      setMe(current);

      if (!id) {
        setLoading(false);
        return;
      }

      const { data: p, error } = await supabase
        .from("profiles")
        .select("id, username, handle, display_name, avatar_url, bio, last_active")
        .eq("id", id)
        .maybeSingle();

      if (!alive) return;

      if (error) console.error("profile load error:", error);
      setProfile(p || null);

      // counts (safe + simple)
      const [prsRes, wRes, mRes] = await Promise.all([
        supabase.from("prs").select("id", { count: "exact", head: true }).eq("user_id", id),
        supabase.from("workouts").select("id", { count: "exact", head: true }).eq("user_id", id),
        supabase.from("measurements").select("id", { count: "exact", head: true }).eq("user_id", id),
      ]);

      if (!alive) return;

      setCounts({
        prs: prsRes.count || 0,
        workouts: wRes.count || 0,
        measures: mRes.count || 0,
      });

      setLoading(false);
    }

    load();
    return () => {
      alive = false;
    };
  }, [id]);

  async function unfriend() {
    if (!me?.id || !id) return;

    // serious confirmation (two-step)
    const ok1 = window.confirm("Unadd this friend?");
    if (!ok1) return;
    const ok2 = window.confirm("This cannot be undone. Confirm unadd.");
    if (!ok2) return;

    setBusy(true);
    try {
      // delete both directions
      const { error } = await supabase
        .from("friends")
        .delete()
        .or(
          `and(user_id.eq.${me.id},friend_id.eq.${id}),and(user_id.eq.${id},friend_id.eq.${me.id})`
        );

      if (error) {
        console.error("unfriend error:", error);
        alert("Could not unadd. Try again.");
        return;
      }

      navigate("/friends");
    } finally {
      setBusy(false);
    }
  }

  const label =
    profile?.display_name || profile?.handle || profile?.username || "User";
  const handle = profile?.handle || profile?.username || "";

  if (loading) {
    return (
      <div style={wrap}>
        <div style={headerRow}>
          <button style={backBtn} onClick={() => navigate(-1)}>←</button>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Profile</div>
          <div style={{ width: 40 }} />
        </div>
        <div style={card}>Loading…</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={wrap}>
        <div style={headerRow}>
          <button style={backBtn} onClick={() => navigate(-1)}>←</button>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Profile</div>
          <div style={{ width: 40 }} />
        </div>
        <div style={card}>User not found.</div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={headerRow}>
        <button style={backBtn} onClick={() => navigate(-1)}>←</button>
        <div style={{ fontWeight: 900, fontSize: 18 }}>Profile</div>
        <div style={{ width: 40 }} />
      </div>

      <div style={card}>
        <div style={topRow}>
          <div style={avatar}>
            {label.charAt(0).toUpperCase()}
            {online && <span style={dot} />}
          </div>

          <div style={{ flex: 1 }}>
            <div style={name}>{label}</div>
            <div style={handleStyle}>@{handle}</div>
            <div style={last}>{lastText}</div>
          </div>
        </div>

        {profile.bio ? (
          <div style={bio}>{profile.bio}</div>
        ) : (
          <div style={{ ...bio, opacity: 0.5 }}>No bio yet.</div>
        )}
      </div>

      <div style={statsRow}>
        <div style={statCard}>
          <div style={statNum}>{counts.prs}</div>
          <div style={statLbl}>PRs</div>
        </div>
        <div style={statCard}>
          <div style={statNum}>{counts.workouts}</div>
          <div style={statLbl}>Workouts</div>
        </div>
        <div style={statCard}>
          <div style={statNum}>{counts.measures}</div>
          <div style={statLbl}>Measures</div>
        </div>
      </div>

      <button style={dangerBtn} disabled={busy} onClick={unfriend}>
        {busy ? "Unadding…" : "Unadd Friend"}
      </button>

      <div style={{ height: 90 }} />
    </div>
  );
}

const wrap = {
  padding: "14px 14px 90px",
  maxWidth: 900,
  margin: "0 auto",
  color: "white",
};

const headerRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 12,
};

const backBtn = {
  width: 40,
  height: 40,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.35)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const card = {
  background: "#101010",
  borderRadius: 18,
  padding: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
};

const topRow = {
  display: "flex",
  alignItems: "center",
  gap: 14,
};

const avatar = {
  width: 68,
  height: 68,
  borderRadius: "50%",
  background: "#000",
  border: "1px solid rgba(255,255,255,0.14)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 24,
  fontWeight: 900,
  position: "relative",
};

const dot = {
  position: "absolute",
  right: 2,
  bottom: 2,
  width: 12,
  height: 12,
  borderRadius: "50%",
  background: "#1fbf61",
  border: "2px solid #000",
};

const name = {
  fontSize: 20,
  fontWeight: 900,
  letterSpacing: -0.3,
};

const handleStyle = {
  fontSize: 13,
  opacity: 0.6,
  fontWeight: 700,
  marginTop: 2,
};

const last = {
  fontSize: 12,
  opacity: 0.55,
  marginTop: 6,
  fontWeight: 700,
};

const bio = {
  marginTop: 14,
  lineHeight: 1.35,
  fontSize: 14,
  opacity: 0.92,
  whiteSpace: "pre-wrap",
};

const statsRow = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 10,
  marginTop: 14,
};

const statCard = {
  background: "#101010",
  borderRadius: 16,
  padding: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  textAlign: "center",
  boxShadow: "0 16px 34px rgba(0,0,0,0.35)",
};

const statNum = {
  fontSize: 20,
  fontWeight: 900,
};

const statLbl = {
  fontSize: 12,
  opacity: 0.6,
  fontWeight: 700,
  marginTop: 4,
};

const dangerBtn = {
  width: "100%",
  marginTop: 14,
  padding: "14px 16px",
  borderRadius: 16,
  border: "1px solid rgba(255,47,47,0.35)",
  background: "rgba(255,47,47,0.12)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 14px 40px rgba(255,47,47,0.12)",
};
