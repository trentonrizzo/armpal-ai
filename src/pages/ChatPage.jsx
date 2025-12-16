// src/pages/ChatPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { FiArrowLeft, FiSend, FiImage, FiX } from "react-icons/fi";

function formatTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function timeAgo(ts) {
  if (!ts) return "";
  const then = new Date(ts).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));

  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return `yesterday`;
  return `${diffDay}d ago`;
}

export default function ChatPage() {
  const { friendId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [friend, setFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [imageView, setImageView] = useState(null);

  // 🔥 NEW: workout add loading state
  const [addingWorkoutId, setAddingWorkoutId] = useState(null);

  const listRef = useRef(null);
  const holdTimer = useRef(null);

  // Presence refs (unchanged)
  const idleTimer = useRef(null);
  const heartbeatTimer = useRef(null);
  const isOnlineRef = useRef(false);

  /* -------------------------
     WORKOUT SHARE HELPERS
  ------------------------- */

  function isWorkoutMessage(m) {
    return m?.payload && m.payload.type === "workout_share";
  }

  function getWorkoutSummary(payload) {
    if (!payload) return "";
    const count = payload.exercises?.length || 0;
    return `${count} exercise${count === 1 ? "" : "s"}`;
  }

  async function addWorkoutToMyAccount(payload) {
    if (!user?.id || !payload) return;

    try {
      setAddingWorkoutId(payload._messageId || "pending");

      // 1️⃣ Insert workout
      const { data: workoutRow, error: wErr } = await supabase
        .from("workouts")
        .insert({
          user_id: user.id,
          name: payload.workout?.name || "Shared Workout",
          scheduled_for: null,
          position: 0,
        })
        .select()
        .single();

      if (wErr || !workoutRow) throw wErr;

      // 2️⃣ Insert exercises
      const exercises = payload.exercises || [];
      for (let i = 0; i < exercises.length; i++) {
        const ex = exercises[i];
        await supabase.from("exercises").insert({
          user_id: user.id,
          workout_id: workoutRow.id,
          name: ex.name || "Exercise",
          sets: ex.sets ?? null,
          reps: ex.reps ?? null,
          weight: ex.weight ?? null,
          position: i,
        });
      }
    } catch (e) {
      console.error("Add workout failed:", e);
    } finally {
      setAddingWorkoutId(null);
    }
  }

  /* -------------------------
     LOCK SCROLL (UNCHANGED)
  ------------------------- */
  /* -------------------------
     LOAD FRIEND PROFILE
  ------------------------- */
  async function loadFriendProfile() {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, is_online, last_seen")
      .eq("id", friendId)
      .single();

    if (!error) setFriend(data);
  }

  /* -------------------------
     LOAD MESSAGES
  ------------------------- */
  async function loadMessages(uid) {
    setError("");

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${uid},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${uid})`
      )
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      setError(error.message);
      return;
    }

    setMessages(data || []);
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;

      const u = data?.user;
      setUser(u);

      if (!u) {
        setError("Not logged in");
        setLoading(false);
        return;
      }

      await Promise.all([loadMessages(u.id), loadFriendProfile()]);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [friendId]);

  /* -------------------------
     REALTIME MESSAGES (UNCHANGED)
  ------------------------- */
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`chat-${user.id}-${friendId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new;
          const match =
            (m.sender_id === user.id && m.receiver_id === friendId) ||
            (m.sender_id === friendId && m.receiver_id === user.id);

          if (!match) return;

          setMessages((prev) =>
            prev.some((x) => x.id === m.id) ? prev : [...prev, m]
          );
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user, friendId]);

  /* -------------------------
     AUTO SCROLL
  ------------------------- */
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  /* -------------------------
     MESSAGE SENDERS (UNCHANGED)
  ------------------------- */
  async function sendMessage() {
    if (!text.trim() || !user) return;

    const msg = text.trim();
    setText("");

    const { error } = await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: friendId,
      text: msg,
    });

    if (error) setError(error.message);
  }

  async function sendImage(file) {
    if (!file || !user) return;

    const ext = file.name.split(".").pop();
    const path = `${user.id}-${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("chat-images")
      .upload(path, file);

    if (uploadErr) {
      setError(uploadErr.message);
      return;
    }

    const { data } = supabase.storage.from("chat-images").getPublicUrl(path);

    await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: friendId,
      image_url: data.publicUrl,
    });
  }

  /* -------------------------
     MESSAGE LIST RENDER
  ------------------------- */
  const renderedMessages = messages.map((m) => {
    const mine = m.sender_id === user?.id;
    const isWorkout = isWorkoutMessage(m);

    return (
      <div
        key={m.id}
        style={{
          display: "flex",
          justifyContent: mine ? "flex-end" : "flex-start",
          marginBottom: 8,
        }}
      >
        <div
          onTouchStart={() => mine && startHold(m)}
          onTouchEnd={endHold}
          onTouchCancel={endHold}
          style={{
            background: mine ? "#ff2f2f" : "#1a1a1a",
            color: "#fff",
            padding: "10px 12px",
            borderRadius: 16,
            maxWidth: "80%",
            fontSize: 15,
          }}
        >
          {/* TEXT */}
          {m.text && <div>{m.text}</div>}

          {/* IMAGE */}
          {m.image_url && (
            <img
              src={m.image_url}
              onClick={() => setImageView(m.image_url)}
              style={{
                marginTop: 6,
                borderRadius: 12,
                maxHeight: 220,
                maxWidth: "100%",
                objectFit: "cover",
                cursor: "pointer",
              }}
            />
          )}

          {/* WORKOUT SHARE */}
          {isWorkout && (
            <div
              style={{
                marginTop: 6,
                padding: 10,
                borderRadius: 12,
                background: "rgba(0,0,0,0.35)",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              <strong>{m.payload.workout?.name || "Shared Workout"}</strong>

              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                {getWorkoutSummary(m.payload)}
              </div>

              <button
                disabled={addingWorkoutId === m.id}
                onClick={() =>
                  addWorkoutToMyAccount({
                    ...m.payload,
                    _messageId: m.id,
                  })
                }
                style={{
                  marginTop: 8,
                  width: "100%",
                  padding: 8,
                  borderRadius: 999,
                  border: "none",
                  background: "#1fbf61",
                  color: "#000",
                  fontWeight: 700,
                  opacity: addingWorkoutId === m.id ? 0.6 : 1,
                }}
              >
                {addingWorkoutId === m.id
                  ? "Adding..."
                  : "Add to My Workouts"}
              </button>
            </div>
          )}

          <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>
            {formatTime(m.created_at)}
          </div>
        </div>
      </div>
    );
  });
  /* -------------------------
     PRESENCE LIFECYCLE (UNCHANGED)
  ------------------------- */
  async function setMyPresence(online) {
    if (!user?.id) return;
    if (isOnlineRef.current === online) return;

    isOnlineRef.current = online;

    const payload = {
      is_online: online,
      last_seen: new Date().toISOString(),
    };

    await supabase.from("profiles").update(payload).eq("id", user.id);
  }

  function clearIdleTimer() {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
  }

  function armIdleTimer() {
    clearIdleTimer();
    idleTimer.current = setTimeout(() => {
      setMyPresence(false);
    }, 2 * 60 * 1000);
  }

  function startHeartbeat() {
    if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
    heartbeatTimer.current = setInterval(() => {
      if (!user?.id) return;
      if (document.visibilityState !== "visible") return;
      if (!isOnlineRef.current) return;

      supabase
        .from("profiles")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", user.id);
    }, 30 * 1000);
  }

  function stopHeartbeat() {
    if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
    heartbeatTimer.current = null;
  }

  useEffect(() => {
    if (!user?.id) return;

    setMyPresence(true);
    armIdleTimer();
    startHeartbeat();

    const onVis = () => {
      if (document.visibilityState === "visible") {
        setMyPresence(true);
        armIdleTimer();
      } else {
        setMyPresence(false);
        clearIdleTimer();
      }
    };

    const onActivity = () => {
      if (document.visibilityState !== "visible") return;
      setMyPresence(true);
      armIdleTimer();
    };

    const onBeforeUnload = () => {
      setMyPresence(false);
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("touchstart", onActivity, { passive: true });
    window.addEventListener("mousemove", onActivity);
    window.addEventListener("keydown", onActivity);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("touchstart", onActivity);
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);

      clearIdleTimer();
      stopHeartbeat();
      setMyPresence(false);
    };
  }, [user?.id, friendId]);

  /* -------------------------
     HEADER + STATUS
  ------------------------- */
  const friendName =
    friend?.display_name || friend?.username || "Chat";

  const friendOnline =
    !!friend?.is_online &&
    friend?.last_seen &&
    Date.now() - new Date(friend.last_seen).getTime() <= 60 * 1000;

  const friendStatus = friendOnline
    ? "Online"
    : friend?.last_seen
    ? `Last seen ${timeAgo(friend.last_seen)}`
    : "";

  return (
    <>
      {/* HEADER */}
      <div style={header}>
        <button onClick={() => navigate("/friends")} style={backBtn}>
          <FiArrowLeft size={22} />
        </button>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong>{friendName}</strong>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: friendOnline
                  ? "#2dff57"
                  : "rgba(255,255,255,0.25)",
                boxShadow: friendOnline
                  ? "0 0 8px rgba(45,255,87,0.9)"
                  : "none",
              }}
            />
          </div>

          {!!friendStatus && (
            <div style={{ fontSize: 12, opacity: 0.9 }}>
              {friendStatus}
            </div>
          )}
        </div>
      </div>

      {/* MESSAGES */}
      <div ref={listRef} style={messagesBox}>
        {loading && <div style={{ opacity: 0.6 }}>Loading…</div>}
        {error && <div style={errBox}>{error}</div>}
        {renderedMessages}
      </div>

      {/* INPUT */}
      <div style={inputBar}>
        <label>
          <FiImage size={22} />
          <input
            type="file"
            hidden
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = null;
              sendImage(file);
            }}
          />
        </label>

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message…"
          style={input}
        />

        <button onClick={sendMessage} style={sendBtn}>
          <FiSend size={20} />
        </button>
      </div>

      {/* IMAGE VIEW */}
      {imageView && (
        <div style={imageOverlay} onClick={() => setImageView(null)}>
          <img src={imageView} style={imageFull} />
          <FiX size={28} style={closeIcon} />
        </div>
      )}
    </>
  );
}

/* -------------------------
   STYLES (UNCHANGED)
------------------------- */
const header = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  height: 56,
  background: "#e00000",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "0 12px",
  zIndex: 10,
};

const backBtn = {
  background: "rgba(255,255,255,0.2)",
  border: "none",
  borderRadius: 18,
  width: 36,
  height: 36,
  color: "#fff",
};

const messagesBox = {
  position: "fixed",
  top: 56,
  bottom: 72,
  left: 0,
  right: 0,
  overflowY: "auto",
  overscrollBehavior: "contain",
  padding: 12,
  background: "#000",
};

const inputBar = {
  position: "fixed",
  bottom: "env(safe-area-inset-bottom)",
  left: 0,
  right: 0,
  height: 72,
  background: "#000",
  borderTop: "1px solid #222",
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "0 12px",
};

const input = {
  flex: 1,
  height: 44,
  borderRadius: 12,
  border: "1px solid #333",
  background: "#111",
  color: "#fff",
  padding: "0 12px",
  fontSize: 16,
};

const sendBtn = {
  width: 44,
  height: 44,
  borderRadius: 12,
  background: "#ff2f2f",
  border: "none",
  color: "#fff",
};

const errBox = {
  background: "rgba(255,47,47,0.25)",
  padding: 10,
  borderRadius: 12,
  marginBottom: 10,
};

const imageOverlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.9)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 999,
};

const imageFull = {
  maxWidth: "90%",
  maxHeight: "80%",
  borderRadius: 12,
};

const closeIcon = {
  position: "absolute",
  top: 20,
  right: 20,
  color: "#fff",
};
