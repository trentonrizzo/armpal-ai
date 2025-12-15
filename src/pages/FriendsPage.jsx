// src/pages/FriendsPage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

export default function FriendsPage() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [friends, setFriends] = useState([]);
  const [unreadMap, setUnreadMap] = useState({});
  const [lastMessageMap, setLastMessageMap] = useState({});

  const [showAdd, setShowAdd] = useState(false);
  const [handleInput, setHandleInput] = useState("");
  const [error, setError] = useState("");

  // --------------------------------------------------
  // INIT
  // --------------------------------------------------
  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return;
      setUser(data.user);
      await loadFriends(data.user.id);
    }
    init();
  }, []);

  // --------------------------------------------------
  // LOAD FRIENDS
  // --------------------------------------------------
  async function loadFriends(myId) {
    const { data: rows } = await supabase
      .from("friends")
      .select("user_id, friend_id, status")
      .or(`user_id.eq.${myId},friend_id.eq.${myId}`)
      .eq("status", "accepted");

    if (!rows) return;

    const ids = rows.map((r) =>
      r.user_id === myId ? r.friend_id : r.user_id
    );

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, last_active")
      .in("id", ids);

    setFriends(profiles || []);
    await loadLastMessages(myId, ids);
  }

  // --------------------------------------------------
  // LOAD LAST MESSAGE + UNREAD
  // --------------------------------------------------
  async function loadLastMessages(myId, ids) {
    const { data: messages } = await supabase
      .from("messages")
      .select("id, sender_id, receiver_id, content, created_at, read")
      .or(
        ids
          .map(
            (id) =>
              `and(sender_id.eq.${myId},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${myId})`
          )
          .join(",")
      )
      .order("created_at", { ascending: false });

    const lastMap = {};
    const unread = {};

    messages?.forEach((m) => {
      const other =
        m.sender_id === myId ? m.receiver_id : m.sender_id;

      if (!lastMap[other]) {
        lastMap[other] = m;
      }

      if (m.receiver_id === myId && !m.read) {
        unread[other] = true;
      }
    });

    setLastMessageMap(lastMap);
    setUnreadMap(unread);
  }

  // --------------------------------------------------
  // ADD FRIEND
  // --------------------------------------------------
  async function sendFriendRequest() {
    setError("");
    let raw = handleInput.trim().replace("@", "");
    if (!raw || !user) return;

    const { data: target } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", raw)
      .maybeSingle();

    if (!target) {
      setError("User not found");
      return;
    }

    await supabase.from("friends").insert({
      user_id: user.id,
      friend_id: target.id,
      status: "pending",
    });

    setHandleInput("");
    setShowAdd(false);
  }

  // --------------------------------------------------
  // HELPERS
  // --------------------------------------------------
  function formatLastActive(ts) {
    if (!ts) return "Offline";

    const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
    if (diff < 60) return "Offline · just now";
    if (diff < 3600) return `Offline · ${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `Offline · ${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `Offline · ${Math.floor(diff / 86400)}d`;
    if (diff < 31536000) return `Offline · ${Math.floor(diff / 604800)}w`;
    return `Offline · ${Math.floor(diff / 31536000)}y`;
  }

  function isOnline(ts) {
    if (!ts) return false;
    return Date.now() - new Date(ts) < 60000;
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <div style={page}>
      <h1 style={title}>Friends</h1>

      {/* ADD FRIEND */}
      <div style={card}>
        <button style={addBtn} onClick={() => setShowAdd(!showAdd)}>
          + Add Friend
        </button>

        {showAdd && (
          <div style={{ marginTop: 12 }}>
            <input
              placeholder="@username"
              value={handleInput}
              onChange={(e) => setHandleInput(e.target.value)}
              style={input}
            />
            <button style={sendBtn} onClick={sendFriendRequest}>
              Send
            </button>
            {error && <p style={errorText}>{error}</p>}
          </div>
        )}
      </div>

      {/* FRIEND LIST */}
      <div style={card}>
        <h2 style={section}>Your Friends</h2>

        {friends.map((f) => {
          const name = f.display_name || f.username;
          const last = lastMessageMap[f.id];
          const unread = unreadMap[f.id];
          const online = isOnline(f.last_active);

          return (
            <div
              key={f.id}
              style={{
                ...row,
                ...(unread ? unreadGlow : {}),
              }}
              onClick={() => navigate(`/chat/${f.id}`)}
            >
              <div
                style={left}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/profile/${f.id}`);
                }}
              >
                <div style={avatar}>
                  {name?.charAt(0)?.toUpperCase()}
                  {online && <span style={onlineDot} />}
                </div>

                <div>
                  <div style={nameText}>{name}</div>
                  <div style={preview}>
                    {last ? last.content : "No messages yet"}
                  </div>
                </div>
              </div>

              <div style={right}>
                {online ? (
                  <span style={onlineText}>Online</span>
                ) : (
                  <span style={offlineText}>
                    {formatLastActive(f.last_active)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------
// STYLES
// --------------------------------------------------
const page = {
  padding: "16px 16px 90px",
  color: "white",
};

const title = {
  fontSize: 28,
  fontWeight: 700,
  marginBottom: 16,
};

const card = {
  background: "#0f0f0f",
  borderRadius: 18,
  padding: 16,
  marginBottom: 20,
};

const addBtn = {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "none",
  background: "#ff2f2f",
  color: "white",
  fontWeight: 700,
};

const input = {
  width: "100%",
  marginTop: 10,
  padding: 12,
  borderRadius: 10,
  background: "#000",
  border: "1px solid rgba(255,255,255,0.2)",
  color: "white",
};

const sendBtn = {
  width: "100%",
  marginTop: 10,
  padding: 12,
  borderRadius: 10,
  background: "#ff2f2f",
  color: "white",
  fontWeight: 700,
};

const errorText = {
  color: "#ff6b6b",
  marginTop: 6,
  fontSize: 13,
};

const section = {
  fontSize: 16,
  fontWeight: 600,
  marginBottom: 10,
};

const row = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "14px 0",
  borderBottom: "1px solid rgba(255,255,255,0.05)",
  cursor: "pointer",
};

const unreadGlow = {
  boxShadow: "0 0 0 1px rgba(255,47,47,0.8)",
  borderRadius: 12,
};

const left = {
  display: "flex",
  gap: 12,
  alignItems: "center",
};

const avatar = {
  width: 44,
  height: 44,
  borderRadius: "50%",
  background: "#000",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 700,
  position: "relative",
};

const onlineDot = {
  position: "absolute",
  right: -2,
  bottom: -2,
  width: 10,
  height: 10,
  background: "#22c55e",
  borderRadius: "50%",
  boxShadow: "0 0 6px #22c55e",
};

const nameText = {
  fontSize: 15,
  fontWeight: 600,
};

const preview = {
  fontSize: 13,
  opacity: 0.65,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: 220,
};

const right = {
  fontSize: 12,
  opacity: 0.7,
};

const onlineText = {
  color: "#22c55e",
  fontWeight: 600,
};

const offlineText = {
  opacity: 0.6,
};
