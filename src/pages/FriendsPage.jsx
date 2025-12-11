// src/pages/FriendsPage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Link } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";

export default function FriendsPage() {
  const [user, setUser] = useState(null);

  const [searchHandle, setSearchHandle] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState("");

  const [pendingIncoming, setPendingIncoming] = useState([]);
  const [pendingOutgoing, setPendingOutgoing] = useState([]);
  const [friends, setFriends] = useState([]);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    const { data } = await supabase.auth.getUser();
    const authUser = data?.user;
    if (!authUser) return;

    setUser(authUser);
    await loadRequests(authUser.id);
  }

  async function loadRequests(uid) {
    // LOAD PENDING INCOMING
    const { data: incoming } = await supabase
      .from("friend_requests")
      .select(
        `
        id,
        sender_id,
        status,
        profiles:sender_id (display_name, handle, avatar_url)
      `
      )
      .eq("receiver_id", uid)
      .eq("status", "pending");

    // LOAD PENDING OUTGOING
    const { data: outgoing } = await supabase
      .from("friend_requests")
      .select(
        `
        id,
        receiver_id,
        status,
        profiles:receiver_id (display_name, handle, avatar_url)
      `
      )
      .eq("sender_id", uid)
      .eq("status", "pending");

    // LOAD ACCEPTED FRIENDS (BOTH WAYS)
    const { data: acceptedSent } = await supabase
      .from("friend_requests")
      .select(
        `
        id,
        receiver_id,
        profiles:receiver_id (display_name, handle, avatar_url)
      `
      )
      .eq("sender_id", uid)
      .eq("status", "accepted");

    const { data: acceptedReceived } = await supabase
      .from("friend_requests")
      .select(
        `
        id,
        sender_id,
        profiles:sender_id (display_name, handle, avatar_url)
      `
      )
      .eq("receiver_id", uid)
      .eq("status", "accepted");

    setPendingIncoming(incoming || []);
    setPendingOutgoing(outgoing || []);
    setFriends([...(acceptedSent || []), ...(acceptedReceived || [])]);
  }

  // --------------------------
  // SEARCH FRIEND BY HANDLE
  // --------------------------
  async function searchByHandle() {
    setSearchError("");
    setSearchResult(null);

    if (!searchHandle.trim()) return;

    const handleClean = searchHandle.toLowerCase().replace("@", "");

    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, handle, avatar_url")
      .eq("handle", handleClean)
      .single();

    if (error || !data) {
      setSearchError("No user found with that handle.");
      return;
    }

    if (data.id === user.id) {
      setSearchError("You cannot add yourself.");
      return;
    }

    setSearchResult(data);
  }

  // --------------------------
  // SEND REQUEST
  // --------------------------
  async function sendFriendRequest(receiverId) {
    const { error } = await supabase.from("friend_requests").insert({
      sender_id: user.id,
      receiver_id: receiverId,
      status: "pending",
    });

    if (error) return alert("Error sending request.");

    alert("Friend request sent!");
    setSearchResult(null);
    setSearchHandle("");
    loadRequests(user.id);
  }

  // --------------------------
  // ACCEPT REQUEST
  // --------------------------
  async function acceptRequest(requestId) {
    await supabase
      .from("friend_requests")
      .update({ status: "accepted" })
      .eq("id", requestId);

    loadRequests(user.id);
  }

  // --------------------------
  // DECLINE OR CANCEL
  // --------------------------
  async function declineRequest(requestId) {
    await supabase.from("friend_requests").delete().eq("id", requestId);
    loadRequests(user.id);
  }

  return (
    <div
      style={{
        padding: "16px 16px 90px",
        maxWidth: "900px",
        margin: "0 auto",
        color: "white",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Link
          to="/"
          style={{
            marginRight: 12,
            padding: 6,
            borderRadius: 8,
            background: "#111",
            border: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <FiArrowLeft size={18} />
        </Link>

        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          Friends
        </h1>
      </div>

      {/* SEARCH BAR */}
      <div
        style={{
          background: "#101010",
          borderRadius: 12,
          padding: 16,
          border: "1px solid rgba(255,255,255,0.06)",
          marginBottom: 20,
        }}
      >
        <label style={{ fontSize: 13, opacity: 0.85 }}>Add Friend</label>
        <input
          placeholder="@handle"
          value={searchHandle}
          onChange={(e) => setSearchHandle(e.target.value)}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: 8,
            marginTop: 6,
            background: "#0d0d0d",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "white",
            fontSize: 14,
          }}
        />

        <button
          onClick={searchByHandle}
          style={{
            width: "100%",
            marginTop: 10,
            padding: 10,
            background: "#ff2f2f",
            border: "none",
            borderRadius: 10,
            color: "white",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Search
        </button>

        {searchError && (
          <p style={{ marginTop: 10, fontSize: 13, color: "#ff5555" }}>
            {searchError}
          </p>
        )}

        {searchResult && (
          <div
            style={{
              marginTop: 14,
              padding: 12,
              borderRadius: 10,
              background: "#0f0f0f",
              border: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img
                src={
                  searchResult.avatar_url ||
                  "https://via.placeholder.com/60?text=?"
                }
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 999,
                  objectFit: "cover",
                }}
              />
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
                  {searchResult.display_name}
                </p>
                <p style={{ opacity: 0.7, fontSize: 13 }}>
                  @{searchResult.handle}
                </p>
              </div>
            </div>

            <button
              onClick={() => sendFriendRequest(searchResult.id)}
              style={{
                background: "#ff2f2f",
                padding: "8px 12px",
                borderRadius: 8,
                border: "none",
                color: "white",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Add
            </button>
          </div>
        )}
      </div>

      {/* PENDING INCOMING */}
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>
        Pending Requests
      </h2>

      {pendingIncoming.length === 0 ? (
        <p style={{ fontSize: 13, opacity: 0.7 }}>No incoming requests.</p>
      ) : (
        pendingIncoming.map((r) => (
          <div
            key={r.id}
            style={{
              background: "#0f0f0f",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              padding: 12,
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img
                src={
                  r.profiles?.avatar_url ||
                  "https://via.placeholder.com/50?text=?"
                }
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 999,
                }}
              />
              <div>
                <p style={{ fontWeight: 600, margin: 0 }}>
                  {r.profiles?.display_name}
                </p>
                <p style={{ opacity: 0.7, fontSize: 13 }}>
                  @{r.profiles?.handle}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => acceptRequest(r.id)}
                style={{
                  background: "#22c55e",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "none",
                  color: "white",
                  fontWeight: 600,
                }}
              >
                Accept
              </button>
              <button
                onClick={() => declineRequest(r.id)}
                style={{
                  background: "#444",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "none",
                  color: "white",
                  fontWeight: 600,
                }}
              >
                Decline
              </button>
            </div>
          </div>
        ))
      )}

      {/* PENDING OUTGOING */}
      <h2 style={{ fontSize: 16, fontWeight: 600, margin: "20px 0 10px" }}>
        Sent Requests
      </h2>

      {pendingOutgoing.length === 0 ? (
        <p style={{ fontSize: 13, opacity: 0.7 }}>
          No sent requests.
        </p>
      ) : (
        pendingOutgoing.map((r) => (
          <div
            key={r.id}
            style={{
              background: "#0f0f0f",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              padding: 12,
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img
                src={
                  r.profiles?.avatar_url ||
                  "https://via.placeholder.com/50?text=?"
                }
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 999,
                }}
              />
              <div>
                <p style={{ fontWeight: 600, margin: 0 }}>
                  {r.profiles?.display_name}
                </p>
                <p style={{ opacity: 0.7, fontSize: 13 }}>
                  @{r.profiles?.handle}
                </p>
              </div>
            </div>

            <button
              onClick={() => declineRequest(r.id)}
              style={{
                background: "#444",
                padding: "8px 12px",
                borderRadius: 8,
                border: "none",
                color: "white",
                fontWeight: 600,
              }}
            >
              Cancel
            </button>
          </div>
        ))
      )}

      {/* FRIENDS LIST */}
      <h2 style={{ fontSize: 16, fontWeight: 600, margin: "20px 0 10px" }}>
        Friends
      </h2>

      {friends.length === 0 ? (
        <p style={{ fontSize: 13, opacity: 0.7 }}>No friends yet.</p>
      ) : (
        friends.map((f) => (
          <div
            key={f.id}
            style={{
              background: "#0f0f0f",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              padding: 12,
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <img
              src={
                f.profiles?.avatar_url ||
                "https://via.placeholder.com/50?text=?"
              }
              style={{
                width: 46,
                height: 46,
                borderRadius: 999,
              }}
            />
            <div>
              <p style={{ fontWeight: 600, margin: 0 }}>
                {f.profiles?.display_name}
              </p>
              <p style={{ opacity: 0.7, fontSize: 13 }}>
                @{f.profiles?.handle}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
