// src/pages/FriendsPage.jsx
// =================================================================================================
// ARM PAL — FRIENDS PAGE (FIXED VERSION)
// FIX: Friends list refreshes reliably after Unadd / navigation back (no ghost friends)
// - Refresh trigger: location.state?.refresh (when other pages navigate back with state)
// - Also refresh on window focus + visibilitychange (covers iOS/PWA + back navigation cases)
// =================================================================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate, useLocation } from "react-router-dom";
import FriendQRModal from "../components/friends/FriendQRModal";
import { useToast } from "../components/ToastProvider";
import EmptyState from "../components/EmptyState";

export default function FriendsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [user, setUser] = useState(null);

  // QR / Scan modal
  const [showQR, setShowQR] = useState(false);

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
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Pending requests (friend_requests where sender_id = me, status = 'pending')
  const [pendingRequests, setPendingRequests] = useState([]);

  // ✅ Presence realtime channel ref (prevents duplicates)
  const presenceChannelRef = useRef(null);

  // ✅ Refresh signal (when other pages navigate back with state)
  const refreshSignal = location.state?.refresh;

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const current = data?.user || null;
      setUser(current);

      if (current?.id) {
        await loadAllFriends(current.id);
        await loadPendingRequests(current.id);
      }
    })();
  }, [location.key, refreshSignal]); // ✅ FIX: include refreshSignal

  // Load pending friend_requests (sent by me) with receiver profiles
  async function loadPendingRequests(myId) {
    try {
      const { data: rows, error } = await supabase
        .from("friend_requests")
        .select("*")
        .eq("sender_id", myId)
        .eq("status", "pending");
      if (error) {
        setPendingRequests([]);
        return;
      }
      const list = rows || [];
      if (list.length === 0) {
        setPendingRequests([]);
        return;
      }
      const receiverIds = [...new Set(list.map((r) => r.receiver_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, username, handle")
        .in("id", receiverIds);
      const profileMap = {};
      (profiles || []).forEach((p) => (profileMap[p.id] = p));
      setPendingRequests(
        list.map((r) => ({ ...r, receiverProfile: profileMap[r.receiver_id] || null }))
      );
    } catch {
      setPendingRequests([]);
    }
  }

  // Search profiles by handle (for dropdown) — no auto-add; attach relationship status
  useEffect(() => {
    const q = handleInput.trim().replace(/^@/, "");
    if (!q) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    (async () => {
      const { data: authUser } = await supabase.auth.getUser();
      const meId = authUser?.user?.id;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, handle, avatar_url")
        .ilike("handle", `%${q}%`)
        .limit(10);
      if (cancelled) return;
      if (error) {
        setSearching(false);
        setSearchResults([]);
        return;
      }
      const profiles = data || [];
      if (profiles.length === 0 || !meId) {
        setSearching(false);
        setSearchResults(profiles.map((p) => ({ ...p, relationshipStatus: "none" })));
        return;
      }
      const resultIds = profiles.map((p) => p.id).filter(Boolean);
      const friendIds = resultIds.filter((id) => id !== meId);

      const statusByTarget = {};
      friendIds.forEach((id) => (statusByTarget[id] = { relationshipStatus: "none" }));

      const [friendsA, friendsB, requestsOut, requestsIn] = await Promise.all([
        friendIds.length
          ? supabase
              .from("friends")
              .select("user_id, friend_id, status")
              .eq("user_id", meId)
              .in("friend_id", friendIds)
          : { data: [] },
        friendIds.length
          ? supabase
              .from("friends")
              .select("user_id, friend_id, status")
              .eq("friend_id", meId)
              .in("user_id", friendIds)
          : { data: [] },
        friendIds.length
          ? supabase
              .from("friend_requests")
              .select("id, sender_id, receiver_id, status")
              .eq("sender_id", meId)
              .eq("status", "pending")
              .in("receiver_id", friendIds)
          : { data: [] },
        friendIds.length
          ? supabase
              .from("friend_requests")
              .select("id, sender_id, receiver_id, status")
              .eq("receiver_id", meId)
              .eq("status", "pending")
              .in("sender_id", friendIds)
          : { data: [] },
      ]);

      const friendsRows = [...(friendsA.data || []), ...(friendsB.data || [])];
      const requestsRows = [...(requestsOut.data || []), ...(requestsIn.data || [])];

      friendsRows.forEach((row) => {
        const otherId = row.user_id === meId ? row.friend_id : row.user_id;
        if (String(row?.status || "").toLowerCase() === "accepted" && statusByTarget[otherId]) {
          statusByTarget[otherId].relationshipStatus = "friends";
        }
      });

      requestsRows.forEach((req) => {
        const isOutgoing = req.sender_id === meId;
        const targetId = isOutgoing ? req.receiver_id : req.sender_id;
        if (!statusByTarget[targetId]) return;
        if (statusByTarget[targetId].relationshipStatus === "friends") return;
        if (isOutgoing) {
          statusByTarget[targetId].relationshipStatus = "pending_outgoing";
          statusByTarget[targetId].requestId = req.id;
        } else {
          statusByTarget[targetId].relationshipStatus = "pending_incoming";
          statusByTarget[targetId].requestId = req.id;
        }
      });

      const enriched = profiles.map((p) => ({
        ...p,
        relationshipStatus: statusByTarget[p.id]?.relationshipStatus ?? "none",
        requestId: statusByTarget[p.id]?.requestId,
      }));

      if (!cancelled) {
        setSearching(false);
        setSearchResults(enriched);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handleInput]);

  // ✅ Extra reliability: refresh list when user returns to this screen (back nav / iOS PWA)
  useEffect(() => {
    if (!user?.id) return;

    let alive = true;

    const refreshNow = async () => {
      if (!alive) return;
      try {
        await loadAllFriends(user.id);
        await loadPendingRequests(user.id);
      } catch (e) {
        // never crash
      }
    };

    const onFocus = () => refreshNow();
    const onVis = () => {
      if (document.visibilityState === "visible") refreshNow();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [user?.id]);

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
    return Date.now() - new Date(profile.last_seen).getTime() < 90 * 1000;
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
        const msg = "No user found with that handle.";
        setErrorMsg(msg);
        toast.error(msg);
        return;
      }

      if (target.id === user.id) {
        const msg = "You can’t add yourself.";
        setErrorMsg(msg);
        toast.error(msg);
        return;
      }

      const { data: existing } = await supabase
        .from("friends")
        .select("id, status, user_id, friend_id")
        .or(
          `and(user_id.eq.${user.id},friend_id.eq.${target.id}),and(user_id.eq.${target.id},friend_id.eq.${user.id})`
        );

      if (existing?.length > 0) {
        const msg = "Request already exists or you're already friends.";
        setErrorMsg(msg);
        toast.error(msg);
        return;
      }

      const { error: insertErr } = await supabase.from("friends").insert({
        user_id: user.id,
        friend_id: target.id,
        status: "pending",
      });

      if (insertErr) {
        console.error("insert error:", insertErr);
        const msg = "Error sending request.";
        setErrorMsg(msg);
        toast.error(msg);
        return;
      }

      setHandleInput("");
      setShowAddBox(false);
      const successText = "Friend request sent.";
      setSuccessMsg(successText);
      toast.success(successText);
      await loadAllFriends(user.id);
    } catch (err) {
      console.error(err);
      const msg = "Error sending request.";
      setErrorMsg(msg);
      toast.error(msg);
    }
  }

  async function addFriendRequest(profile) {
    if (!user?.id || !profile?.id) return;
    if (profile.id === user.id) {
      const msg = "You can't add yourself.";
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const { error: insertErr } = await supabase.from("friend_requests").insert({
        sender_id: user.id,
        receiver_id: profile.id,
        status: "pending",
      });
      if (insertErr) {
        console.error("friend_requests insert error:", insertErr);
        const msg = "Error sending request.";
        setErrorMsg(msg);
        toast.error(msg);
        return;
      }
      const successText = "Friend request sent.";
      setSuccessMsg(successText);
      toast.success(successText);
      await loadPendingRequests(user.id);
      const { data: newRows } = await supabase
        .from("friend_requests")
        .select("id")
        .eq("sender_id", user.id)
        .eq("receiver_id", profile.id)
        .eq("status", "pending");
      const newId = newRows?.[0]?.id;
      setSearchResults((prev) =>
        prev.map((r) =>
          r.id === profile.id
            ? { ...r, relationshipStatus: "pending_outgoing", requestId: newId }
            : r
        )
      );
    } catch (err) {
      console.error(err);
      const msg = "Error sending request.";
      setErrorMsg(msg);
      toast.error(msg);
    }
  }

  async function withdrawRequest(requestId) {
    if (!user?.id) return;
    try {
      await supabase.from("friend_requests").delete().eq("id", requestId);
      await loadPendingRequests(user.id);
      setSearchResults((prev) =>
        prev.map((r) =>
          r.requestId === requestId
            ? { ...r, relationshipStatus: "none", requestId: undefined }
            : r
        )
      );
    } catch (e) {
      console.error(e);
    }
  }

  async function acceptIncomingFriendRequest(requestId) {
    if (!user?.id) return;
    try {
      const { data: req } = await supabase
        .from("friend_requests")
        .select("sender_id, receiver_id")
        .eq("id", requestId)
        .single();
      if (!req?.sender_id || !req?.receiver_id) return;
      const otherId = req.receiver_id === user.id ? req.sender_id : req.receiver_id;
      await supabase.from("friends").insert({
        user_id: req.sender_id,
        friend_id: req.receiver_id,
        status: "accepted",
      });
      await supabase.from("friend_requests").delete().eq("id", requestId);
      await loadAllFriends(user.id);
      await loadPendingRequests(user.id);
      setSearchResults((prev) =>
        prev.map((r) =>
          r.id === otherId ? { ...r, relationshipStatus: "friends", requestId: undefined } : r
        )
      );
    } catch (e) {
      console.error(e);
    }
  }

  async function declineIncomingFriendRequest(requestId) {
    if (!user?.id) return;
    try {
      const { data: req } = await supabase
        .from("friend_requests")
        .select("sender_id")
        .eq("id", requestId)
        .single();
      const otherId = req?.sender_id;
      await supabase.from("friend_requests").delete().eq("id", requestId);
      await loadAllFriends(user.id);
      await loadPendingRequests(user.id);
      setSearchResults((prev) =>
        prev.map((r) =>
          r.id === otherId ? { ...r, relationshipStatus: "none", requestId: undefined } : r
        )
      );
    } catch (e) {
      console.error(e);
    }
  }

  async function unaddFriendFromSearch(targetUserId) {
    if (!user?.id || !targetUserId) return;
    try {
      await supabase
        .from("friends")
        .delete()
        .or(
          `and(user_id.eq.${user.id},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${user.id})`
        );
      await loadAllFriends(user.id);
      setSearchResults((prev) =>
        prev.map((r) =>
          r.id === targetUserId ? { ...r, relationshipStatus: "none", requestId: undefined } : r
        )
      );
    } catch (e) {
      console.error(e);
    }
  }

  // -------------------------------------------------------------------
  // ACCEPT / DECLINE (friends table — incoming requests section)
  // -------------------------------------------------------------------
  async function acceptRequest(rowId) {
    if (!user?.id) return;
    const { error } = await supabase.from("friends").update({ status: "accepted" }).eq("id", rowId);
    if (!error) toast.success("Friend added");
    await loadAllFriends(user.id);
  }

  async function declineRequest(rowId) {
    if (!user?.id) return;
    await supabase.from("friends").delete().eq("id", rowId);
    toast.success("Request declined");
    await loadAllFriends(user.id);
  }

  // -------------------------------------------------------------------
  // UI
  // -------------------------------------------------------------------
  return (
    <div style={pageWrap}>
      <div style={topHeaderRow}>
  <h1 style={title}>Friends</h1>
  <button
    type="button"
    onClick={() => navigate("/groups")}
    style={qrIconBtn}
  >
    Groups
  </button>
  <button
    type="button"
    aria-label="Open QR"
    onClick={() => setShowQR(true)}
    style={qrIconBtn}
  >
    <span style={{ fontSize: 18, lineHeight: 1 }}>▦</span>
  </button>
</div>

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
          <div style={{ marginTop: 12, position: "relative" }}>
            <p style={smallMuted}>
              Search by <span style={mono}>@handle</span>
            </p>

            <div style={addRow}>
              <input
                type="text"
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value)}
                placeholder="@handle"
                style={inputBox}
              />

              <button
                style={cancelBtn}
                onClick={() => {
                  setShowAddBox(false);
                  setHandleInput("");
                  setSearchResults([]);
                  setErrorMsg("");
                  setSuccessMsg("");
                }}
              >
                Cancel
              </button>
            </div>

            {searching && <p style={smallMuted}>Searching…</p>}
            {searchResults.length > 0 && (
              <div style={searchDropdown}>
                {searchResults.map((p) => {
                  const status = p.relationshipStatus || "none";
                  const isSelf = user?.id && p.id === user.id;
                  return (
                    <div key={p.id} style={searchResultRow}>
                      <div style={rowLeft}>
                        <div style={avatarCircle}>
                          {p.avatar_url ? (
                            <img
                              src={p.avatar_url}
                              alt=""
                              style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
                            />
                          ) : (
                            initialsLetter(p)
                          )}
                        </div>
                        <div>
                          <p style={nameText}>{pickDisplayName(p)}</p>
                          <p style={subText}>@{p.handle || p.username || ""}</p>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                        <button
                          type="button"
                          style={viewProfileBtn}
                          onClick={() => {
                            setShowAddBox(false);
                            navigate(`/friend/${p.id}`);
                          }}
                        >
                          View profile
                        </button>
                        {status === "friends" && !isSelf && (
                          <>
                            <span style={friendsBadge}>Friends</span>
                            <button
                              type="button"
                              style={withdrawBtn}
                              onClick={() => unaddFriendFromSearch(p.id)}
                            >
                              Unadd
                            </button>
                          </>
                        )}
                        {status === "pending_outgoing" && (
                          <>
                            <span style={pendingText}>Pending</span>
                            <button
                              type="button"
                              style={withdrawBtn}
                              onClick={() => withdrawRequest(p.requestId)}
                            >
                              Withdraw
                            </button>
                          </>
                        )}
                        {status === "pending_incoming" && (
                          <>
                            <button
                              type="button"
                              style={acceptBtn}
                              onClick={() => acceptIncomingFriendRequest(p.requestId)}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              style={declineBtn}
                              onClick={() => declineIncomingFriendRequest(p.requestId)}
                            >
                              Decline
                            </button>
                          </>
                        )}
                        {status === "none" && !isSelf && (
                          <button
                            type="button"
                            style={sendBtn}
                            onClick={() => addFriendRequest(p)}
                          >
                            Add friend
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {errorMsg && <p style={errorStyle}>{errorMsg}</p>}
          </div>
        )}

        {!showAddBox && successMsg && <p style={successStyle}>{successMsg}</p>}
      </section>

      {/* PENDING REQUESTS (friend_requests sent by me) */}
      {pendingRequests.length > 0 && (
        <section style={card}>
          <h2 style={sectionTitle}>Pending Requests</h2>
          {pendingRequests.map((req) => {
            const p = req.receiverProfile;
            const name = p ? pickDisplayName(p) : "Unknown";
            return (
              <div key={req.id} style={rowBase}>
                <div style={rowLeft}>
                  <div style={avatarCircle}>
                    {p ? initialsLetter(p) : "?"}
                  </div>
                  <p style={nameText}>{name}</p>
                </div>
                <button
                  type="button"
                  style={withdrawBtn}
                  onClick={() => withdrawRequest(req.id)}
                >
                  Withdraw
                </button>
              </div>
            );
          })}
        </section>
      )}

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
          <EmptyState
            icon="👋"
            message="No friends yet — search and add someone"
            ctaLabel="Search friends"
            ctaOnClick={() => setShowAddBox(true)}
          />
        ) : (
          friends.map((p) => (
            <FriendRow
              key={p.id}
              friend={p}
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
{showQR && (
  <FriendQRModal onClose={() => setShowQR(false)} />
)}

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
      onClick={() => {
        onOpenChat();
      }}
    >
      <div
        style={avatarCircle}
        onClick={(e) => {
          e.stopPropagation();
          onOpenProfile();
        }}
      >
        {friend?.avatar_url ? (
          <img
            src={friend.avatar_url}
            alt={displayName}
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              objectFit: "cover",
            }}
          />
        ) : (
          letter
        )}
        {online && <span style={onlineDot} />}
      </div>

      <div style={{ minWidth: 0 }}>
        <p style={nameText}>{displayName}</p>
        <p style={subText}>{preview}</p>
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
  background: "var(--bg)",
  color: "var(--text)",
};

const topHeaderRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  position: "relative",
};

const qrIconBtn = {
  width: 44,
  height: 44,
  borderRadius: 14,
  border: "1px solid var(--border)",
  background: "var(--card-2)",
  color: "var(--text)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: "0 10px 20px rgba(0,0,0,0.35)",
};

const title = {

  fontSize: 32,
  fontWeight: 800,
  marginBottom: 16,
  letterSpacing: 0.2,
};

const card = {
  background: "var(--card)",
  borderRadius: 18,
  padding: 16,
  border: "1px solid var(--border)",
  marginBottom: 20,
  boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
};

const bigAddButton = {
  width: "100%",
  padding: "14px 16px",
  background: "var(--accent)",
  borderRadius: 14,
  border: "none",
  color: "var(--text)",
  fontSize: 17,
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 12px 28px color-mix(in srgb, var(--accent) 35%, transparent)",
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
  background: "var(--card-2)",
  borderRadius: 12,
  border: "1px solid var(--border)",
  color: "var(--text)",
  outline: "none",
};

const sendBtn = {
  padding: "10px 14px",
  background: "var(--accent)",
  color: "var(--text)",
  borderRadius: 12,
  fontWeight: 800,
  cursor: "pointer",
  border: "none",
};

const cancelBtn = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text)",
  cursor: "pointer",
};

const searchDropdown = {
  marginTop: 8,
  border: "1px solid var(--border)",
  borderRadius: 12,
  background: "var(--card-2)",
  maxHeight: 280,
  overflowY: "auto",
};

const searchResultRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "10px 12px",
  borderBottom: "1px solid var(--border)",
};

const viewProfileBtn = {
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const withdrawBtn = {
  padding: "8px 12px",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--card-2)",
  color: "var(--text)",
  fontSize: 13,
  fontWeight: 700,
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
  borderBottom: "1px solid var(--border)",
};

const rowClickable = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "14px 14px",
  borderRadius: 14,
  background: "color-mix(in srgb, var(--text) 6%, transparent)",
  border: "1px solid var(--border)",
  marginBottom: 12,
  cursor: "pointer",
  touchAction: "pan-y",
  userSelect: "none",
};

const rowUnreadGlow = {
  border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)",
  boxShadow:
    "0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent), 0 10px 30px color-mix(in srgb, var(--accent) 35%, transparent)",
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
  background: "var(--card-2)",
  border: "1px solid var(--border)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
  fontWeight: 900,
  position: "relative",
  flexShrink: 0,
  overflow: "hidden",
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
  color: "var(--text)",
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
  color: "var(--text)",
  borderRadius: 12,
  border: "none",
  fontWeight: 900,
  cursor: "pointer",
};

const declineBtn = {
  padding: "8px 12px",
  background: "var(--accent)",
  color: "var(--text)",
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

const friendsBadge = {
  fontSize: 13,
  color: "#1fbf61",
  fontWeight: 800,
};

const smallMuted = {
  fontSize: 12,
  opacity: 0.7,
};

const mono = {
  fontFamily: "monospace",
};
