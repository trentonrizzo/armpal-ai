// src/pages/FriendsPage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Link } from "react-router-dom";

export default function FriendsPage() {
  const [user, setUser] = useState(null);

  // Data
  const [friends, setFriends] = useState([]);   // accepted friends (profiles)
  const [incoming, setIncoming] = useState([]); // pending requests TO you
  const [outgoing, setOutgoing] = useState([]); // pending requests FROM you

  // UI state
  const [showAddBox, setShowAddBox] = useState(false);
  const [handleInput, setHandleInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser();
      const current = data?.user || null;
      setUser(current);

      if (current?.id) {
        await loadAllFriends(current.id);
      }
    }
    load();
  }, []);

  // -------------------------
  // LOAD FRIENDS + REQUESTS
  // -------------------------
  async function loadAllFriends(myId) {
    // 1) ACCEPTED FRIENDS (both directions)
    const { data: acceptedRows, error: acceptedErr } = await supabase
      .from("friend_requests")
      .select("*")
      .or(
        `and(sender_id.eq.${myId},status.eq.accepted),and(receiver_id.eq.${myId},status.eq.accepted)`
      );

    if (acceptedErr) {
      console.error("Error loading accepted friends:", acceptedErr);
    }

    const friendIds = new Set();
    (acceptedRows || []).forEach((row) => {
      if (row.sender_id === myId) {
        friendIds.add(row.receiver_id);
      } else {
        friendIds.add(row.sender_id);
      }
    });

    let friendProfiles = [];
    if (friendIds.size > 0) {
      const { data: profiles, error: profilesErr } = await supabase
        .from("profiles")
        .select("id, username, handle, last_active")
        .in("id", Array.from(friendIds));

      if (profilesErr) {
        console.error("Error loading friend profiles:", profilesErr);
      }
      friendProfiles = profiles || [];
    }
    setFriends(friendProfiles);

    // 2) INCOMING PENDING REQUESTS (they added YOU)
    const { data: incomingRows, error: incomingErr } = await supabase
      .from("friend_requests")
      .select("id, sender_id, status")
      .eq("receiver_id", myId)
      .eq("status", "pending");

    if (incomingErr) {
      console.error("Error loading incoming requests:", incomingErr);
    }

    let incomingWithProfiles = [];
    if (incomingRows?.length) {
      const ids = incomingRows.map((r) => r.sender_id);
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, username, handle")
        .in("id", ids);

      if (pErr) {
        console.error("Error loading incoming profiles:", pErr);
      }

      incomingWithProfiles = incomingRows.map((row) => ({
        ...row,
        profile: (profiles || []).find((p) => p.id === row.sender_id) || null,
      }));
    }
    setIncoming(incomingWithProfiles);

    // 3) OUTGOING PENDING REQUESTS (YOU added THEM)
    const { data: outgoingRows, error: outgoingErr } = await supabase
      .from("friend_requests")
      .select("id, receiver_id, status")
      .eq("sender_id", myId)
      .eq("status", "pending");

    if (outgoingErr) {
      console.error("Error loading outgoing requests:", outgoingErr);
    }

    let outgoingWithProfiles = [];
    if (outgoingRows?.length) {
      const ids = outgoingRows.map((r) => r.receiver_id);
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, username, handle")
        .in("id", ids);

      if (pErr) {
        console.error("Error loading outgoing profiles:", pErr);
      }

      outgoingWithProfiles = outgoingRows.map((row) => ({
        ...row,
        profile: (profiles || []).find((p) => p.id === row.receiver_id) || null,
      }));
    }
    setOutgoing(outgoingWithProfiles);
  }

  // -------------------------
  // SEND FRIEND REQUEST
  // -------------------------
  async function sendFriendRequest() {
    try {
      setErrorMsg("");
      if (!user?.id) return;

      const rawHandle = handleInput.trim();
      if (!rawHandle) return;

      const normalized = rawHandle.replace("@", "").toLowerCase();

      // Find target profile (case-insensitive handle search)
      const { data: target, error: searchErr } = await supabase
        .from("profiles")
        .select("id, username, handle")
        .ilike("handle", normalized)
        .maybeSingle();

      if (searchErr || !target) {
        setErrorMsg("No user found with that handle.");
        return;
      }

      if (target.id === user.id) {
        setErrorMsg("You can’t add yourself.");
        return;
      }

      // Check if a request already exists (either direction)
      const { data: existing, error: existErr } = await supabase
        .from("friend_requests")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${target.id}),and(sender_id.eq.${target.id},receiver_id.eq.${user.id})`
        );

      if (existErr) {
        console.error("Error checking existing:", existErr);
      }

      if (existing && existing.length > 0) {
        setErrorMsg("Request already exists or you’re already friends.");
        return;
      }

      const { error: insertErr } = await supabase.from("friend_requests").insert({
        sender_id: user.id,
        receiver_id: target.id,
        status: "pending",
      });

      if (insertErr) {
        console.error(insertErr);
        setErrorMsg("Error sending request.");
        return;
      }

      setHandleInput("");
      setShowAddBox(false);
      await loadAllFriends(user.id);
    } catch (err) {
      console.error(err);
      setErrorMsg("Unexpected error sending request.");
    }
  }

  // -------------------------
  // ACCEPT / DECLINE
  // -------------------------
  async function acceptRequest(rowId) {
    if (!user?.id) return;
    const { error } = await supabase
      .from("friend_requests")
      .update({ status: "accepted" })
      .eq("id", rowId);

    if (error) console.error("Accept error:", error);
    await loadAllFriends(user.id);
  }

  async function declineRequest(rowId) {
    if (!user?.id) return;
    const { error } = await supabase
      .from("friend_requests")
      .delete()
      .eq("id", rowId);

    if (error) console.error("Decline error:", error);
    await loadAllFriends(user.id);
  }

  // -------------------------
  // ONLINE DOT (last_active)
  // -------------------------
  function isOnline(lastActive) {
    if (!lastActive) return false;
    const diff = Date.now() - new Date(lastActive).getTime();
    return diff < 60_000; // last 60s
  }

  // -------------------------
  // RENDER
  // -------------------------
  return (
    <div style={pageContainer}>
      {/* HEADER */}
      <h1 style={headerTitle}>Friends</h1>

      {/* ADD FRIEND CARD */}
      <section style={card}>
        {/* Big red button */}
        <button
          style={bigAddButton}
          onClick={() => {
            setShowAddBox((v) => !v);
            setErrorMsg("");
          }}
        >
          <span style={{ fontSize: 20, marginRight: 6 }}>＋</span>
          <span>Add Friend</span>
        </button>

        {/* Reveal search box when button tapped */}
        {showAddBox && (
          <div style={{ marginTop: 10 }}>
            <p style={smallMuted}>
              Search by{" "}
              <span style={{ fontFamily: "monospace" }}>@handle</span>
            </p>

            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 8,
                alignItems: "center",
              }}
            >
              <input
                type="text"
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value)}
                placeholder="@trentarmgod"
                style={textInput}
              />

              <button style={smallRedButton} onClick={sendFriendRequest}>
                Send
              </button>

              <button
                style={smallGhostButton}
                onClick={() => {
                  setShowAddBox(false);
                  setHandleInput("");
                  setErrorMsg("");
                }}
              >
                Cancel
              </button>
            </div>

            {errorMsg && (
              <p style={{ color: "#ff6b6b", fontSize: 12, marginTop: 6 }}>
                {errorMsg}
              </p>
            )}
          </div>
        )}
      </section>

      {/* INCOMING REQUESTS */}
      {incoming.length > 0 && (
        <section style={card}>
          <h2 style={sectionTitle}>Friend Requests</h2>
          {incoming.map((req) => {
            const p = req.profile;
            return (
              <div key={req.id} style={row}>
                <div>
                  <p style={rowMainText}>{p?.handle || p?.username}</p>
                  <p style={rowSubText}>@{p?.username}</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    style={smallGreenButton}
                    onClick={() => acceptRequest(req.id)}
                  >
                    Accept
                  </button>
                  <button
                    style={smallRedButton}
                    onClick={() => declineRequest(req.id)}
                  >
                    Decline
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* OUTGOING REQUESTS */}
      {outgoing.length > 0 && (
        <section style={card}>
          <h2 style={sectionTitle}>Sent Requests</h2>
          {outgoing.map((req) => {
            const p = req.profile;
            return (
              <div key={req.id} style={row}>
                <div>
                  <p style={rowMainText}>{p?.handle || p?.username}</p>
                  <p style={rowSubText}>@{p?.username}</p>
                </div>
                <span style={{ fontSize: 11, color: "#ffc857" }}>
                  Pending
                </span>
              </div>
            );
          })}
        </section>
      )}

      {/* FRIENDS LIST */}
      <section style={card}>
        <h2 style={sectionTitle}>Your Friends</h2>

        {friends.length === 0 ? (
          <p style={smallMuted}>No friends yet — add some!</p>
        ) : (
          friends.map((p) => {
            const online = isOnline(p.last_active);
            return (
              <div key={p.id} style={row}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {/* Circle avatar with first letter */}
                  <div style={avatarCircle}>
                    {(p.handle || p.username || "?")
                      .charAt(0)
                      .toUpperCase()}
                    {online && <span style={onlineDot} />}
                  </div>
                  <div>
                    <p style={rowMainText}>{p.handle || p.username}</p>
                    <p style={rowSubText}>
                      {online ? "Online" : "Offline"}
                    </p>
                  </div>
                </div>

                {/* Message button → /chat/:friendId */}
                <Link to={`/chat/${p.id}`} style={smallRedButtonLink}>
                  Message
                </Link>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

/* --------- SHARED STYLES ---------- */

const pageContainer = {
  padding: "16px 16px 90px",
  maxWidth: "900px",
  margin: "0 auto",
};

const headerTitle = {
  fontSize: 26,
  fontWeight: 700,
  marginBottom: 14,
};

const card = {
  background: "#101010",
  borderRadius: 14,
  padding: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  marginBottom: 16,
};

const sectionTitle = {
  fontSize: 15,
  fontWeight: 600,
  marginBottom: 8,
};

const bigAddButton = {
  width: "100%",
  padding: "12px 16px",
  background: "#ff2f2f",
  borderRadius: 12,
  border: "none",
  color: "white",
  fontSize: 16,
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
};

const textInput = {
  flex: 1,
  padding: "9px 10px",
  background: "#050505",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  color: "white",
  fontSize: 14,
};

const smallRedButton = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "none",
  background: "#ff2f2f",
  color: "white",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const smallGreenButton = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "none",
  background: "#1fbf61",
  color: "white",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const smallGhostButton = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.3)",
  background: "transparent",
  color: "rgba(255,255,255,0.8)",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
};

const smallRedButtonLink = {
  ...smallRedButton,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const smallMuted = {
  fontSize: 12,
  opacity: 0.7,
};

const row = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 0",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};

const rowMainText = {
  fontSize: 14,
  fontWeight: 600,
  margin: 0,
};

const rowSubText = {
  fontSize: 11,
  opacity: 0.7,
  margin: 0,
};

const avatarCircle = {
  width: 34,
  height: 34,
  borderRadius: "999px",
  background: "#000",
  border: "1px solid rgba(255,255,255,0.18)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 15,
  fontWeight: 700,
  position: "relative",
};

const onlineDot = {
  position: "absolute",
  right: -1,
  bottom: -1,
  width: 9,
  height: 9,
  borderRadius: "999px",
  background: "#1fbf61",
  border: "2px solid #000",
};
