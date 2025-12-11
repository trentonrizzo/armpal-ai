// src/pages/FriendsPage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Link } from "react-router-dom";
import { FiUserPlus, FiUserCheck, FiUserX, FiMessageSquare } from "react-icons/fi";

export default function FriendsPage() {
  const [user, setUser] = useState(null);

  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [friends, setFriends] = useState([]);

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) return;

    setUser(data.user);
    loadFriendData(data.user.id);
  }

  async function loadFriendData(myId) {
    // INCOMING (friend requests sent to ME)
    const { data: inc } = await supabase
      .from("friend_requests")
      .select("id, sender_id, profiles!sender_id(username, display_name, handle, avatar_url)")
      .eq("receiver_id", myId)
      .eq("status", "pending");

    setIncoming(inc || []);

    // OUTGOING (requests I sent to others)
    const { data: out } = await supabase
      .from("friend_requests")
      .select("id, receiver_id, profiles!receiver_id(username, display_name, handle, avatar_url)")
      .eq("sender_id", myId)
      .eq("status", "pending");

    setOutgoing(out || []);

    // FRIENDS (accepted)
    const { data: fr } = await supabase
      .from("friends")
      .select(
        "id, friend_id, profiles!friend_id(username, display_name, handle, avatar_url)"
      )
      .eq("user_id", myId);

    setFriends(fr || []);
  }

  /* -------------------------
        SEARCH USERS
  -------------------------- */
  async function searchUsers() {
    if (!search.trim()) return setSearchResults([]);

    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, handle, avatar_url")
      .ilike("handle", `%${search}%`)
      .limit(20);

    setSearchResults(data || []);
  }

  /* -------------------------
        SEND FRIEND REQUEST
  -------------------------- */
  async function sendFriendRequest(receiverId) {
    if (!user) return;

    await supabase.from("friend_requests").insert({
      sender_id: user.id,
      receiver_id: receiverId,
      status: "pending",
    });

    loadFriendData(user.id);
  }

  /* -------------------------
        ACCEPT / DECLINE
  -------------------------- */
  async function acceptRequest(id, senderId) {
    await supabase
      .from("friend_requests")
      .update({ status: "accepted" })
      .eq("id", id);

    // Add friendship rows
    await supabase.from("friends").insert([
      { user_id: user.id, friend_id: senderId },
      { user_id: senderId, friend_id: user.id },
    ]);

    loadFriendData(user.id);
  }

  async function declineRequest(id) {
    await supabase.from("friend_requests").delete().eq("id", id);
    loadFriendData(user.id);
  }

  async function cancelRequest(id) {
    await supabase.from("friend_requests").delete().eq("id", id);
    loadFriendData(user.id);
  }

  /* -------------------------
          STYLES
  -------------------------- */
  const cardStyle = {
    background: "#101010",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.06)",
    padding: 12,
    marginBottom: 14,
  };

  const row = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 0",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  };

  const avatar = {
    width: 46,
    height: 46,
    borderRadius: "999px",
    objectFit: "cover",
    border: "1px solid rgba(255,255,255,0.1)",
  };

  const btn = {
    padding: "8px 12px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    border: "none",
  };

  return (
    <div style={{ padding: "16px", paddingBottom: "120px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
        Friends
      </h1>

      {/* SEARCH */}
      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>Add Friend</h3>

        <input
          type="text"
          placeholder="Search by handle..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && searchUsers()}
          style={{
            width: "100%",
            padding: "10px",
            background: "#0d0d0d",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 10,
            color: "white",
            marginBottom: 12,
          }}
        />

        {searchResults.map((u) => (
          <div key={u.id} style={{ ...row, borderBottom: "none" }}>
            <img
              src={u.avatar_url || "https://via.placeholder.com/46"}
              style={avatar}
            />

            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                {u.display_name || u.username}
              </p>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>
                @{u.handle || u.username}
              </p>
            </div>

            <button
              onClick={() => sendFriendRequest(u.id)}
              style={{
                ...btn,
                background: "#ff2f2f",
                color: "white",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <FiUserPlus /> Add
            </button>
          </div>
        ))}
      </div>

      {/* INCOMING REQUESTS */}
      {incoming.length > 0 && (
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Incoming Requests</h3>

          {incoming.map((req) => (
            <div key={req.id} style={row}>
              <img
                src={
                  req.profiles?.avatar_url ||
                  "https://via.placeholder.com/46"
                }
                style={avatar}
              />

              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                  {req.profiles?.display_name || req.profiles?.username}
                </p>
                <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>
                  @{req.profiles?.handle || req.profiles?.username}
                </p>
              </div>

              <button
                onClick={() => acceptRequest(req.id, req.sender_id)}
                style={{
                  ...btn,
                  background: "#16c784",
                  color: "white",
                }}
              >
                Accept
              </button>

              <button
                onClick={() => declineRequest(req.id)}
                style={{
                  ...btn,
                  background: "#333",
                  color: "white",
                }}
              >
                Decline
              </button>
            </div>
          ))}
        </div>
      )}

      {/* OUTGOING REQUESTS */}
      {outgoing.length > 0 && (
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0, marginBottom: 8 }}>Sent Requests</h3>

          {outgoing.map((req) => (
            <div key={req.id} style={row}>
              <img
                src={
                  req.profiles?.avatar_url ||
                  "https://via.placeholder.com/46"
                }
                style={avatar}
              />

              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                  {req.profiles?.display_name || req.profiles?.username}
                </p>
                <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>
                  @{req.profiles?.handle || req.profiles?.username}
                </p>
              </div>

              <button
                onClick={() => cancelRequest(req.id)}
                style={{
                  ...btn,
                  background: "#333",
                  color: "white",
                }}
              >
                Cancel
              </button>
            </div>
          ))}
        </div>
      )}

      {/* FRIENDS LIST */}
      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>Friends</h3>

        {friends.length === 0 ? (
          <p style={{ fontSize: 13, opacity: 0.7 }}>
            No friends yet — add some!
          </p>
        ) : (
          friends.map((fr) => (
            <div key={fr.id} style={row}>
              <img
                src={
                  fr.profiles?.avatar_url ||
                  "https://via.placeholder.com/46"
                }
                style={avatar}
              />

              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                  {fr.profiles?.display_name || fr.profiles?.username}
                </p>
                <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>
                  @{fr.profiles?.handle || fr.profiles?.username}
                </p>
              </div>

              {/* MESSAGE BUTTON */}
              <Link
                to={`/chat/${fr.friend_id}`}
                style={{
                  ...btn,
                  background: "#ff2f2f",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  textDecoration: "none",
                }}
              >
                <FiMessageSquare size={16} /> Message
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
