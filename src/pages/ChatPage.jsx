// src/pages/ChatPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { FiArrowLeft, FiSend, FiImage } from "react-icons/fi";

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

  const listRef = useRef(null);

  /* ---------------------------------- */
  /* LOAD USER + MESSAGES (ONCE)        */
  /* ---------------------------------- */
  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;

      if (!alive) return;
      setUser(auth.user);

      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${auth.user.id},receiver_id.eq.${friendId}),
           and(sender_id.eq.${friendId},receiver_id.eq.${auth.user.id})`
        )
        .order("created_at", { ascending: true });

      if (alive) {
        setMessages(msgs || []);
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [friendId]);

  /* ---------------------------------- */
  /* REALTIME (SAFE + DEDUPED)          */
  /* ---------------------------------- */
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

          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev;
            return [...prev, m];
          });
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user, friendId]);

  /* ---------------------------------- */
  /* AUTO SCROLL                        */
  /* ---------------------------------- */
  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  /* ---------------------------------- */
  /* SEND TEXT (NO RELOAD)              */
  /* ---------------------------------- */
  async function sendMessage() {
    if (!text.trim() || !user) return;

    const temp = {
      id: `temp-${Date.now()}`,
      sender_id: user.id,
      receiver_id: friendId,
      text: text.trim(),
      created_at: new Date().toISOString(),
      _optimistic: true,
    };

    setMessages((prev) => [...prev, temp]);
    setText("");

    await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: friendId,
      text: temp.text,
    });
  }

  /* ---------------------------------- */
  /* SEND IMAGE                         */
  /* ---------------------------------- */
  async function sendImage(file) {
    if (!file || !user) return;

    const path = `${user.id}-${Date.now()}.${file.name.split(".").pop()}`;

    await supabase.storage.from("chat_images").upload(path, file);
    const { data } = supabase.storage
      .from("chat_images")
      .getPublicUrl(path);

    await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: friendId,
      image_url: data.publicUrl,
    });
  }

  /* ---------------------------------- */
  /* UI                                 */
  /* ---------------------------------- */
  return (
    <>
      {/* HEADER */}
      <div style={headerStyle}>
        <button onClick={() => navigate("/friends")} style={backBtn}>
          <FiArrowLeft size={22} />
        </button>
        <div style={{ fontWeight: 800 }}>Chat</div>
      </div>

      {/* MESSAGES */}
      <div ref={listRef} style={messagesStyle}>
        {loading && (
          <div style={{ opacity: 0.6, textAlign: "center", marginTop: 20 }}>
            Loading…
          </div>
        )}

        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                justifyContent: mine ? "flex-end" : "flex-start",
                marginBottom: 8,
                opacity: m._optimistic ? 0.6 : 1,
              }}
            >
              <div
                style={{
                  maxWidth: "75%",
                  padding: "10px 12px",
                  borderRadius: 16,
                  background: mine ? "#ff2f2f" : "#1a1a1a",
                  color: "#fff",
                  fontSize: 16,
                }}
              >
                {m.text && <div>{m.text}</div>}
                {m.image_url && (
                  <img
                    src={m.image_url}
                    style={{ marginTop: 6, borderRadius: 12, maxHeight: 220 }}
                  />
                )}
                <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4 }}>
                  {formatTime(m.created_at)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* INPUT */}
      <div style={inputBar}>
        <label style={{ cursor: "pointer" }}>
          <FiImage size={22} />
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => sendImage(e.target.files?.[0])}
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
    </>
  );
}

/* ---------------------------------- */
/* STYLES                             */
/* ---------------------------------- */

const headerStyle = {
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
  zIndex: 100,
};

const backBtn = {
  background: "rgba(255,255,255,0.15)",
  border: "none",
  borderRadius: 18,
  width: 36,
  height: 36,
  color: "#fff",
};

const messagesStyle = {
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
  left: 0,
  right: 0,
  bottom: "env(safe-area-inset-bottom)",
  height: 72,
  background: "#000",
  borderTop: "1px solid #222",
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "0 12px",
  zIndex: 100,
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
