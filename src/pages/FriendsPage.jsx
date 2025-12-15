// src/pages/FriendsPage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

export default function FriendsPage() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);

  // Data
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);

  // UI
  const [showAddBox, setShowAddBox] = useState(false);
  const [handleInput, setHandleInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // -------------------------------------------------------------------
  // LOAD USER + FRIEND DATA
  // -------------------------------------------------------------------
  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return;
      setUser(data.user);
      await loadAllFriends(data.user.id);
    }
    load();
  }, []);

  async function loadAllFriends(myId) {
    // 1️⃣ friend rows
    const { data: rows } = await supabase
      .from("friends")
      .select("id, user_id, friend_id, status")
      .or(`user_id.eq.${myId},friend_id.eq.${myId}`);

    const acceptedIds = [];
    const incomingRows = [];
    const outgoingRows = [];

    (rows || []).forEach((r) => {
      if (r.status === "accepted") {
        acceptedIds.push(r.user_id === myId ? r.friend_id : r.user_id);
      } else if (r.status === "pending") {
        if (r.friend_id === myId) incomingRows.push(r);
        else outgoingRows.push(r);
      }
    });

    // 2️⃣ profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, handle, avatar_url, bio, last_active")
      .in("id", acceptedIds);

    // 3️⃣ last message per friend
    const { data: lastMessages } = await supabase.rpc(
      "get_last_messages_for_user",
      { uid: myId }
    );

    // 4️⃣ unread detection
    const { data: reads } = await supabase
      .from("message_reads")
      .select("message_id")
      .eq("user_id", myId);

    const readSet = new Set((reads || []).map((r) => r.message_id));

    const merged = (profiles || []).map((p) => {
      const lm = lastMessages?.find(
        (m) => m.sender_id === p.id || m.receiver_id === p.id
      );

      const unread =
        lm &&
        lm.sender_id !== myId &&
        !readSet.has(lm.id);

      return {
        ...p,
        lastMessage: lm?.content || "No messages yet",
        lastMessageAt: lm?.created_at || null,
        unread,
      };
    });

    setFriends(merged);
    setIncoming(incomingRows);
    setOutgoing(outgoingRows);
  }

  // -------------------------------------------------------------------
  // FRIEND REQUESTS
  // -------------------------------------------------------------------
  async function sendFriendRequest() {
    setErrorMsg("");
    if (!handleInput.trim()) return;

    const handle = handleInput.replace("@", "").trim();

    const { data: target } = await supabase
      .from("profiles")
      .select("id")
      .eq("handle", handle)
      .single();

    if (!target) {
      setErrorMsg("User not found.");
      return;
    }

    await supabase.from("friends").insert({
      user_id: user.id,
      friend_id: target.id,
      status: "pending",
    });

    setHandleInput("");
    setShowAddBox(false);
    setSuccessMsg("Friend request sent.");
    await loadAllFriends(user.id);
  }

  async function acceptRequest(id) {
    await supabase.from("friends").update({ status: "accepted" }).eq("id", id);
    await loadAllFriends(user.id);
  }

  async function declineRequest(id) {
    await supabase.from("friends").delete().eq("id", id);
    await loadAllFriends(user.id);
  }

  // -------------------------------------------------------------------
  // HELPERS
  // -------------------------------------------------------------------
  function timeAgo(ts) {
    if (!ts) return "";
    const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
    if (diff < 60) return `${diff}m`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    if (diff < 31536000) return `${Math.floor(diff / 604800)}w`;
    return `${Math.floor(diff / 31536000)}y`;
  }

  function openChat(id) {
    navigate(`/chat/${id}`);
  }

  function openProfile(e, id) {
    e.stopPropagation();
    navigate(`/profile/${id}`);
  }

  // -------------------------------------------------------------------
  // UI
  // -------------------------------------------------------------------
  return (
    <div style={page}>
      <h1 style={title}>Friends</h1>

      {/* ADD FRIEND */}
      <div style={card}>
        <button style={addBtn} onClick={() => setShowAddBox(!showAddBox)}>
          + Add Friend
        </button>

        {showAddBox && (
          <div style={{ marginTop: 12 }}>
            <input
              style={input}
              placeholder="@handle"
              value={handleInput}
              onChange={(e) => setHandleInput(e.target.value)}
            />
            <button style={sendBtn} onClick={sendFriendRequest}>
              Send
            </button>
            {errorMsg && <p style={error}>{errorMsg}</p>}
          </div>
        )}

        {successMsg && <p style={success}>{successMsg}</p>}
      </div>

      {/* FRIEND LIST */}
      <div style={card}>
        {friends.map((f) => (
          <div
            key={f.id}
            onClick={() => openChat(f.id)}
            style={{
              ...row,
              ...(f.unread ? unreadGlow : {}),
            }}
          >
            <div
              style={avatar}
              onClick={(e) => openProfile(e, f.id)}
            >
              {f.avatar_url ? (
                <img src={f.avatar_url} alt="" style={avatarImg} />
              ) : (
                (f.display_name || f.handle || "?")[0]
              )}
            </div>

            <div style={{ flex: 1 }}>
              <div
                style={name}
                onClick={(e) => openProfile(e, f.id)}
              >
                {f.display_name || f.handle}
              </div>
              <div style={preview}>{f.lastMessage}</div>
            </div>

            <div style={time}>{timeAgo(f.lastMessageAt)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- STYLES ---------------- */

const page = { padding: 16, paddingBottom: 90 };
const title = { fontSize: 28, fontWeight: 700, marginBottom: 16 };

const card = {
  background: "#0f0f0f",
  borderRadius: 16,
  padding: 16,
  marginBottom: 16,
};

const addBtn = {
  width: "100%",
  padding: 14,
  background: "#ff2f2f",
  borderRadius: 12,
  border: "none",
  color: "#fff",
  fontWeight: 700,
};

const input = {
  width: "100%",
  padding: 10,
  marginTop: 8,
  background: "#000",
  border: "1px solid #333",
  color: "#fff",
  borderRadius: 8,
};

const sendBtn = {
  marginTop: 8,
  width: "100%",
  padding: 10,
  background: "#ff2f2f",
  color: "#fff",
  borderRadius: 8,
  border: "none",
};

const row = {
  display: "flex",
  alignItems: "center",
  padding: "12px 0",
  gap: 12,
  cursor: "pointer",
};

const unreadGlow = {
  boxShadow: "0 0 0 1px rgba(255,47,47,0.6)",
  borderRadius: 12,
  paddingLeft: 8,
};

const avatar = {
  width: 44,
  height: 44,
  borderRadius: "50%",
  background: "#000",
  border: "1px solid #333",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 700,
};

const avatarImg = {
  width: "100%",
  height: "100%",
  borderRadius: "50%",
  objectFit: "cover",
};

const name = { fontWeight: 600 };
const preview = {
  fontSize: 13,
  opacity: 0.6,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const time = { fontSize: 12, opacity: 0.5 };

const error = { color: "#ff6b6b", marginTop: 6 };
const success = { color: "#4ade80", marginTop: 6 };
