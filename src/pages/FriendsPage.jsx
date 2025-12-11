// src/pages/FriendsPage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Link } from "react-router-dom";

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
  const [successMsg, setSuccessMsg] = useState("");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser();
      const current = data?.user || null;
      setUser(current);

      if (current?.id) {
        await loadAllFriends(current.id);
      }
      setLoading(false);
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
      .select("id, friend_id, status")
      .eq("user_id", myId)
      .eq("status", "accepted");

    const { data: asFriend } = await supabase
      .from("friends")
      .select("id, user_id, status")
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
      .select("id, user_id, status")
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
        profile: (profiles || []).find((p) => p.id === row.user_id) || null,
      }));

      setIncoming(full);
    } else {
      setIncoming([]);
    }

    // OUTGOING REQUESTS
    const { data: outgoingRows } = await supabase
      .from("friends")
      .select("id, friend_id, status")
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
        profile: (profiles || []).find((p) => p.id === row.friend_id) || null,
      }));

      setOutgoing(full);
    } else {
      setOutgoing([]);
    }
  }

  // -------------------------------------------------------------------
  // SEND FRIEND REQUEST  (case-insensitive handle, clear feedback)
  // -------------------------------------------------------------------
  async function sendFriendRequest() {
    try {
      setErrorMsg("");
      setSuccessMsg("");

      if (!user?.id) return;

      const raw = handleInput.trim();
      if (!raw) {
        setErrorMsg("Enter a handle first.");
        return;
      }

      // Strip leading @ and normalize to lowercase
      const cleaned = raw.startsWith("@") ? raw.slice(1) : raw;
      const normalized = cleaned.toLowerCase();

      setSending(true);

      // CASE-INSENSITIVE SEARCH BY HANDLE
      const { data: target, error: targetErr } = await supabase
        .from("profiles")
        .select("id, handle, username")
        .ilike("handle", normalized) // case-insensitive
        .maybeSingle();

      if (targetErr || !target) {
        setErrorMsg("No user found with that handle.");
        setSending(false);
        return;
      }

      if (target.id === user.id) {
        setErrorMsg("You can’t add yourself.");
        setSending(false);
        return;
      }

      // Check existing relationship / request
      const { data: existing } = await supabase
        .from("friends")
        .select("id, status, user_id, friend_id")
        .or(
          `and(user_id.eq.${user.id},friend_id.eq.${target.id}),and(user_id.eq.${target.id},friend_id.eq.${user.id})`
        );

      if (existing && existing.length > 0) {
        const row = existing[0];
        if (row.status === "accepted") {
          setErrorMsg("You’re already friends.");
        } else {
          setErrorMsg("A request already exists.");
        }
        setSending(false);
        return;
      }

      // Insert request
      const { error: insertErr } = await supabase.from("friends").insert({
        user_id: user.id,
        friend_id: target.id,
        status: "pending",
      });

      if (insertErr) {
        console.error(insertErr);
        setErrorMsg("Error sending request.");
        setSending(false);
        return;
      }

      setSuccessMsg(
        `Friend request sent to @${
          target.handle || target.username || "user"
        }.`
      );
      setHandleInput("");
      await loadAllFriends(user.id);
    } catch (err) {
      console.error(err);
      setErrorMsg("Error sending request.");
    } finally {
      setSending(false);
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
    return diff < 60_000; // within 60s = online
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
              Search by <span style={mono}>@handle</span> (case-insensitive)
            </p>

            <div style={addRow}>
              <input
                type="text"
                value={handleInput}
                onChange={(e) => {
                  setHandleInput(e.target.value);
                  setErrorMsg("");
                  setSuccessMsg("");
                }}
                placeholder="@kranjis"
                style={inputBox}
              />

              <button
                style={{
                  ...sendBtn,
                  opacity: sending ? 0.7 : 1,
                  cursor: sending ? "wait" : "pointer",
                }}
                onClick={sendFriendRequest}
                disabled={sending}
              >
                {sending ? "Sending..." : "Send"}
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
            {successMsg && <p style={successStyle}>{successMsg}</p>}
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

        {loading ? (
          <p style={smallMuted}>Loading friends...</p>
        ) : friends.length === 0 ? (
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

const smallMuted = {
  fontSize: 12,
  opacity: 0.7,
};

const mono = {
  fontFamily: "monospace",
};

const errorStyle = {
  color: "#ff6b6b",
  fontSize: 13,
  marginTop: 6,
};

const successStyle = {
  color: "#4ade80",
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
