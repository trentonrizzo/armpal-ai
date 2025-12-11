// src/pages/ChatPage.jsx
import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import { useParams, useNavigate } from "react-router-dom";

// Icons
import { FiArrowLeft, FiSend, FiImage, FiMic, FiX } from "react-icons/fi";

// Format timestamp
function formatTime(ts) {
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

  const [friendTyping, setFriendTyping] = useState(false);
  const typingTimeout = useRef(null);

  const [online, setOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);

  const bottomRef = useRef(null);

  // Recording
  const [recording, setRecording] = useState(false);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);

  // -----------------------------------
  // Load user + friend profile
  // -----------------------------------
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);

      const { data: friendProf } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", friendId)
        .single();

      setFriend(friendProf);
    })();
  }, [friendId]);

  // -----------------------------------
  // Load messages + realtime subscription
  // -----------------------------------
  useEffect(() => {
    if (!user) return;

    loadMessages();

    const channel = supabase
      .channel(`messages-${user.id}-${friendId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          loadMessages();
        }
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
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 20);
  }

  // -----------------------------------
  // Send Text Message
  // -----------------------------------
  async function sendMessage() {
    if (!messageInput.trim()) return;

    const text = messageInput.trim();
    setMessageInput("");

    await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: friendId,
      content: text,
      image_url: null,
      audio_url: null,
    });

    scrollToBottom();
  }

  // -----------------------------------
  // Send Image
  // -----------------------------------
  async function sendImage(file) {
    if (!file) return;

    const ext = file.name.split(".").pop();
    const path = `${user.id}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("chat_images")
      .upload(path, file);

    if (!error) {
      const { data: urlData } = supabase.storage
        .from("chat_images")
        .getPublicUrl(path);

      await supabase.from("messages").insert({
        sender_id: user.id,
        receiver_id: friendId,
        content: null,
        image_url: urlData.publicUrl,
        audio_url: null,
      });

      scrollToBottom();
    }
  }

  // -----------------------------------
  // Voice Recording
  // -----------------------------------
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
          const { data: urlData } = supabase.storage
            .from("chat_audio")
            .getPublicUrl(path);

          await supabase.from("messages").insert({
            sender_id: user.id,
            receiver_id: friendId,
            content: null,
            image_url: null,
            audio_url: urlData.publicUrl,
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
    if (!mediaRecorder.current) return;
    mediaRecorder.current.stop();
    setRecording(false);
  }

  // -----------------------------------
  // Typing indicator
  // -----------------------------------
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
  }, [friendId, user]);

  function sendTyping() {
    supabase.channel("typing").send({
      type: "broadcast",
      event: "typing",
      payload: { from: user.id },
    });
  }

  // -----------------------------------
  // Online / Last seen
  // -----------------------------------
  useEffect(() => {
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("last_active")
        .eq("id", friendId)
        .single();

      if (!data) return;

      const last = new Date(data.last_active);
      const diff = Date.now() - last.getTime();

      if (diff < 60000) {
        setOnline(true);
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

  // -----------------------------------
  // RENDER UI
  // -----------------------------------
  return (
    <div className="flex flex-col h-screen bg-black text-white">

      {/* HEADER */}
      <div className="flex items-center gap-3 p-4 border-b border-white/10 bg-black sticky top-0 z-20">
        <button onClick={() => navigate("/friends")}>
          <FiArrowLeft size={24} />
        </button>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-lg">
              {friend?.username || "User"}
            </span>

            {online ? (
              <span className="w-3 h-3 bg-green-500 rounded-full"></span>
            ) : (
              <span className="text-xs opacity-70">Last seen {lastSeen}</span>
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
          const isMine = m.sender_id === user.id;

          return (
            <div
              key={m.id}
              className={`flex ${isMine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] p-3 rounded-2xl 
                  ${
                    isMine
                      ? "bg-[#ff2f2f] text-white"
                      : "bg-[#1a1a1a] text-white"
                  }`}
              >
                {/* text */}
                {m.content && <p className="text-sm">{m.content}</p>}

                {/* image */}
                {m.image_url && (
                  <img
                    src={m.image_url}
                    alt=""
                    className="rounded-xl mt-2 max-h-60 cursor-pointer"
                    onClick={() => setImagePreview(m.image_url)}
                  />
                )}

                {/* audio */}
                {m.audio_url && (
                  <audio
                    controls
                    src={m.audio_url}
                    className="mt-2 w-full"
                  />
                )}

                {/* timestamp */}
                <p className="text-[10px] opacity-60 mt-1 text-right">
                  {formatTime(m.created_at)}
                </p>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef}></div>
      </div>

      {/* IMAGE PREVIEW */}
      {imagePreview && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
          <img
            src={imagePreview}
            alt=""
            className="max-w-[90%] max-h-[80%] rounded-xl"
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
      <div className="p-3 border-t border-white/10 bg-black flex items-center gap-3">

        {/* image */}
        <label className="cursor-pointer">
          <FiImage size={24} className="opacity-80" />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => sendImage(e.target.files[0])}
          />
        </label>

        {/* mic */}
        {!recording ? (
          <button onClick={startRecording}>
            <FiMic size={24} className="opacity-80" />
          </button>
        ) : (
          <button onClick={stopRecording} className="text-red-500">
            <FiMic size={24} />
          </button>
        )}

        {/* text box */}
        <input
          value={messageInput}
          onChange={(e) => {
            setMessageInput(e.target.value);
            sendTyping();
          }}
          placeholder="Message..."
          className="flex-1 bg-white/10 rounded-xl p-2 text-sm outline-none"
        />

        {/* send */}
        <button onClick={sendMessage}>
          <FiSend size={24} className="opacity-80" />
        </button>
      </div>
    </div>
  );
}
