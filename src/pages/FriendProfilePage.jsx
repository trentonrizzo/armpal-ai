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
  const [counts, setCounts] = useState({ prs: 0, workouts: 0, measures: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const online = useMemo(
    () => isOnline(profile?.last_active),
    [profile?.last_active]
  );

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
      setMe(u?.user || null);

      if (!id) {
        setLoading(false);
        return;
      }

      const { data: p } = await supabase
        .from("profiles")
        .select(
          "id, username, handle, display_name, avatar_url, bio, last_active, profile_visibility"
        )
        .eq("id", id)
        .maybeSingle();

      if (!alive) return;

      setProfile(p || null);

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
      window.location.reload();
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

  if (profile.profile_visibility === "private" && me?.id !== profile.id) {
    return (
      <div style={wrap}>
        <Header navigate={navigate} />
        <div style={card}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Private Profile</div>
          <div style={{ opacity: 0.7 }}>
            Only friends can view this profile.
          </div>
        </div>
      </div>
    );
  }

  const label =
    profile.display_name || profile.handle || profile.username || "User";
  const handle = profile.handle || profile.username || "";

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
          </div>
        </div>

        <div style={bio}>{profile.bio || "No bio yet."}</div>
      </div>

      <div style={statsRow}>
        <Stat label="PRs" value={counts.prs} />
        <Stat label="Workouts" value={counts.workouts} />
        <Stat label="Measures" value={counts.measures} />
      </div>


      {me?.id && profile?.id && me.id !== profile.id && (
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
      <button style={backBtn} onClick={() => navigate(-1)}>←</button>
      <div style={{ fontWeight: 900, fontSize: 18 }}>Profile</div>
      <div style={{ width: 40 }} />
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={statCard}>
      <div style={statNum}>{value}</div>
      <div style={statLbl}>{label}</div>
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

const statsRow = {
  display: "flex",
  gap: 12,
  marginTop: 18,
};

const statCard = {
  flex: 1,
  background: "var(--card)",
  borderRadius: 18,
  padding: 16,
  border: "1px solid var(--border)",
  textAlign: "center",
};

const statNum = { fontSize: 22, fontWeight: 900 };
const statLbl = { fontSize: 12, opacity: 0.65, marginTop: 4 };

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
