// src/pages/FriendsPage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Link } from "react-router-dom";

// ------- COMPONENT START -------
export default function FriendsPage() {
  const [user, setUser] = useState(null);

  // Data
  const [friends, setFriends] = useState([]); 
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);

  // UI
  const [showAddBox, setShowAddBox] = useState(false);
  const [handleInput, setHandleInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);

      if (data.user?.id) {
        await loadAllFriends(data.user.id);
      }
    }
    load();
  }, []);

  // -------------------------------------------------------------------
  // LOAD FRIENDS, INCOMING, OUTGOING
  // -------------------------------------------------------------------
  async function loadAllFriends(myId) {
    // ACCEPTED FRIENDS (both directions)
    const { data: asUser } = await supabase
      .from("friends")
      .select("id, friend_id")
      .eq("user_id", myId)
      .eq("status", "accepted");

    const { data: asFriend } = await supabase
      .from("friends")
      .select("id, user_id")
      .eq("friend_id", myId)
      .eq("status", "accepted");

    const friendIds = new Set();
    (asUser || []).forEach((row) => friendIds.add(row.friend_id));
    (asFriend || []).forEach((row) => friendIds.add(row.user_id));

    let friendsProfiles = [];
    if (friendIds.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, handle, last_active")
        .in("id", Array.from(friendIds));

      friendsProfiles = profiles || [];
    }
    setFriends(friendsProfiles);

    // INCOMING REQUESTS
    const { data: incomingRows } = await supabase
      .from("friends")
      .select("id, user_id")
      .eq("friend_id", myId)
      .eq("status", "pending");

    if (incomingRows?.length > 0) {
      const ids = incomingRows.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, handle")
        .in("id", ids);

      const full = incomingRows.map((row) => ({
        ...row,
        profile: profiles.find((p) => p.id === row.user_id) || null,
      }));

      setIncoming(full);
    } else setIncoming([]);

    // OUTGOING REQUESTS
    const { data: outgoingRows } = await supabase
      .from("friends")
      .select("id, friend_id")
      .eq("user_id", myId)
      .eq("status", "pending");

    if (outgoingRows?.length > 0) {
      const ids = outgoingRows.map((r) => r.friend_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, handle")
        .in("id", ids);

      const full = outgoingRows.map((row) => ({
        ...row,
        profile: profiles.find((p) => p.id === row.friend_id) || null,
      }));

      setOutgoing(full);
    } else setOutgoing([]);
  }

  // -------------------------------------------------------------------
  // SEND FRIEND REQUEST
  // -------------------------------------------------------------------
  async function sendFriendRequest() {
    try {
      setErrorMsg("");
      if (!user?.id) return;

      const handle = handleInput.trim();
      if (!handle) return;

      const { data: target, error } = await supabase
        .from("profiles")
        .select("id, handle, username")
        .eq("handle", handle)
        .maybeSingle();

      if (error || !target) {
        setErrorMsg("No user found with that handle.");
        return;
      }

      if (target.id === user.id) {
        setErrorMsg("You can't add yourself.");
        return;
      }

      // check existing
      const { data: existing } = await supabase
        .from("friends")
        .select("id, status")
        .or(
          `and(user_id.eq.${user.id},friend_id.eq.${target.id}),and(user_id.eq.${target.id},friend_id.eq.${user.id})`
        );

      if (existing?.length > 0) {
        setErrorMsg("Request already exists or you're already friends.");
        return;
      }

      await supabase.from("friends").insert({
        user_id: user.id,
        friend_id: target.id,
        status: "pending",
      });

      setHandleInput("");
      setShowAddBox(false);
      await loadAllFriends(user.id);
    } catch (err) {
      console.error(err);
      setErrorMsg("Error sending request.");
    }
  }

  // ACCEPT REQUEST
  async function acceptRequest(rowId) {
    if (!user?.id) return;
    await supabase.from("friends").update({ status: "accepted" }).eq("id", rowId);
    await loadAllFriends(user.id);
  }

  // DECLINE REQUEST
  async function declineRequest(rowId) {
    if (!user?.id) return;
    await supabase.from("friends").delete().eq("id", rowId);
    await loadAllFriends(user.id);
  }

  // -------------------------------------------------------------------
  // ONLINE STATUS HELPERS
  // -------------------------------------------------------------------
  function isOnline(lastActive) {
    if (!lastActive) return false;
    const diff = Date.now() - new Date(lastActive).getTime();
    return diff < 60000;
  }

  // -------------------------------------------------------------------
  // UI
  // -------------------------------------------------------------------
  return (
    <div style={pageWrap}>
      <h1 style={title}>Friends</h1>

      {/* ADD FRIEND BUTTON */}
      <section style={card}>
        <button
          style={bigAddButton}
          onClick={() => {
            setShowAddBox((v) => !v);
            setErrorMsg("");
          }}
        >
          ＋ Add Friend
        </button>

        {/* SEARCH BOX SLIDE DOWN */}
        {showAddBox && (
          <div style={{ marginTop: 12 }}>
            <p style={smallMuted}>
              Search by <span style={mono}>@handle</span>
            </p>

            <div style={addRow}>
              <input
                type="text"
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value)}
                placeholder="@armgod"
                style={inputBox}
              />

              <button style={sendBtn} onClick={sendFriendRequest}>
                Send
              </button>

              <button
                style={cancelBtn}
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
              <p style={errorStyle}>{errorMsg}</p>
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
                <div style={rowLeft}>
                  <div style={avatarCircle}>
                    {(p?.handle || p?.username || "?").charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <p style={nameText}>{p?.handle || p?.username}</p>
                    <p style={subText}>@{p?.username}</p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button style={acceptBtn} onClick={() => acceptRequest(req.id)}>
                    Accept
                  </button>
                  <button style={declineBtn} onClick={() => declineRequest(req.id)}>
                    Decline
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* OUTGOING */}
      {outgoing.length > 0 && (
        <section style={card}>
          <h2 style={sectionTitle}>Sent Requests</h2>

          {outgoing.map((req) => {
            const p = req.profile;
            return (
              <div key={req.id} style={row}>
                <div style={rowLeft}>
                  <div style={avatarCircle}>
                    {(p?.handle || p?.username || "?").charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <p style={nameText}>{p?.handle || p?.username}</p>
                    <p style={subText}>@{p?.username}</p>
                  </div>
                </div>

                <span style={pendingText}>Pending</span>
              </div>
            );
          })}
        </section>
      )}

      {/* FRIEND LIST */}
      <section style={card}>
        <h2 style={sectionTitle}>Your Friends</h2>

        {friends.length === 0 ? (
          <p style={smallMuted}>You haven't added anyone yet.</p>
        ) : (
          friends.map((p) => {
            const online = isOnline(p.last_active);

            return (
              <div key={p.id} style={row}>
                <div style={rowLeft}>
                  <div style={avatarCircle}>
                    {(p.handle || p.username || "?").charAt(0).toUpperCase()}
                    {online && <span style={onlineDot} />}
                  </div>

                  <div>
                    <p style={nameText}>{p.handle || p.username}</p>
                    <p style={subText}>{online ? "Online" : "Offline"}</p>
                  </div>
                </div>

                <Link to={`/chat/${p.id}`} style={msgBtn}>
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

// -----------------------------------------------------------------------
// STYLES (CLEAN AF)
// -----------------------------------------------------------------------
const pageWrap = {
  padding: "16px 16px 90px",
  maxWidth: 900,
  margin: "0 auto",
  color: "white",
};

const title = {
  fontSize: 28,
  fontWeight: 700,
  marginBottom: 16,
};

const card = {
  background: "#101010",
  borderRadius: 16,
  padding: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  marginBottom: 20,
};

const bigAddButton = {
  width: "100%",
  padding: "14px 16px",
  background: "#ff2f2f",
  borderRadius: 12,
  border: "none",
  color: "white",
  fontSize: 17,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 8px 20px rgba(0,0,0,0.4)",
};

const sectionTitle = {
  fontSize: 17,
  fontWeight: 600,
  marginBottom: 10,
};

const addRow = {
  display: "flex",
  gap: 8,
  marginTop: 8,
  alignItems: "center",
};

const inputBox = {
  flex: 1,
  padding: "10px",
  background: "#050505",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  color: "white",
};

const sendBtn = {
  padding: "10px 12px",
  background: "#ff2f2f",
  color: "white",
  borderRadius: 10,
  fontWeight: 700,
  cursor: "pointer",
  border: "none",
};

const cancelBtn = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.3)",
  background: "transparent",
  color: "white",
  cursor: "pointer",
};

const errorStyle = {
  color: "#ff6b6b",
  fontSize: 13,
  marginTop: 6,
};

const row = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 0",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};

const rowLeft = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const avatarCircle = {
  width: 40,
  height: 40,
  borderRadius: "50%",
  background: "#000",
  border: "1px solid rgba(255,255,255,0.15)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  fontWeight: 700,
  position: "relative",
};

const onlineDot = {
  position: "absolute",
  right: -2,
  bottom: -2,
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: "#1fbf61",
  border: "2px solid #000",
};

const nameText = {
  fontSize: 15,
  fontWeight: 600,
};

const subText = {
  fontSize: 12,
  opacity: 0.6,
  marginTop: -2,
};

const pendingText = {
  fontSize: 13,
  color: "#ffc857",
};

const msgBtn = {
  padding: "8px 12px",
  background: "#ff2f2f",
  color: "white",
  borderRadius: 10,
  textDecoration: "none",
  fontWeight: 700,
};

// END OF FILE
