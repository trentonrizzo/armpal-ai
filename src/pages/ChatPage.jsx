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

export default function ChatPage() {
  const { friendId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [imageView, setImageView] = useState(null);

  const listRef = useRef(null);
  const holdTimer = useRef(null);

  // Lock background scroll (PWA safe)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = prev;
      document.body.style.touchAction = "";
    };
  }, []);

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

      await loadMessages(u.id);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [friendId]);

  // realtime messages
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

  // auto scroll
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

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

    const { data } = supabase.storage
      .from("chat-images")
      .getPublicUrl(path);

    await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: friendId,
      image_url: data.publicUrl,
    });
  }

  function startHold(m) {
    holdTimer.current = setTimeout(async () => {
      if (m.sender_id !== user.id) return;
      if (!window.confirm("Delete this message?")) return;

      await supabase.from("messages").delete().eq("id", m.id);
      setMessages((prev) => prev.filter((x) => x.id !== m.id));
    }, 500);
  }

  function endHold() {
    clearTimeout(holdTimer.current);
  }

  return (
    <>
      {/* HEADER */}
      <div style={header}>
        <button onClick={() => navigate("/friends")} style={backBtn}>
          <FiArrowLeft size={22} />
        </button>
        <strong>Chat</strong>
      </div>

      {/* MESSAGES */}
      <div ref={listRef} style={messagesBox}>
        {loading && <div style={{ opacity: 0.6 }}>Loading…</div>}
        {error && <div style={errBox}>{error}</div>}

        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
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
                  maxWidth: "75%",
                  fontSize: 16,
                }}
              >
                {m.text && <div>{m.text}</div>}

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

/* STYLES */
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
