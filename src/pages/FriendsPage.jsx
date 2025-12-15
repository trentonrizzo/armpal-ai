// src/pages/FriendsPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";

/**
 * Tap Guard:
 * - If finger/mouse moves more than threshold, treat as scroll/drag -> don't trigger tap actions.
 * - Fixes the "tappable list isn't scrollable" problem on mobile PWAs.
 */
function useTapGuard(thresholdPx = 10) {
  const start = useRef({ x: 0, y: 0, t: 0 });
  const moved = useRef(false);

  function onPointerDown(e) {
    moved.current = false;
    start.current = {
      x: e.clientX ?? 0,
      y: e.clientY ?? 0,
      t: Date.now(),
    };
  }

  function onPointerMove(e) {
    const dx = Math.abs((e.clientX ?? 0) - start.current.x);
    const dy = Math.abs((e.clientY ?? 0) - start.current.y);
    if (dx > thresholdPx || dy > thresholdPx) moved.current = true;
  }

  function isRealTap() {
    // quick tap, not a move/scroll
    if (moved.current) return false;
    // optional: ignore super long presses
    if (Date.now() - start.current.t > 600) return false;
    return true;
  }

  return { onPointerDown, onPointerMove, isRealTap };
}

function clampOneLine(str, max = 48) {
  if (!str) return "";
  const s = String(str).replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

// no months. minutes/hours/days/weeks -> up to 53w -> then years
function timeAgoNoMonths(dateStr) {
  if (!dateStr) return "";
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  if (diff < 0) return "now";

  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  const week = Math.floor(day / 7);
  const year = Math.floor(day / 365);

  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  if (hr < 24) return `${hr}h`;
  if (day < 7) return `${day}d`;
  if (week <= 53) return `${week}w`;
  return `${Math.max(1, year)}y`;
}

function isOnline(lastActive) {
  if (!lastActive) return false;
  return Date.now() - new Date(lastActive).getTime() < 60_000;
}

export default function FriendsPage() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);

  // Data
  const [friends, setFriends] = useState([]); // accepted profiles
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);

  // Messages meta: { [friendId]: { preview, created_at, unread } }
  const [msgMeta, setMsgMeta] = useState({});

  // UI
  const [showAddBox, setShowAddBox] = useState(false);
  const [handleInput, setHandleInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const tap = useTapGuard(10);

  useEffect(() => {
    let alive = true;

    async function load() {
      const { data } = await supabase.auth.getUser();
      const current = data?.user || null;
      if (!alive) return;
      setUser(current);

      if (current?.id) {
        await loadAllFriends(current.id);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  // -------------------------------------------------------------------
  //  LOAD FRIENDS + REQUESTS
  // -------------------------------------------------------------------
  async function loadAllFriends(myId) {
    try {
      setErrorMsg("");
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
        const st = (row.status || "").toLowerCase();
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
        const { data: profData, error: profErr } = await supabase
          .from("profiles")
          .select("id, username, handle, display_name, avatar_url, bio, last_active")
          .in("id", Array.from(profileIds));

        if (profErr) console.error("profiles select error:", profErr);
        else profiles = profData || [];
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

      // After friends are loaded, fetch message previews/unread
      await loadLastMessageMeta(myId, acceptedList.map((p) => p.id));
    } catch (err) {
      console.error("loadAllFriends error:", err);
      setFriends([]);
      setIncoming([]);
      setOutgoing([]);
    }
  }

  // -------------------------------------------------------------------
  //  LAST MESSAGE PREVIEW + UNREAD
  // -------------------------------------------------------------------
  async function loadLastMessageMeta(myId, friendIds) {
    try {
      if (!myId || !friendIds?.length) {
        setMsgMeta({});
        return;
      }

      const meta = {};

      // Small friend lists => simplest + reliable: one latest message query per friend
      for (const fid of friendIds) {
        const { data: lastMsg, error } = await supabase
          .from("messages")
          .select("id, sender_id, receiver_id, body, created_at")
          .or(
            `and(sender_id.eq.${myId},receiver_id.eq.${fid}),and(sender_id.eq.${fid},receiver_id.eq.${myId})`
          )
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("last message error:", fid, error);
          meta[fid] = { preview: "No messages yet", created_at: null, unread: false };
          continue;
        }

        if (!lastMsg) {
          meta[fid] = { preview: "No messages yet", created_at: null, unread: false };
          continue;
        }

        const preview =
          lastMsg.sender_id === myId
            ? `You: ${clampOneLine(lastMsg.body)}`
            : clampOneLine(lastMsg.body);

        // unread if friend sent last message AND there's no read row
        let unread = false;
        if (lastMsg.sender_id !== myId) {
          const { data: readRow, error: readErr } = await supabase
            .from("message_reads")
            .select("id")
            .eq("message_id", lastMsg.id)
            .eq("reader_id", myId)
            .limit(1)
            .maybeSingle();

          if (readErr) {
            // If reads query fails, don't hard-crash the page—just assume read.
            console.error("read check error:", readErr);
            unread = false;
          } else {
            unread = !readRow;
          }
        }

        meta[fid] = {
          preview: preview || "No messages yet",
          created_at: lastMsg.created_at,
          unread,
        };
      }

      setMsgMeta(meta);
    } catch (e) {
      console.error("loadLastMessageMeta fatal:", e);
      // never crash the page for previews
      setMsgMeta({});
    }
  }

  // -------------------------------------------------------------------
  //  SEND FRIEND REQUEST
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
      setSuccessMsg(`Friend request sent to @${target.handle || target.username}.`);
      await loadAllFriends(user.id);
    } catch (err) {
      console.error(err);
      setErrorMsg("Error sending request.");
    }
  }

  // -------------------------------------------------------------------
  //  ACCEPT / DECLINE REQUEST
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
  //  NAV ACTIONS (TAP SAFE)
  // -------------------------------------------------------------------
  function openChat(friendId) {
    navigate(`/chat/${friendId}`);
  }

  function openProfile(friendId) {
    navigate(`/user/${friendId}`);
  }

  const sortedFriends = useMemo(() => {
    // Sort by unread first, then newest message, then name
    const list = [...friends];
    list.sort((a, b) => {
      const ma = msgMeta[a.id];
      const mb = msgMeta[b.id];
      const ua = ma?.unread ? 1 : 0;
      const ub = mb?.unread ? 1 : 0;
      if (ua !== ub) return ub - ua;

      const ta = ma?.created_at ? new Date(ma.created_at).getTime() : 0;
      const tb = mb?.created_at ? new Date(mb.created_at).getTime() : 0;
      if (ta !== tb) return tb - ta;

      const na = (a.display_name || a.handle || a.username || "").toLowerCase();
      const nb = (b.display_name || b.handle || b.username || "").toLowerCase();
      return na.localeCompare(nb);
    });
    return list;
  }, [friends, msgMeta]);

  // -------------------------------------------------------------------
  //  UI
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
            const label = p?.display_name || p?.handle || p?.username || "Unknown";
            const handle = p?.handle || p?.username || "";
            return (
              <div key={req.id} style={reqRow}>
                <div style={rowLeft}>
                  <div style={avatarCircle}>
                    {label.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={nameText}>{label}</p>
                    <p style={subText}>@{handle}</p>
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
            const label = p?.display_name || p?.handle || p?.username || "Unknown";
            const handle = p?.handle || p?.username || "";
            return (
              <div key={req.id} style={reqRow}>
                <div style={rowLeft}>
                  <div style={avatarCircle}>
                    {label.charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <p style={nameText}>{label}</p>
                    <p style={subText}>@{handle}</p>
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

        {sortedFriends.length === 0 ? (
          <p style={smallMuted}>You haven't added anyone yet.</p>
        ) : (
          sortedFriends.map((p) => {
            const label = p.display_name || p.handle || p.username || "Unknown";
            const handle = p.handle || p.username || "";
            const online = isOnline(p.last_active);

            const meta = msgMeta[p.id];
            const preview = meta?.preview || "No messages yet";
            const unread = !!meta?.unread;

            const rightText = online
              ? "Online"
              : p.last_active
              ? timeAgoNoMonths(p.last_active)
              : "Offline";

            return (
              <div
                key={p.id}
                style={{
                  ...friendRow,
                  ...(unread ? unreadRowGlow : {}),
                }}
                onPointerDown={tap.onPointerDown}
                onPointerMove={tap.onPointerMove}
                onClick={() => {
                  if (!tap.isRealTap()) return;
                  openChat(p.id);
                }}
              >
                {/* Avatar (tap -> profile) */}
                <button
                  type="button"
                  style={avatarBtn}
                  onPointerDown={tap.onPointerDown}
                  onPointerMove={tap.onPointerMove}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!tap.isRealTap()) return;
                    openProfile(p.id);
                  }}
                >
                  <div style={avatarCircleLarge}>
                    {label.charAt(0).toUpperCase()}
                    {online && <span style={onlineDot} />}
                  </div>
                </button>

                {/* Name + preview (tap -> profile) */}
                <button
                  type="button"
                  style={nameBtn}
                  onPointerDown={tap.onPointerDown}
                  onPointerMove={tap.onPointerMove}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!tap.isRealTap()) return;
                    openProfile(p.id);
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={friendName}>{label}</span>
                      <span style={friendHandle}>@{handle}</span>
                    </div>

                    {/* 1-line preview */}
                    <div style={previewLineWrap}>
                      <span style={previewLine}>{preview}</span>
                    </div>
                  </div>
                </button>

                {/* Right side status */}
                <div style={rightCol}>
                  <span style={{ ...rightStatus, opacity: online ? 0.9 : 0.55 }}>
                    {rightText}
                  </span>
                  {meta?.created_at ? (
                    <span style={rightTime}>{timeAgoNoMonths(meta.created_at)}</span>
                  ) : (
                    <span style={rightTime}>&nbsp;</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>

      <div style={{ height: 16 }} />
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
  letterSpacing: -0.5,
};

const card = {
  background: "#101010",
  borderRadius: 18,
  padding: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  marginBottom: 20,
  boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
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
  boxShadow: "0 10px 26px rgba(255,47,47,0.18)",
};

const sectionTitle = {
  fontSize: 16,
  fontWeight: 700,
  marginBottom: 12,
  opacity: 0.95,
};

const addRow = {
  display: "flex",
  gap: 8,
  marginTop: 8,
  alignItems: "center",
};

const inputBox = {
  flex: 1,
  padding: "11px 12px",
  background: "#070707",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  color: "white",
  outline: "none",
};

const sendBtn = {
  padding: "11px 14px",
  background: "#ff2f2f",
  color: "white",
  borderRadius: 12,
  fontWeight: 800,
  cursor: "pointer",
  border: "none",
};

const cancelBtn = {
  padding: "11px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "transparent",
  color: "white",
  cursor: "pointer",
};

const errorStyle = {
  color: "#ff6b6b",
  fontSize: 13,
  marginTop: 8,
};

const successStyle = {
  color: "#4ade80",
  fontSize: 13,
  marginTop: 10,
};

const smallMuted = {
  fontSize: 12,
  opacity: 0.7,
};

const mono = {
  fontFamily: "monospace",
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
  fontWeight: 800,
  position: "relative",
};

const reqRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 0",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};

const nameText = {
  fontSize: 15,
  fontWeight: 800,
};

const subText = {
  fontSize: 12,
  opacity: 0.6,
  marginTop: -2,
};

const acceptBtn = {
  padding: "9px 12px",
  background: "#1fbf61",
  color: "white",
  borderRadius: 12,
  border: "none",
  fontWeight: 900,
  cursor: "pointer",
};

const declineBtn = {
  padding: "9px 12px",
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
  opacity: 0.9,
};

/** Friend row (tap opens chat) **/
const friendRow = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "14px 12px",
  borderRadius: 16,
  background: "rgba(0,0,0,0.22)",
  border: "1px solid rgba(255,255,255,0.06)",
  marginBottom: 10,
};

const unreadRowGlow = {
  border: "1px solid rgba(255,47,47,0.45)",
  boxShadow: "0 0 0 2px rgba(255,47,47,0.10), 0 18px 45px rgba(255,47,47,0.10)",
};

const avatarBtn = {
  border: "none",
  background: "transparent",
  padding: 0,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
};

const avatarCircleLarge = {
  width: 48,
  height: 48,
  borderRadius: "50%",
  background: "#000",
  border: "1px solid rgba(255,255,255,0.14)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  fontWeight: 900,
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

const nameBtn = {
  border: "none",
  background: "transparent",
  padding: 0,
  cursor: "pointer",
  textAlign: "left",
  flex: 1,
};

const friendName = {
  fontSize: 16,
  fontWeight: 900,
  letterSpacing: -0.2,
};

const friendHandle = {
  fontSize: 12,
  opacity: 0.5,
  fontWeight: 700,
};

const previewLineWrap = {
  display: "block",
  overflow: "hidden",
};

const previewLine = {
  fontSize: 13,
  opacity: 0.65,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const rightCol = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 2,
  minWidth: 62,
};

const rightStatus = {
  fontSize: 12,
  fontWeight: 800,
};

const rightTime = {
  fontSize: 12,
  opacity: 0.45,
  fontWeight: 700,
};
