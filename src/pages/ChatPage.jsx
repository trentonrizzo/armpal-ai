// src/pages/ChatPage.jsx
import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiSend, FiImage, FiMic, FiX } from "react-icons/fi";

// Format timestamp as HH:MM
function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatPage() {
  const { friendId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [friend, setFriend] = useState(null);

  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);

  const [messageInput, setMessageInput] = useState("");
  const [imagePreview, setImagePreview] = useState(null);

  const [online, setOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);
  const [friendTyping, setFriendTyping] = useState(false);

  const [recording, setRecording] = useState(false);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);

  const typingTimeout = useRef(null);
  const bottomRef = useRef(null);

  // -------------------------------------------------------
  // Load current user + friend profile, then get conversation
  // -------------------------------------------------------
  useEffect(() => {
    async function init() {
      const { data: userData } = await supabase.auth.getUser();
      const authUser = userData?.user || null;
      setUser(authUser);

      if (!authUser) return;

      const { data: friendProf } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", friendId)
        .single();

      setFriend(friendProf);

      const convoId = await getOrCreateConversation(authUser.id, friendId);
      setConversationId(convoId);
    }

    init();
  }, [friendId]);

  // Find or create 1-1 conversation row
  async function getOrCreateConversation(myId, otherId) {
    // Try existing convo both directions
    const { data: existing, error } = await supabase
      .from("conversations")
      .select("id")
      .or(
        `and(user1_id.eq.${myId},user2_id.eq.${otherId}),and(user1_id.eq.${otherId},user2_id.eq.${myId})`
      )
      .maybeSingle();

    if (!error && existing?.id) return existing.id;

    // Create new conversation
    const { data: created, error: insertErr } = await supabase
      .from("conversations")
      .insert({
        user1_id: myId,
        user2_id: otherId,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("create conversation error:", insertErr);
      return null;
    }

    return created.id;
  }

  // -------------------------------------------------------
  // Load messages + realtime subscription
  // -------------------------------------------------------
  useEffect(() => {
    if (!user || !conversationId) return;

    async function loadMessages() {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("load messages error:", error);
        setMessages([]);
        return;
      }

      setMessages(data || []);
      scrollToBottom();
    }

    loadMessages();

    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => loadMessages()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, conversationId]);

  function scrollToBottom() {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }

  // -------------------------------------------------------
  // Send TEXT message
  // -------------------------------------------------------
  async function sendMessage() {
    if (!user || !conversationId) return;
    const text = messageInput.trim();
    if (!text) return;

    setMessageInput("");

    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      receiver_id: friendId,
      text,
    });

    if (error) console.error("send message error:", error);

    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);
  }

  // -------------------------------------------------------
  // Send IMAGE message
  // -------------------------------------------------------
  async function sendImage(file) {
    if (!user || !conversationId || !file) return;

    const ext = file.name.split(".").pop();
    const path = `${user.id}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("chat_images")
      .upload(path, file);

    if (error) {
      console.error("image upload error:", error);
      return;
    }

    const { data: urlObj } = supabase.storage
      .from("chat_images")
      .getPublicUrl(path);

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      receiver_id: friendId,
      image_url: urlObj.publicUrl,
    });

    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);
  }

  // -------------------------------------------------------
  // Voice messages
  // -------------------------------------------------------
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorder.current = recorder;

      recorder.ondataavailable = (e) => audioChunks.current.push(e.data);

      recorder.onstop = async () => {
        if (!user || !conversationId) return;

        const blob = new Blob(audioChunks.current, { type: "audio/webm" });
        const file = new File([blob], `audio-${Date.now()}.webm`);
        const path = `${user.id}-${Date.now()}.webm`;

        const { error } = await supabase.storage
          .from("chat_audio")
          .upload(path, file);

        if (error) {
          console.error("audio upload error:", error);
          return;
        }

        const { data: urlObj } = supabase.storage
          .from("chat_audio")
          .getPublicUrl(path);

        await supabase.from("messages").insert({
          conversation_id: conversationId,
          sender_id: user.id,
          receiver_id: friendId,
          audio_url: urlObj.publicUrl,
        });

        await supabase
          .from("conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", conversationId);
      };

      recorder.start();
      setRecording(true);
    } catch (err) {
      console.error("recording error:", err);
    }
  }

  function stopRecording() {
    if (!mediaRecorder.current) return;
    mediaRecorder.current.stop();
    setRecording(false);
  }

  // -------------------------------------------------------
  // Typing indicator (simple broadcast channel)
  // -------------------------------------------------------
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("typing")
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload.from === friendId) {
          setFriendTyping(true);
          clearTimeout(typingTimeout.current);
          typingTimeout.current = setTimeout(
            () => setFriendTyping(false),
            1500
          );
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user, friendId]);

  function sendTyping() {
    if (!user) return;
    supabase.channel("typing").send({
      type: "broadcast",
      event: "typing",
      payload: { from: user.id },
    });
  }

  // -------------------------------------------------------
  // Online / last seen (poll profiles.last_active)
  // -------------------------------------------------------
  useEffect(() => {
    if (!friendId) return;

    const interval = setInterval(async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("last_active")
        .eq("id", friendId)
        .single();

      if (error || !data?.last_active) return;

      const last = new Date(data.last_active);
      const diff = Date.now() - last.getTime();

      if (diff < 60_000) {
        setOnline(true);
        setLastSeen(null);
      } else {
        setOnline(false);
        setLastSeen(
          last.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        );
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [friendId]);

  const friendLabel =
    friend?.display_name || friend?.username || friend?.handle || "User";

  // -------------------------------------------------------
  // UI
  // -------------------------------------------------------
  return (
    <div className="flex flex-col h-screen bg-black text-white">
      {/* HEADER */}
      <div className="flex items-center gap-3 p-4 bg-black border-b border-white/10 sticky top-0 z-20">
        <button onClick={() => navigate("/friends")}>
          <FiArrowLeft size={24} />
        </button>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-lg">{friendLabel}</span>

            {online ? (
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
            ) : (
              lastSeen && (
                <span className="text-xs opacity-70">
                  Last seen {lastSeen}
                </span>
              )
            )}
          </div>

          {friendTyping && (
            <span className="text-xs text-white/60">typing…</span>
          )}
        </div>
      </div>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          const initial = friendLabel.charAt(0).toUpperCase();

          return (
            <div
              key={m.id}
              className={`flex items-end gap-2 ${
                mine ? "justify-end" : "justify-start"
              }`}
            >
              {/* Avatar on left for friend, right for you */}
              {!mine && (
                <div className="w-8 h-8 rounded-full border border-red-500 flex items-center justify-center text-xs font-bold bg-black/80">
                  {initial}
                </div>
              )}

              <div
                className={`max-w-[75%] p-3 rounded-2xl ${
                  mine ? "bg-[#ff2f2f]" : "bg-[#1a1a1a]"
                }`}
              >
                {m.text && <p className="text-sm">{m.text}</p>}

                {m.image_url && (
                  <img
                    src={m.image_url}
                    className="rounded-xl mt-2 max-h-60"
                    onClick={() => setImagePreview(m.image_url)}
                    alt=""
                  />
                )}

                {m.audio_url && (
                  <audio controls src={m.audio_url} className="mt-2 w-full" />
                )}

                <p className="text-[10px] opacity-60 mt-1 text-right">
                  {formatTime(m.created_at)}
                </p>
              </div>

              {mine && (
                <div className="w-8 h-8 rounded-full border border-red-500 flex items-center justify-center text-xs font-bold bg-black/80">
                  {user?.email?.[0]?.toUpperCase() || "Y"}
                </div>
              )}
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* IMAGE PREVIEW OVERLAY */}
      {imagePreview && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <img
            src={imagePreview}
            className="max-w-[90%] max-h-[80%] rounded-xl"
            alt=""
          />
          <button
            onClick={() => setImagePreview(null)}
            className="absolute top-6 right-6 bg-white/10 p-3 rounded-full"
          >
            <FiX size={24} />
          </button>
        </div>
      )}

      {/* INPUT BAR */}
      <div className="p-3 flex items-center gap-3 border-t border-white/10 bg-black">
        {/* IMAGE */}
        <label className="cursor-pointer">
          <FiImage size={24} className="opacity-70" />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => sendImage(e.target.files?.[0])}
          />
        </label>

        {/* MIC */}
        {!recording ? (
          <button onClick={startRecording}>
            <FiMic size={24} className="opacity-70" />
          </button>
        ) : (
          <button onClick={stopRecording} className="text-red-400">
            <FiMic size={24} />
          </button>
        )}

        {/* TEXT INPUT */}
        <input
          className="flex-1 bg-white/10 rounded-xl p-2 text-sm outline-none"
          placeholder="Message…"
          value={messageInput}
          onChange={(e) => {
            setMessageInput(e.target.value);
            sendTyping();
          }}
        />

        {/* SEND */}
        <button onClick={sendMessage}>
          <FiSend size={24} className="opacity-80" />
        </button>
      </div>
    </div>
  );
}
