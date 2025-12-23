// src/pages/FriendsPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

export default function FriendsPage() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);

  // Data
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);

  // Chat preview / unread
  const [lastByFriend, setLastByFriend] = useState({}); // { friendId: { text, created_at, sender_id, id } }
  const [unreadByFriend, setUnreadByFriend] = useState({}); // { friendId: true/false }

  // UI
  const [showAddBox, setShowAddBox] = useState(false);
  const [handleInput, setHandleInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // ✅ Presence realtime channel ref (prevents duplicates)
  const presenceChannelRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const current = data?.user || null;
      setUser(current);

      if (current?.id) {
        await loadAllFriends(current.id);
      }
    })();
  }, []);

  // ✅ Realtime presence subscription once user + friends exist
  useEffect(() => {
    if (!user?.id) return;

    // clean any previous channel
    if (presenceChannelRef.current) {
      supabase.removeChannel(presenceChannelRef.current);
      presenceChannelRef.current = null;
    }

    const ch = supabase
      .channel(`friends-presence-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload) => {
          const updated = payload.new;
          if (!updated?.id) return;

          // Update accepted friends presence in-place
          setFriends((prev) =>
            prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
          );

          // Update incoming/outgoing request profile presence too (nice + free)
          setIncoming((prev) =>
            prev.map((row) => {
              if (row?.profile?.id === updated.id) {
                return { ...row, profile: { ...row.profile, ...updated } };
              }
              return row;
            })
          );

          setOutgoing((prev) =>
            prev.map((row) => {
              if (row?.profile?.id === updated.id) {
                return { ...row, profile: { ...row.profile, ...updated } };
              }
              return row;
            })
          );
        }
      )
      .subscribe();

    presenceChannelRef.current = ch;

    return () => {
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
    };
  }, [user?.id]);

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------
  function pickDisplayName(p) {
    return p?.display_name || p?.username || p?.handle || "Unknown";
  }

  function initialsLetter(p) {
    const name = pickDisplayName(p);
    return (name || "?").trim().charAt(0).toUpperCase();
  }

  // ✅ ONLINE if:
  // - is_online true
  // - last_seen is fresh (within 60s)
  function isOnline(profile) {
  if (!profile?.last_seen) return false;
  return Date.now() - new Date(profile.last_seen).getTime() < 60 * 1000;
}

  function formatAgoNoMonths(ts) {
    if (!ts) return "";
    const ms = Date.now() - new Date(ts).getTime();
    if (ms < 0) return "";

    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}s`;

    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;

    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;

    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d`;

    const wk = Math.floor(day / 7);
    if (wk <= 53) return `${wk}w`;

    const yr = Math.floor(day / 365);
    return `${yr}y`;
  }

  function oneLinePreview(str) {
    if (!str) return "No messages yet";
    const cleaned = String(str).replace(/\s+/g, " ").trim();
    return cleaned.length > 60 ? cleaned.slice(0, 60) + "…" : cleaned;
  }

  // -------------------------------------------------------------------
  // LOAD EVERYTHING (friends + profiles) — stable
  // -------------------------------------------------------------------
  async function loadAllFriends(myId) {
    try {
      setErrorMsg("");
      setSuccessMsg("");

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
        const st = (row?.status || "").toLowerCase();

        if (st === "accepted") {
          const otherId = row.user_id === myId ? row.friend_id : row.user_id;
          acceptedIds.add(otherId);
        } else if (st === "pending") {
          if (row.friend_id === myId) incomingRows.push(row);
          else if (row.user_id === myId) outgoingRows.push(row);
        }
      });

      const profileIds = new Set();
      acceptedIds.forEach((id) => profileIds.add(id));
      incomingRows.forEach((row) => profileIds.add(row.user_id));
      outgoingRows.forEach((row) => profileIds.add(row.friend_id));

      let profiles = [];
      if (profileIds.size > 0) {
        // ✅ CHANGED: last_active -> is_online, last_seen
        const { data: profData, error: profErr } = await supabase
          .from("profiles")
          .select(
            "id, username, handle, display_name, avatar_url, bio, is_online, last_seen"
          )
          .in("id", Array.from(profileIds));

        if (profErr) console.error("profiles select error:", profErr);
        profiles = profData || [];
      }

      const profileMap = {};
      profiles.forEach((p) => (profileMap[p.id] = p));

      const acceptedList = Array.from(acceptedIds)
        .map((id) => profileMap[id])
        .filter(Boolean);

      setFriends(acceptedList);

      setIncoming(
        incomingRows.map((row) => ({
          ...row,
          profile: profileMap[row.user_id] || null,
        }))
      );

      setOutgoing(
        outgoingRows.map((row) => ({
          ...row,
          profile: profileMap[row.friend_id] || null,
        }))
      );

      // Best-effort: load last message previews + unread, NEVER crash if schema differs
      await loadLastMessagesAndUnread(myId, acceptedList.map((p) => p.id));
    } catch (err) {
      console.error("loadAllFriends error:", err);
      setFriends([]);
      setIncoming([]);
      setOutgoing([]);
    }
  }

  // -------------------------------------------------------------------
  // BEST-EFFORT last message + unread (won’t break if your columns differ)
  // -------------------------------------------------------------------
  async function loadLastMessagesAndUnread(myId, friendIds) {
    if (!myId || !friendIds?.length) {
      setLastByFriend({});
      setUnreadByFriend({});
      return;
    }

    const lastMap = {};
    const unreadMap = {};

    // We do per-friend queries to stay compatible with unknown schema.
    // If your messages table columns are different, these calls just fail silently.
    for (const fid of friendIds) {
      try {
        const { data: lastMsg, error: msgErr } = await supabase
          .from("messages")
          .select("*")
          .or(
            `and(sender_id.eq.${myId},receiver_id.eq.${fid}),and(sender_id.eq.${fid},receiver_id.eq.${myId})`
          )
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!msgErr && lastMsg) {
          const text =
            lastMsg.text ??
            lastMsg.content ??
            lastMsg.message ??
            lastMsg.body ??
            "";

          lastMap[fid] = {
            id: lastMsg.id,
            text,
            created_at: lastMsg.created_at,
            sender_id: lastMsg.sender_id,
          };

          // unread if last message from friend and no read record
          if (lastMsg.sender_id && lastMsg.sender_id !== myId) {
            const { data: readRow, error: readErr } = await supabase
              .from("message_reads")
              .select("id")
              .eq("user_id", myId)
              .eq("message_id", lastMsg.id)
              .maybeSingle();

            unreadMap[fid] = !readErr && !readRow;
          } else {
            unreadMap[fid] = false;
          }
        } else {
          unreadMap[fid] = false;
        }
      } catch (e) {
        // If schema mismatch -> ignore.
        unreadMap[fid] = false;
      }
    }

    setLastByFriend(lastMap);
    setUnreadByFriend(unreadMap);
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

      if (raw.startsWith("@")) raw = raw.slice(1);

      const { data: target, error } = await supabase
        .from("profiles")
        .select("id, handle, username, display_name")
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

      const { data: existing } = await supabase
        .from("friends")
        .select("id, status, user_id, friend_id")
        .or(
          `and(user_id.eq.${user.id},friend_id.eq.${target.id}),and(user_id.eq.${target.id},friend_id.eq.${user.id})`
        );

      if (existing?.length > 0) {
        setErrorMsg("Request already exists or you're already friends.");
        return;
      }

      const { error: insertErr } = await supabase.from("friends").insert({
        user_id: user.id,
        friend_id: target.id,
        status: "pending",
      });

      if (insertErr) {
        console.error("insert error:", insertErr);
        setErrorMsg("Error sending request.");
        return;
      }

      setHandleInput("");
      setShowAddBox(false);
      setSuccessMsg(`Friend request sent.`);
      await loadAllFriends(user.id);
    } catch (err) {
      console.error(err);
      setErrorMsg("Error sending request.");
    }
  }

  // -------------------------------------------------------------------
  // ACCEPT / DECLINE
  // -------------------------------------------------------------------
  async function acceptRequest(rowId) {
    if (!user?.id) return;
    await supabase.from("friends").update({ status: "accepted" }).eq("id", rowId);
    await loadAllFriends(user.id);
  }

  async function declineRequest(rowId) {
    if (!user?.id) return;
    await supabase.from("friends").delete().eq("id", rowId);
    await loadAllFriends(user.id);
  }

  // -------------------------------------------------------------------
  // Scroll-safe tap handling (tap != scroll)
  // -------------------------------------------------------------------
  function useTapGuard() {
    const startRef = useRef({ x: 0, y: 0, t: 0, moved: false });

    const onTouchStart = (e) => {
      const touch = e.touches?.[0];
      if (!touch) return;
      startRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        t: Date.now(),
        moved: false,
      };
    };

    const onTouchMove = (e) => {
      const touch = e.touches?.[0];
      if (!touch) return;
      const dx = Math.abs(touch.clientX - startRef.current.x);
      const dy = Math.abs(touch.clientY - startRef.current.y);
      if (dx > 10 || dy > 10) startRef.current.moved = true;
    };

    const isTap = () => {
      const { moved } = startRef.current;
      return !moved;
    };

    return { onTouchStart, onTouchMove, isTap };
  }

  // -------------------------------------------------------------------
  // UI
  // -------------------------------------------------------------------
  return (
    <div style={pageWrap}>
      <h1 style={title}>Friends</h1>

      {/* ADD FRIEND */}
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

        {!showAddBox && successMsg && <p style={successStyle}>{successMsg}</p>}
      </section>
      {/* INCOMING REQUESTS */}
      {incoming.length > 0 && (
        <section style={card}>
          <h2 style={sectionTitle}>Friend Requests</h2>

          {incoming.map((req) => {
            const p = req.profile;
            const online = isOnline(p);
            const lastAgo = formatAgoNoMonths(p?.last_seen);
            const status = online
              ? "Online"
              : p?.last_seen
              ? `Last seen ${lastAgo} ago`
              : "Offline";

            return (
              <div key={req.id} style={rowBase}>
                <div style={rowLeft}>
                  <div style={avatarCircle}>
                    {initialsLetter(p)}
                    {online && <span style={onlineDot} />}
                  </div>
                  <div>
                    <p style={nameText}>{pickDisplayName(p)}</p>
                    <p style={subText}>Wants to add you · {status}</p>
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

      {/* OUTGOING REQUESTS */}
      {outgoing.length > 0 && (
        <section style={card}>
          <h2 style={sectionTitle}>Sent Requests</h2>

          {outgoing.map((req) => {
            const p = req.profile;
            const online = isOnline(p);
            const lastAgo = formatAgoNoMonths(p?.last_seen);
            const status = online
              ? "Online"
              : p?.last_seen
              ? `Last seen ${lastAgo} ago`
              : "Offline";

            return (
              <div key={req.id} style={rowBase}>
                <div style={rowLeft}>
                  <div style={avatarCircle}>
                    {initialsLetter(p)}
                    {online && <span style={onlineDot} />}
                  </div>
                  <div>
                    <p style={nameText}>{pickDisplayName(p)}</p>
                    <p style={subText}>Pending · {status}</p>
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
          friends.map((p) => (
            <FriendRow
              key={p.id}
              meId={user?.id}
              friend={p}
              // ✅ CHANGED: use is_online + last_seen
              online={isOnline(p)}
              lastActiveAgo={formatAgoNoMonths(p?.last_seen)}
              preview={oneLinePreview(lastByFriend[p.id]?.text)}
              unread={!!unreadByFriend[p.id]}
              onOpenChat={() => navigate(`/chat/${p.id}`)}
              onOpenProfile={() => navigate(`/friend/${p.id}`)}
            />
          ))
        )}
      </section>
    </div>
  );
}
function FriendRow({
  friend,
  online,
  lastActiveAgo,
  preview,
  unread,
  onOpenChat,
  onOpenProfile,
}) {
  const { onTouchStart, onTouchMove, isTap } = (function useTapGuardLocal() {
    const startRef = useRef({ x: 0, y: 0, moved: false });

    const onTouchStart = (e) => {
      const touch = e.touches?.[0];
      if (!touch) return;
      startRef.current = { x: touch.clientX, y: touch.clientY, moved: false };
    };

    const onTouchMove = (e) => {
      const touch = e.touches?.[0];
      if (!touch) return;
      const dx = Math.abs(touch.clientX - startRef.current.x);
      const dy = Math.abs(touch.clientY - startRef.current.y);
      if (dx > 10 || dy > 10) startRef.current.moved = true;
    };

    const isTap = () => !startRef.current.moved;
    return { onTouchStart, onTouchMove, isTap };
  })();

  const displayName =
    friend?.display_name || friend?.username || friend?.handle || "Unknown";
  const letter = (displayName || "?").trim().charAt(0).toUpperCase();

  const rightText = online
    ? "Online"
    : `Last seen${lastActiveAgo ? ` · ${lastActiveAgo} ago` : ""}`;

  const rowStyle = {
    ...rowClickable,
    ...(unread ? rowUnreadGlow : null),
  };

  return (
    <div
      style={rowStyle}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onClick={() => {
        // tap row opens chat
        if (isTap()) onOpenChat();
      }}
    >
      <div style={rowLeft}>
        {/* Avatar opens profile */}
        <div
          style={avatarCircle}
          onClick={(e) => {
            e.stopPropagation();
            onOpenProfile();
          }}
        >
          {letter}
          {online && <span style={onlineDot} />}
        </div>

        {/* Name opens profile (NOT blue, not link) */}
        <div
          style={{ minWidth: 0 }}
          onClick={(e) => {
            e.stopPropagation();
            onOpenProfile();
          }}
        >
          <p style={nameText}>{displayName}</p>
          <p style={subText}>{preview}</p>
        </div>
      </div>

      <div style={rightWrap}>
        <span style={statusText}>{rightText}</span>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------
//  STYLES
// -----------------------------------------------------------------------
const pageWrap = {
  padding: "16px 16px 90px",
  maxWidth: 900,
  margin: "0 auto",
  color: "white",
};

const title = {
  fontSize: 32,
  fontWeight: 800,
  marginBottom: 16,
  letterSpacing: 0.2,
};

const card = {
  background: "#101010",
  borderRadius: 18,
  padding: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  marginBottom: 20,
  boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
};

const bigAddButton = {
  width: "100%",
  padding: "14px 16px",
  background: "#ff2f2f",
  borderRadius: 14,
  border: "none",
  color: "white",
  fontSize: 17,
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 12px 28px rgba(255,47,47,0.14)",
};

const sectionTitle = {
  fontSize: 17,
  fontWeight: 700,
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
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  color: "white",
  outline: "none",
};

const sendBtn = {
  padding: "10px 14px",
  background: "#ff2f2f",
  color: "white",
  borderRadius: 12,
  fontWeight: 800,
  cursor: "pointer",
  border: "none",
};

const cancelBtn = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.25)",
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

const rowBase = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 0",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};

const rowClickable = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "14px 14px",
  borderRadius: 14,
  background: "rgba(0,0,0,0.35)",
  border: "1px solid rgba(255,255,255,0.07)",
  marginBottom: 12,
  cursor: "pointer",
  touchAction: "pan-y", // IMPORTANT: scroll still works
  userSelect: "none",
};

const rowUnreadGlow = {
  border: "1px solid rgba(255,47,47,0.35)",
  boxShadow:
    "0 0 0 1px rgba(255,47,47,0.18), 0 10px 30px rgba(255,47,47,0.10)",
};

const rowLeft = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  minWidth: 0,
  flex: 1,
};

const rightWrap = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  minWidth: 110,
};

const avatarCircle = {
  width: 44,
  height: 44,
  borderRadius: "50%",
  background: "#000",
  border: "1px solid rgba(255,255,255,0.14)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  fontWeight: 900,
  position: "relative",
  flexShrink: 0,
};

const onlineDot = {
  position: "absolute",
  right: -1,
  bottom: -1,
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: "#1fbf61",
  border: "2px solid #000",
  boxShadow: "0 0 10px rgba(31,191,97,0.45)",
};
const nameText = {
  fontSize: 16,
  fontWeight: 800,
  color: "white",
  margin: 0,
  lineHeight: "18px",
};

const subText = {
  fontSize: 12,
  opacity: 0.7,
  margin: "6px 0 0 0",
  lineHeight: "14px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: "100%",
};

const statusText = {
  fontSize: 12,
  opacity: 0.6,
  fontWeight: 700,
};

const acceptBtn = {
  padding: "8px 12px",
  background: "#1fbf61",
  color: "white",
  borderRadius: 12,
  border: "none",
  fontWeight: 900,
  cursor: "pointer",
};

const declineBtn = {
  padding: "8px 12px",
  background: "#ff4444",
  color: "white",
  borderRadius: 12,
  border: "none",
  fontWeight: 900,
  cursor: "pointer",
};

const pendingText = {
  fontSize: 13,
  color: "#ffc857",
  fontWeight: 800,
};

const smallMuted = {
  fontSize: 12,
  opacity: 0.7,
};

const mono = {
  fontFamily: "monospace",
};