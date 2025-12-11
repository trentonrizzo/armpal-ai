// src/pages/ChatPage.jsx
import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import { useParams, useNavigate } from "react-router-dom";

import { FiArrowLeft, FiSend, FiImage, FiMic, FiX } from "react-icons/fi";

// Format timestamp
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
  const [messages, setMessages] = useState([]);

  const [messageInput, setMessageInput] = useState("");
  const [imagePreview, setImagePreview] = useState(null);

  const [online, setOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);

  const [friendTyping, setFriendTyping] = useState(false);
  const typingTimeout = useRef(null);

  const bottomRef = useRef(null);

  // Recording
  const [recording, setRecording] = useState(false);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);

  // ------------------------------------------
  // Load user + friend
  // ------------------------------------------
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user ?? null);

      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", friendId)
        .single();

      setFriend(prof);
    })();
  }, [friendId]);

  // ------------------------------------------
  // Load messages + realtime updates
  // ------------------------------------------
  useEffect(() => {
    if (!user) return;

    loadMessages();

    const channel = supabase
      .channel(`chat-${user.id}-${friendId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => loadMessages()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user, friendId]);

  async function loadMessages() {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),
         and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`
      )
      .order("created_at", { ascending: true });

    setMessages(data || []);
    scrollToBottom();
  }

  function scrollToBottom() {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  // ------------------------------------------
  // Send text message
  // ------------------------------------------
  async function sendMessage() {
    if (!messageInput.trim()) return;

    const text = messageInput.trim();
    setMessageInput("");

    await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: friendId,
      text,
      image_url: null,
      audio_url: null,
    });

    scrollToBottom();
  }

  // ------------------------------------------
  // Send image message
  // ------------------------------------------
  async function sendImage(file) {
    if (!file) return;

    const ext = file.name.split(".").pop();
    const path = `${user.id}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from("chat_images").upload(path, file);

    if (!error) {
      const { data: urlObj } = supabase.storage
        .from("chat_images")
        .getPublicUrl(path);

      await supabase.from("messages").insert({
        sender_id: user.id,
        receiver_id: friendId,
        text: null,
        image_url: urlObj.publicUrl,
        audio_url: null,
      });

      scrollToBottom();
    }
  }

  // ------------------------------------------
  // Voice recording
  // ------------------------------------------
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorder.current = recorder;

      recorder.ondataavailable = (e) => audioChunks.current.push(e.data);

      recorder.onstop = async () => {
        const blob = new Blob(audioChunks.current, { type: "audio/webm" });
        const file = new File([blob], `audio-${Date.now()}.webm`);
        const path = `${user.id}-${Date.now()}.webm`;

        const { error } = await supabase.storage
          .from("chat_audio")
          .upload(path, file);

        if (!error) {
          const { data: urlObj } = supabase.storage
            .from("chat_audio")
            .getPublicUrl(path);

          await supabase.from("messages").insert({
            sender_id: user.id,
            receiver_id: friendId,
            text: null,
            image_url: null,
            audio_url: urlObj.publicUrl,
          });
        }
      };

      recorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Recording error:", err);
    }
  }

  function stopRecording() {
    mediaRecorder.current?.stop();
    setRecording(false);
  }

  // ------------------------------------------
  // Typing indicator
  // ------------------------------------------
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("typing")
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload.from === friendId) {
          setFriendTyping(true);

          clearTimeout(typingTimeout.current);
          typingTimeout.current = setTimeout(() => setFriendTyping(false), 1500);
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [friendId, user]);

  function sendTyping() {
    supabase.channel("typing").send({
      type: "broadcast",
      event: "typing",
      payload: { from: user.id },
    });
  }

  // ------------------------------------------
  // Online + last seen
  // ------------------------------------------
  useEffect(() => {
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("last_active, avatar_url")
        .eq("id", friendId)
        .single();

      if (!data) return;

      const last = new Date(data.last_active);
      const diff = Date.now() - last.getTime();

      setOnline(diff < 60000);
      setLastSeen(
        last.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );

      if (data?.avatar_url) setFriend((f) => ({ ...f, avatar_url: data.avatar_url }));
    }, 5000);

    return () => clearInterval(interval);
  }, [friendId]);

  // ------------------------------------------
  // UI
  // ------------------------------------------
  return (
    <div className="flex flex-col h-screen bg-black text-white">

      {/* HEADER */}
      <div className="flex items-center gap-3 p-4 border-b border-white/10 bg-black sticky top-0 z-20">
        <button onClick={() => navigate("/friends")}>
          <FiArrowLeft size={24} />
        </button>

        <div className="flex items-center gap-3">
          {/* Friend Avatar */}
          <div className="relative">
            <img
              src={friend?.avatar_url || ""}
              alt=""
              className={`w-10 h-10 rounded-full object-cover ${
                friend?.avatar_url ? "border border-red-500" : "bg-white/10"
              }`}
            />
          </div>

          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-lg">
              {friend?.username || "User"}
            </span>

            {online ? (
              <span className="text-green-400 text-xs">Online</span>
            ) : (
              <span className="text-xs opacity-70">Last seen {lastSeen}</span>
            )}

            {friendTyping && (
              <span className="text-xs text-white/60">typing…</span>
            )}
          </div>
        </div>
      </div>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => {
          const mine = m.sender_id === user.id;
          const avatarUrl = mine ? user?.avatar_url : friend?.avatar_url;

          return (
            <div key={m.id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>

              {/* Avatar */}
              {!mine && (
                <img
                  src={avatarUrl || ""}
                  className={`w-8 h-8 rounded-full object-cover ${
                    avatarUrl ? "border border-red-500" : "bg-white/20"
                  }`}
                />
              )}

              {/* Bubble */}
              <div
                className={`max-w-[70%] px-4 py-3 rounded-2xl ${
                  mine
                    ? "bg-black border border-red-600 text-white"
                    : "bg-[#1a1a1a] text-white"
                }`}
              >
                {m.text && <p className="text-sm">{m.text}</p>}

                {m.image_url && (
                  <img
                    src={m.image_url}
                    onClick={() => setImagePreview(m.image_url)}
                    className="rounded-xl mt-2 max-h-60"
                  />
                )}

                {m.audio_url && (
                  <audio controls src={m.audio_url} className="mt-2 w-full" />
                )}

                <p className="text-[10px] opacity-60 mt-1 text-right">
                  {formatTime(m.created_at)}
                </p>
              </div>

              {/* Your avatar */}
              {mine && (
                <img
                  src={user?.avatar_url || ""}
                  className={`w-8 h-8 rounded-full object-cover ${
                    user?.avatar_url ? "border border-red-500" : "bg-white/20"
                  }`}
                />
              )}
            </div>
          );
        })}

        <div ref={bottomRef}></div>
      </div>

      {/* IMAGE PREVIEW */}
      {imagePreview && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <img src={imagePreview} className="max-w-[90%] max-h-[80%] rounded-xl" />
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

        {/* Image */}
        <label className="cursor-pointer">
          <FiImage size={24} className="opacity-70" />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => sendImage(e.target.files[0])}
          />
        </label>

        {/* Mic */}
        {!recording ? (
          <button onClick={startRecording}>
            <FiMic size={24} className="opacity-70" />
          </button>
        ) : (
          <button onClick={stopRecording} className="text-red-400">
            <FiMic size={24} />
          </button>
        )}

        {/* Text input */}
        <input
          value={messageInput}
          onChange={(e) => {
            setMessageInput(e.target.value);
            sendTyping();
          }}
          placeholder="Message…"
          className="flex-1 bg-white/10 rounded-xl p-2 text-sm outline-none"
        />

        {/* Send */}
        <button onClick={sendMessage}>
          <FiSend size={24} className="opacity-80" />
        </button>
      </div>
    </div>
  );
}
