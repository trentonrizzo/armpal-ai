// src/pages/FriendsPage.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Link } from "react-router-dom";

export default function FriendsPage() {
  const [user, setUser] = useState(null);

  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);

  const [showAddBox, setShowAddBox] = useState(false);
  const [handleInput, setHandleInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);

      if (data?.user?.id) {
        await loadAllFriends(data.user.id);
      }
    }
    load();
  }, []);

  async function loadAllFriends(myId) {
    // -------------------------
    // ACCEPTED FRIENDS
    // -------------------------
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
    (asUser || []).forEach((r) => friendIds.add(r.friend_id));
    (asFriend || []).forEach((r) => friendIds.add(r.user_id));

    let profilesSafe = [];
    if (friendIds.size > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, handle, last_active")
        .in("id", [...friendIds]);

      profilesSafe = profs || [];
    }
    setFriends(profilesSafe);

    // -------------------------
    // INCOMING REQUESTS
    // -------------------------
    const { data: incomingRows } = await supabase
      .from("friends")
      .select("id, user_id")
      .eq("friend_id", myId)
      .eq("status", "pending");

    let incomingList = [];
    if (incomingRows?.length > 0) {
      const ids = incomingRows.map((r) => r.user_id);

      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, handle")
        .in("id", ids);

      const pmap = new Map((profs || []).map((p) => [p.id, p]));

      incomingList = incomingRows.map((r) => ({
        ...r,
        profile: pmap.get(r.user_id) || null,
      }));
    }
    setIncoming(incomingList);

    // -------------------------
    // OUTGOING REQUESTS
    // -------------------------
    const { data: outgoingRows } = await supabase
      .from("friends")
      .select("id, friend_id")
      .eq("user_id", myId)
      .eq("status", "pending");

    let outgoingList = [];
    if (outgoingRows?.length > 0) {
      const ids = outgoingRows.map((r) => r.friend_id);

      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, handle")
        .in("id", ids);

      const pmap = new Map((profs || []).map((p) => [p.id, p]));

      outgoingList = outgoingRows.map((r) => ({
        ...r,
        profile: pmap.get(r.friend_id) || null,
      }));
    }
    setOutgoing(outgoingList);
  }

  // -------------------------
  // SEND REQUEST
  // -------------------------
  async function sendFriendRequest() {
    try {
      setErrorMsg("");

      if (!user?.id) return;

      const handle = handleInput.trim();
      if (!handle) return;

      const { data: target } = await supabase
        .from("profiles")
        .select("id, handle, username")
        .eq("handle", handle)
        .maybeSingle();

      if (!target) {
        setErrorMsg("User not found.");
        return;
      }

      if (target.id === user.id) {
        setErrorMsg("You can't add yourself.");
        return;
      }

      const { data: existing } = await supabase
        .from("friends")
        .select("id")
        .or(
          `and(user_id.eq.${user.id},friend_id.eq.${target.id}),and(user_id.eq.${target.id},friend_id.eq.${user.id})`
        );

      if (existing?.length > 0) {
        setErrorMsg("Request already exists.");
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

  async function acceptRequest(id) {
    if (!user?.id) return;
    await supabase.from("friends").update({ status: "accepted" }).eq("id", id);
    await loadAllFriends(user.id);
  }

  async function declineRequest(id) {
    if (!user?.id) return;
    await supabase.from("friends").delete().eq("id", id);
    await loadAllFriends(user.id);
  }

  function isOnline(ts) {
    if (!ts) return false;
    return Date.now() - new Date(ts).getTime() < 60000;
  }

  // -------------------------
  // UI
  // -------------------------
  return (
    <div style={pageWrap}>
      <h1 style={title}>Friends</h1>

      {/* ADD FRIEND */}
      <section style={card}>
        <button style={bigAddButton} onClick={() => setShowAddBox(!showAddBox)}>
          ＋ Add Friend
        </button>

        {showAddBox && (
          <div style={{ marginTop: 14 }}>
            <input
              style={inputBox}
              value={handleInput}
              onChange={(e) => setHandleInput(e.target.value)}
              placeholder="@handle"
            />
            <button style={sendBtn} onClick={sendFriendRequest}>
              Send
            </button>

            {errorMsg && <p style={errorStyle}>{errorMsg}</p>}
          </div>
        )}
      </section>

      {/* INCOMING */}
      {incoming.length > 0 && (
        <section style={card}>
          <h2 style={sectionTitle}>Friend Requests</h2>
          {incoming.map((req) => {
            const p = req.profile;
            const letter = p?.handle?.[0]?.toUpperCase() || p?.username?.[0]?.toUpperCase() || "?";

            return (
              <div key={req.id} style={row}>
                <div style={rowLeft}>
                  <div style={avatarCircle}>{letter}</div>
                  <div>
                    <p style={nameText}>{p?.handle || p?.username || "Unknown"}</p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                  <button style={acceptBtn} onClick={() => acceptRequest(req.id)}>Accept</button>
                  <button style={declineBtn} onClick={() => declineRequest(req.id)}>Decline</button>
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
            const letter = p?.handle?.[0]?.toUpperCase() || p?.username?.[0]?.toUpperCase() || "?";

            return (
              <div key={req.id} style={row}>
                <div style={rowLeft}>
                  <div style={avatarCircle}>{letter}</div>
                  <p style={nameText}>{p?.handle || p?.username || "Unknown"}</p>
                </div>
                <span style={{ color: "#ffc857" }}>Pending</span>
              </div>
            );
          })}
        </section>
      )}

      {/* FRIEND LIST */}
      <section style={card}>
        <h2 style={sectionTitle}>Your Friends</h2>

        {friends.map((p) => {
          const letter = p?.handle?.[0]?.toUpperCase() || p?.username?.[0]?.toUpperCase() || "?";
          const online = isOnline(p.last_active);

          return (
            <div key={p.id} style={row}>
              <div style={rowLeft}>
                <div style={avatarCircle}>
                  {letter}
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
        })}
      </section>
    </div>
  );
}

// ---------------------- STYLES ----------------------
const pageWrap = { padding: "18px 16px 90px", maxWidth: 900, margin: "0 auto" };
const title = { fontSize: 28, fontWeight: 700, marginBottom: 16 };
const card = { background: "#101010", padding: 16, borderRadius: 16, marginBottom: 20 };
const bigAddButton = { width: "100%", padding: 14, background: "#ff2f2f", borderRadius: 12, border: "none", color: "white", fontWeight: 700, cursor: "pointer" };
const inputBox = { padding: 10, width: "100%", background: "#050505", borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)", color: "white" };
const sendBtn = { marginTop: 10, padding: 10, background: "#ff2f2f", borderRadius: 10, border: "none", color: "white", fontWeight: 700 };
const errorStyle = { color: "#ff6b6b", marginTop: 6 };
const sectionTitle = { fontSize: 17, fontWeight: 600, marginBottom: 10 };
const row = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.08)" };
const rowLeft = { display: "flex", alignItems: "center", gap: 12 };
const avatarCircle = { width: 40, height: 40, borderRadius: "50%", background: "#000", border: "1px solid rgba(255,255,255,0.15)", display: "flex", justifyContent: "center", alignItems: "center", fontSize: 18, fontWeight: 700, position: "relative" };
const onlineDot = { position: "absolute", right: -2, bottom: -2, width: 10, height: 10, borderRadius: "50%", background: "#1fbf61", border: "2px solid #000" };
const nameText = { fontSize: 15, fontWeight: 600 };
const subText = { fontSize: 13, opacity: 0.6 };
const acceptBtn = { padding: "8px 10px", background: "#1fbf61", color: "white", borderRadius: 10, border: "none" };
const declineBtn = { padding: "8px 10px", background: "#ff2f2f", color: "white", borderRadius: 10, border: "none" };
const msgBtn = { padding: "8px 12px", background: "#ff2f2f", color: "white", borderRadius: 10, textDecoration: "none", fontWeight: 700 };
