// src/pages/ChatPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { FiArrowLeft, FiSend, FiImage } from "react-icons/fi";

function formatTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function ChatPage() {
  const { friendId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");

  const listRef = useRef(null);
  const longPressTimer = useRef(null);

  // ---------- LOAD USER + MESSAGES ----------
  async function loadMessages(uid) {
    setErrMsg("");

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${uid},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${uid})`
      )
      .order("created_at", { ascending: true });

    if (error) {
      console.error("LOAD MESSAGES ERROR:", error);
      setErrMsg(error.message || "Failed to load messages.");
      return; // IMPORTANT: do NOT wipe messages to []
    }

    setMessages(data || []);
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      const u = auth?.user || null;

      if (!alive) return;
      setUser(u);

      if (!u) {
        setErrMsg("Not logged in.");
        setLoading(false);
        return;
      }

      await loadMessages(u.id);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [friendId]);

  // ---------- REALTIME (DEDUPED) ----------
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
            // If we already have the real row, ignore
            if (prev.some((x) => x.id === m.id)) return prev;

            // If we have a temp optimistic message with same text/time-ish, remove it
            const withoutTemps = prev.filter((x) => !(x._temp && x.text && x.text === m.text));

            return [...withoutTemps, m];
          });
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user, friendId]);

  // ---------- AUTO SCROLL ----------
  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // ---------- SEND TEXT (NO DOUBLE) ----------
  async function sendMessage() {
    if (!text.trim() || !user) return;

    const tempId = `temp-${Date.now()}`;
    const tempText = text.trim();

    // add temp message
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        sender_id: user.id,
        receiver_id: friendId,
        text: tempText,
        created_at: new Date().toISOString(),
        _temp: true,
      },
    ]);

    setText("");

    // Insert and RETURN the row so we can replace temp immediately
    const { data: inserted, error } = await supabase
      .from("messages")
      .insert({
        sender_id: user.id,
        receiver_id: friendId,
        text: tempText,
      })
      .select("*")
      .single();

    if (error) {
      console.error("SEND ERROR:", error);
      setErrMsg(error.message || "Failed to send message.");
      // mark temp as failed (don’t delete it)
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, _failed: true } : m))
      );
      return;
    }

    // Replace temp with real row (prevents duplicate)
    setMessages((prev) => {
      const withoutTemp = prev.filter((m) => m.id !== tempId);
      if (withoutTemp.some((m) => m.id === inserted.id)) return withoutTemp;
      return [...withoutTemp, inserted];
    });
  }

  // ---------- SEND IMAGE ----------
  async function sendImage(file) {
    if (!file || !user) return;

    setErrMsg("");

    const ext = file.name.split(".").pop();
    const path = `${user.id}-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage.from("chat_images").upload(path, file);
    if (upErr) {
      console.error("UPLOAD ERROR:", upErr);
      setErrMsg(upErr.message || "Image upload failed.");
      return;
    }

    const { data: urlObj } = supabase.storage.from("chat_images").getPublicUrl(path);
    const imageUrl = urlObj?.publicUrl;

    const { data: inserted, error } = await supabase
      .from("messages")
      .insert({
        sender_id: user.id,
        receiver_id: friendId,
        image_url: imageUrl,
      })
      .select("*")
      .single();

    if (error) {
      console.error("IMAGE INSERT ERROR:", error);
      setErrMsg(error.message || "Failed to send image.");
      return;
    }

    // append real row immediately (no waiting)
    setMessages((prev) => {
      if (prev.some((m) => m.id === inserted.id)) return prev;
      return [...prev, inserted];
    });
  }

  // ---------- DELETE (PRESS & HOLD) ----------
  async function deleteMessage(m) {
    if (!user) return;
    if (m.sender_id !== user.id) return; // only delete your own

    const ok = window.confirm("Delete this message?");
    if (!ok) return;

    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", m.id)
      .eq("sender_id", user.id);

    if (error) {
      console.error("DELETE ERROR:", error);
      setErrMsg(error.message || "Failed to delete.");
      return;
    }

    setMessages((prev) => prev.filter((x) => x.id !== m.id));
  }

  function startHold(m) {
    // mobile long-press
    longPressTimer.current = setTimeout(() => {
      deleteMessage(m);
    }, 450);
  }

  function endHold() {
    clearTimeout(longPressTimer.current);
  }

  // ---------- UI ----------
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
          <div style={{ opacity: 0.65, textAlign: "center", marginTop: 18 }}>
            Loading…
          </div>
        )}

        {!!errMsg && (
          <div
            style={{
              margin: "10px 0 14px",
              padding: 10,
              borderRadius: 12,
              background: "rgba(255,47,47,0.15)",
              border: "1px solid rgba(255,47,47,0.35)",
              color: "#fff",
              fontSize: 13,
            }}
          >
            {errMsg}
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
                opacity: m._temp ? 0.55 : 1,
              }}
            >
              <div
                onTouchStart={() => mine && startHold(m)}
                onTouchEnd={endHold}
                onTouchCancel={endHold}
                onClick={() => mine && deleteMessage(m)} // tap-to-delete fallback
                style={{
                  maxWidth: "75%",
                  padding: "10px 12px",
                  borderRadius: 16,
                  background: mine ? "#ff2f2f" : "#1a1a1a",
                  color: "#fff",
                  fontSize: 16, // prevents iOS zoom
                  userSelect: "none",
                  cursor: mine ? "pointer" : "default",
                  outline: m._failed ? "2px solid rgba(255,255,255,0.35)" : "none",
                }}
                title={mine ? "Tap (or hold) to delete" : ""}
              >
                {m.text && <div>{m.text}</div>}
                {m.image_url && (
                  <img
                    src={m.image_url}
                    style={{ marginTop: 6, borderRadius: 12, maxHeight: 220 }}
                  />
                )}
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>
                  {formatTime(m.created_at)}
                  {m._failed ? "  •  failed" : ""}
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

/* ---------------- STYLES ---------------- */

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
