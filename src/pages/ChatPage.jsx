// src/pages/ChatPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { FiArrowLeft, FiSend, FiImage, FiX } from "react-icons/fi";

/* ---------------- HELPERS ---------------- */

function formatTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function timeAgo(ts) {
  if (!ts) return "";
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ---------------- WORKOUT RENDER ---------------- */

function WorkoutMessage({ payload }) {
  if (!payload?.workout) return null;

  const { workout, exercises = [] } = payload;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <strong style={{ fontSize: 16 }}>{workout.name}</strong>

      {exercises.map((ex, i) => (
        <div
          key={i}
          style={{
            fontSize: 14,
            opacity: 0.95,
            paddingLeft: 6,
          }}
        >
          • {ex.name}
          {ex.sets ? ` — ${ex.sets}×${ex.reps ?? "?"}` : ""}
          {ex.weight ? ` @ ${ex.weight}` : ""}
        </div>
      ))}
    </div>
  );
}

/* ---------------- MAIN ---------------- */

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

  const listRef = useRef(null);
  const holdTimer = useRef(null);

  /* -------- LOAD -------- */

  async function loadFriend() {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, is_online, last_seen")
      .eq("id", friendId)
      .single();
    setFriend(data);
  }

  async function loadMessages(uid) {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${uid},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${uid})`
      )
      .order("created_at");

    if (error) setError(error.message);
    setMessages(data || []);
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user;
      setUser(u);
      if (!u) return;
      await Promise.all([loadMessages(u.id), loadFriend()]);
      setLoading(false);
    })();
  }, [friendId]);

  /* -------- REALTIME -------- */

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`chat-${user.id}-${friendId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new;
          const valid =
            (m.sender_id === user.id && m.receiver_id === friendId) ||
            (m.sender_id === friendId && m.receiver_id === user.id);
          if (!valid) return;
          setMessages((prev) =>
            prev.some((x) => x.id === m.id) ? prev : [...prev, m]
          );
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user, friendId]);

  useEffect(() => {
    if (listRef.current)
      listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  /* -------- SEND -------- */

  async function sendMessage() {
    if (!text.trim() || !user) return;
    await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: friendId,
      text: text.trim(),
    });
    setText("");
  }

  /* -------- HOLD DELETE -------- */

  function startHold(m) {
    holdTimer.current = setTimeout(async () => {
      if (m.sender_id !== user.id) return;
      if (!window.confirm("Delete message?")) return;
      await supabase.from("messages").delete().eq("id", m.id);
      setMessages((prev) => prev.filter((x) => x.id !== m.id));
    }, 500);
  }

  function endHold() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }

  /* -------- RENDER -------- */

  return (
    <>
      {/* HEADER */}
      <div style={header}>
        <button onClick={() => navigate("/friends")} style={backBtn}>
          <FiArrowLeft size={22} />
        </button>
        <div>
          <strong>
            {friend?.display_name || friend?.username || "Chat"}
          </strong>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {friend?.is_online
              ? "Online"
              : friend?.last_seen
              ? `Last seen ${timeAgo(friend.last_seen)}`
              : ""}
          </div>
        </div>
      </div>

      {/* MESSAGES */}
      <div ref={listRef} style={messagesBox}>
        {loading && <div>Loading…</div>}
        {error && <div style={errBox}>{error}</div>}

        {messages.map((m) => {
          const mine = m.sender_id === user?.id;

          let workoutPayload = null;
          if (m.text?.startsWith("{")) {
            try {
              const parsed = JSON.parse(m.text);
              if (parsed.type === "workout_share") {
                workoutPayload = parsed.payload;
              }
            } catch {}
          }

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
                  padding: 12,
                  borderRadius: 16,
                  maxWidth: "80%",
                }}
              >
                {workoutPayload ? (
                  <WorkoutMessage payload={workoutPayload} />
                ) : (
                  m.text && <div>{m.text}</div>
                )}

                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>
                  {formatTime(m.created_at)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* INPUT */}
      <div style={inputBar}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message…"
          style={input}
        />
        <button onClick={sendMessage} style={sendBtn}>
          <FiSend />
        </button>
      </div>
    </>
  );
}

/* ---------------- STYLES ---------------- */

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
  gap: 12,
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
  padding: 12,
  background: "#000",
};

const inputBar = {
  position: "fixed",
  bottom: 0,
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
};
