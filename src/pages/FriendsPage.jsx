// src/pages/FriendsPage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Link } from "react-router-dom";

export default function FriendsPage() {
  const [user, setUser] = useState(null);

  // Data
  const [friends, setFriends] = useState([]); // accepted friends (profiles)
  const [incoming, setIncoming] = useState([]); // pending where friend_id = me
  const [outgoing, setOutgoing] = useState([]); // pending where user_id = me

  // UI
  const [showAddBox, setShowAddBox] = useState(false);
  const [handleInput, setHandleInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

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

  // -------------------------------------------------------------------
  // LOAD ALL FRIEND DATA IN ONE GO
  // -------------------------------------------------------------------
  async function loadAllFriends(myId) {
    try {
      // Get ALL friend rows where I'm involved (no status filter here)
      const { data: rows, error } = await supabase
        .from("friends")
        .select("id, user_id, friend_id, status")
        .or(`user_id.eq.${myId},friend_id.eq.${myId}`);

      if (error) {
        console.error("friends select error:", error);
        setFriends([]);
        setIncoming([]);
        setOutgoing([]);
        return;
      }

      const acceptedIds = new Set();
      const incomingRows = [];
      const outgoingRows = [];

      (rows || []).forEach((row) => {
        const { user_id, friend_id, status } = row;

        // normalize status
        const st = (status || "").toLowerCase();

        if (st === "accepted") {
          // accepted friend — whichever is NOT me is the friend
          const otherId = user_id === myId ? friend_id : user_id;
          acceptedIds.add(otherId);
        } else if (st === "pending") {
          if (friend_id === myId) {
            // they sent request to me
            incomingRows.push(row);
          } else if (user_id === myId) {
            // I sent request to them
            outgoingRows.push(row);
          }
        }
      });

      const profileIds = new Set();
      acceptedIds.forEach((id) => profileIds.add(id));
      incomingRows.forEach((row) => profileIds.add(row.user_id));
      outgoingRows.forEach((row) => profileIds.add(row.friend_id));

      let profiles = [];
      if (profileIds.size > 0) {
        const { data: profData, error: profErr } = await supabase
          .from("profiles")
          .select("id, username, handle, last_active")
          .in("id", Array.from(profileIds));

        if (profErr) {
          console.error("profiles error:", profErr);
        } else {
          profiles = profData || [];
        }
      }

      const profileMap = {};
      profiles.forEach((p) => {
        profileMap[p.id] = p;
      });

      // Build accepted friends list
      const acceptedList = Array.from(acceptedIds)
        .map((id) => profileMap[id])
        .filter(Boolean);

      // Build incoming/outgoing with attached profiles
      const incomingFull = incomingRows.map((row) => ({
        ...row,
        profile: profileMap[row.user_id] || null,
      }));

      const outgoingFull = outgoingRows.map((row) => ({
        ...row,
        profile: profileMap[row.friend_id] || null,
      }));

      setFriends(acceptedList);
      setIncoming(incomingFull);
      setOutgoing(outgoingFull);
    } catch (err) {
      console.error("loadAllFriends error:", err);
      setFriends([]);
      setIncoming([]);
      setOutgoing([]);
    }
  }

  // -------------------------------------------------------------------
  // SEND FRIEND REQUEST
  // -------------------------------------------------------------------
  async function sendFriendRequest() {
    try {
      setErrorMsg("");
      setSuccessMsg("");
      if (!user?.id) return;

      let raw = handleInput.trim();
      if (!raw) return;

      // allow @handle or handle
      if (raw.startsWith("@")) raw = raw.slice(1);

      // search case-insensitive
      const { data: target, error } = await supabase
        .from("profiles")
        .select("id, handle, username")
        .ilike("handle", raw)
        .maybeSingle();

      if (error || !target) {
        setErrorMsg("No user found with that handle.");
        return;
      }

      if (target.id === user.id) {
        setErrorMsg("You can’t add yourself.");
        return;
      }

      // check if existing friendship/req
      const { data: existing, error: existErr } = await supabase
        .from("friends")
        .select("id, status, user_id, friend_id")
        .or(
          `and(user_id.eq.${user.id},friend_id.eq.${target.id}),and(user_id.eq.${target.id},friend_id.eq.${user.id})`
        );

      if (existErr) {
        console.error("friends existing error:", existErr);
      }

      if (existing && existing.length > 0) {
        setErrorMsg("Request already exists or you’re already friends.");
        return;
      }

      const { error: insertErr } = await supabase.from("friends").insert({
        user_id: user.id,
        friend_id: target.id,
        status: "pending",
      });

      if (insertErr) {
        console.error("insert friend error:", insertErr);
        setErrorMsg("Error sending request.");
        return;
      }

      setHandleInput("");
      setShowAddBox(false);
      setSuccessMsg(
        `Friend request sent to @${
          target.handle || target.username || "user"
        }.`
      );

      await loadAllFriends(user.id);
    } catch (err) {
      console.error(err);
      setErrorMsg("Error sending request.");
    }
  }

  // ACCEPT REQUEST
  async function acceptRequest(rowId) {
    if (!user?.id) return;
    const { error } = await supabase
      .from("friends")
      .update({ status: "accepted" })
      .eq("id", rowId);

    if (error) console.error("accept error:", error);
    await loadAllFriends(user.id);
  }

  // DECLINE REQUEST
  async function declineRequest(rowId) {
    if (!user?.id) return;
    const { error } = await supabase.from("friends").delete().eq("id", rowId);
    if (error) console.error("decline error:", error);
    await loadAllFriends(user.id);
  }

  // -------------------------------------------------------------------
  // ONLINE STATUS HELPERS
  // -------------------------------------------------------------------
  function isOnline(lastActive) {
    if (!lastActive) return false;
    const diff = Date.now() - new Date(lastActive).getTime();
    return diff < 60000; // last 60s
  }

  // -------------------------------------------------------------------
  // UI
  // -------------------------------------------------------------------
  return (
    <div style={pageWrap}>
      <h1 style={title}>Friends</h1>

      {/* ADD FRIEND CARD */}
      <section style={card}>
        <button
          style={bigAddButton}
          onClick={() => {
            setShowAddBox((v) => !v);
            setErrorMsg("");
            setSuccessMsg("");
          }}
        >
          ＋ Add Friend
        </button>

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
                placeholder="@crangis"
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
                  setSuccessMsg("");
                }}
              >
                Cancel
              </button>
            </div>

            {errorMsg && <p style={errorStyle}>{errorMsg}</p>}
          </div>
        )}

        {successMsg && !showAddBox && (
          <p style={successStyle}>{successMsg}</p>
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
                    {(p?.handle || p?.username || "?")
                      .charAt(0)
                      .toUpperCase()}
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
                  <button
                    style={declineBtn}
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
                <div style={rowLeft}>
                  <div style={avatarCircle}>
                    {(p?.handle || p?.username || "?")
                      .charAt(0)
                      .toUpperCase()}
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
          <p style={smallMuted}>You haven&apos;t added anyone yet.</p>
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
// STYLES
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

const successStyle = {
  color: "#4ade80",
  fontSize: 13,
  marginTop: 8,
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

const smallMuted = {
  fontSize: 12,
  opacity: 0.7,
};

const mono = {
  fontFamily: "monospace",
};
