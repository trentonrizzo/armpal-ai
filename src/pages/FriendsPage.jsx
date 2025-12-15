import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

export default function FriendsPage() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [friends, setFriends] = useState([]);
  const [lastMessages, setLastMessages] = useState({});
  const [unreadMap, setUnreadMap] = useState({});

  // ------------------------------------------------------------------
  // LOAD USER + FRIENDS
  // ------------------------------------------------------------------
  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser();
      const me = data?.user;
      setUser(me);
      if (!me) return;

      const { data: rows } = await supabase
        .from("friends")
        .select("user_id, friend_id, status")
        .eq("status", "accepted")
        .or(`user_id.eq.${me.id},friend_id.eq.${me.id}`);

      const ids = rows
        .map(r => (r.user_id === me.id ? r.friend_id : r.user_id));

      if (!ids.length) return;

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, handle, avatar_url, last_active")
        .in("id", ids);

      setFriends(profiles || []);

      loadLastMessages(me.id, ids);
    }

    load();
  }, []);

  // ------------------------------------------------------------------
  // LOAD LAST MESSAGE + UNREAD STATE
  // ------------------------------------------------------------------
  async function loadLastMessages(myId, friendIds) {
    const { data: messages } = await supabase
      .from("messages")
      .select("id, sender_id, receiver_id, content, created_at")
      .or(
        friendIds
          .map(id =>
            `and(sender_id.eq.${myId},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${myId})`
          )
          .join(",")
      )
      .order("created_at", { ascending: false });

    const last = {};
    const unread = {};

    for (const msg of messages || []) {
      const other =
        msg.sender_id === myId ? msg.receiver_id : msg.sender_id;

      if (!last[other]) last[other] = msg;

      if (msg.sender_id !== myId) {
        const { data: read } = await supabase
          .from("message_reads")
          .select("id")
          .eq("message_id", msg.id)
          .eq("user_id", myId)
          .maybeSingle();

        if (!read) unread[other] = true;
      }
    }

    setLastMessages(last);
    setUnreadMap(unread);
  }

  // ------------------------------------------------------------------
  // HELPERS
  // ------------------------------------------------------------------
  function formatLastActive(ts) {
    if (!ts) return "Offline";

    const diff = Date.now() - new Date(ts).getTime();
    const m = 60_000, h = 60*m, d = 24*h, w = 7*d, y = 365*d;

    if (diff < 2*m) return "Online";
    if (diff < h) return `${Math.floor(diff/m)}m`;
    if (diff < d) return `${Math.floor(diff/h)}h`;
    if (diff < w) return `${Math.floor(diff/d)}d`;
    if (diff < y) return `${Math.floor(diff/w)}w`;
    return `${Math.floor(diff/y)}y`;
  }

  // ------------------------------------------------------------------
  // TAP-THRESHOLD HANDLER
  // ------------------------------------------------------------------
  function useTapGuard(onTap) {
    const start = useRef(null);

    return {
      onTouchStart: e => {
        start.current = e.touches[0];
      },
      onTouchEnd: e => {
        if (!start.current) return;
        const end = e.changedTouches[0];
        const dx = Math.abs(end.clientX - start.current.clientX);
        const dy = Math.abs(end.clientY - start.current.clientY);
        if (dx < 8 && dy < 8) onTap();
        start.current = null;
      }
    };
  }

  // ------------------------------------------------------------------
  // UI
  // ------------------------------------------------------------------
  return (
    <div style={page}>
      <h1 style={title}>Friends</h1>

      {friends.map(f => {
        const last = lastMessages[f.id];
        const unread = unreadMap[f.id];
        const rowTap = useTapGuard(() => navigate(`/chat/${f.id}`));
        const profileTap = useTapGuard(() =>
          navigate(`/friends/${f.id}`)
        );

        return (
          <div
            key={f.id}
            style={{
              ...row,
              ...(unread ? unreadGlow : {})
            }}
            {...rowTap}
          >
            <div style={left}>
              <div style={avatar} {...profileTap}>
                {f.avatar_url ? (
                  <img
                    src={f.avatar_url}
                    alt=""
                    style={{ width: "100%", height: "100%", borderRadius: "50%" }}
                  />
                ) : (
                  (f.display_name || f.handle || "?")[0]
                )}
                {formatLastActive(f.last_active) === "Online" && (
                  <span style={dot} />
                )}
              </div>

              <div>
                <p style={name} {...profileTap}>{f.display_name}</p>
                <p style={sub}>
                  {last ? last.content : "No messages yet"}
                </p>
              </div>
            </div>

            <span style={time}>
              {formatLastActive(f.last_active)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------
// STYLES
// ------------------------------------------------------------------
const page = { padding: "16px 16px 90px", color: "white" };
const title = { fontSize: 28, fontWeight: 700, marginBottom: 16 };

const row = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 0",
  borderBottom: "1px solid rgba(255,255,255,0.06)"
};

const unreadGlow = {
  boxShadow: "0 0 0 1px rgba(255,47,47,0.6)",
  borderRadius: 12,
  padding: "12px"
};

const left = { display: "flex", gap: 12, alignItems: "center" };

const avatar = {
  width: 42,
  height: 42,
  borderRadius: "50%",
  background: "#000",
  border: "1px solid rgba(255,255,255,0.15)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  fontWeight: 700
};

const dot = {
  position: "absolute",
  bottom: -2,
  right: -2,
  width: 10,
  height: 10,
  background: "#1fbf61",
  borderRadius: "50%",
  border: "2px solid #000"
};

const name = { fontWeight: 600, fontSize: 15 };
const sub = { fontSize: 12, opacity: 0.65, maxWidth: 220, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const time = { fontSize: 12, opacity: 0.5 };
