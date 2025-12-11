// src/pages/ChatPage.jsx
import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import { useParams } from "react-router-dom";

// Icons
import { FiArrowLeft, FiSend, FiImage, FiMic, FiX } from "react-icons/fi";

// ---------- FORMAT TIME ----------
function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatPage() {
  const { friendId } = useParams();

  const [user, setUser] = useState(null);
  const [friend, setFriend] = useState(null);

  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");

  const [isTyping, setIsTyping] = useState(false);
  const typingTimeout = useRef(null);

  const [friendTyping, setFriendTyping] = useState(false);

  const [imagePreview, setImagePreview] = useState(null);
  const [online, setOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);

  const [recording, setRecording] = useState(false);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);

  const bottomRef = useRef(null);

  // ---------------------------
  // Load User + Friend Profile
  // ---------------------------
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);

      const { data: friendProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", friendId)
        .single();

      setFriend(friendProfile);
    })();
  }, [friendId]);

  // ---------------------------
  // Load Messages
  // ---------------------------
  useEffect(() => {
    if (!user) return;

    loadMessages();

    // subscribe to realtime changes
    const channel = supabase
      .channel(`messages-${user.id}-${friendId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, friendId]);

  async function loadMessages() {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${user.id}, receiver_id.eq.${friendId}),
         and(sender_id.eq.${friendId}, receiver_id.eq.${user.id})`
      )
      .order("created_at", { ascending: true });

    setMessages(data || []);
    scrollToBottom();

    // mark friend messages as read
    if (data?.length > 0) {
      const unread = data.filter(
        (m) => m.sender_id === friendId
      );
      if (unread.length > 0) markAsRead(unread);
    }
  }

  async function markAsRead(msgs) {
    for (const m of msgs) {
      await supabase.from("message_reads").insert({
        message_id: m.id,
        user_id: user.id,
      });
    }
  }

  // ---------------------------
  // Send Text Message
  // ---------------------------
  async function sendMessage() {
    if (!messageInput.trim()) return;

    const content = messageInput.trim();
    setMessageInput("");

    await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: friendId,
      content,
      image_url: null,
      audio_url: null,
    });

    scrollToBottom();
  }

  // ---------------------------
  // Image Upload
  // ---------------------------
  async function sendImage(file) {
    const fileExt = file.name.split(".").pop();
    const path = `${user.id}-${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
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
    }
  }

  // ---------------------------
  // Voice Recording
  // ---------------------------
  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks.current = [];

    const recorder = new MediaRecorder(stream);
    mediaRecorder.current = recorder;

    recorder.ondataavailable = (e) => audioChunks.current.push(e.data);

    recorder.onstop = async () => {
      const blob = new Blob(audioChunks.current, { type: "audio/webm" });
      const file = new File([blob], `audio-${Date.now()}.webm`);

      const fileExt = "webm";
      const path = `${user.id}-${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
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
  }

  function stopRecording() {
    if (mediaRecorder.current) {
      mediaRecorder.current.stop();
      setRecording(false);
    }
  }

  // ---------------------------
  // Typing Indicator
  // ---------------------------
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("typing")
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload.from === friendId) {
          setFriendTyping(true);

          setTimeout(() => setFriendTyping(false), 1500);
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

  // ---------------------------
  // Online Status / Last Seen
  // ---------------------------
  useEffect(() => {
    if (!friendId) return;

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
        setLastSeen(last.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [friendId]);

  // ---------------------------
  // Auto-scroll
  // ---------------------------
  function scrollToBottom() {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }

  // ---------------------------
  // Render UI
  // ---------------------------
  return (
    <div className="flex flex-col h-screen bg-black text-white">
      {/* Top bar */}
      <div className="flex items-center gap-3 p-4 border-b border-white/10 bg-black/80 sticky top-0">
        <a href="/friends">
          <FiArrowLeft size={22} />
        </a>

        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{friend?.username || "User"}</span>

            {online ? (
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
            ) : (
              <span className="text-xs opacity-60">
                Last seen {lastSeen || "recently"}
              </span>
            )}
          </div>

          {friendTyping && (
            <p className="text-xs text-white/60">typing...</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m) => {
          const isMine = m.sender_id === user.id;

          return (
            <div
              key={m.id}
              className={`flex ${isMine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[70%] rounded-2xl p-3 ${
                  isMine
                    ? "bg-[#ff2f2f] text-white"
                    : "bg-white/10 text-white"
                }`}
              >
                {/* text */}
                {m.content && <p className="mb-1 text-sm">{m.content}</p>}

                {/* image */}
                {m.image_url && (
                  <img
                    src={m.image_url}
                    alt="sent img"
                    className="rounded-lg mt-1 mb-1 max-h-60 cursor-pointer"
                    onClick={() => setImagePreview(m.image_url)}
                  />
                )}

                {/* audio */}
                {m.audio_url && (
                  <audio
                    controls
                    src={m.audio_url}
                    className="w-full mt-1"
                  />
                )}

                {/* time */}
                <p className="text-[10px] opacity-70 mt-1 text-right">
                  {formatTime(m.created_at)}
                </p>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef}></div>
      </div>

      {/* IMAGE PREVIEW MODAL */}
      {imagePreview && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <img
            src={imagePreview}
            alt="preview"
            className="max-h-[80%] max-w-[90%] rounded-lg"
          />
          <button
            onClick={() => setImagePreview(null)}
            className="absolute top-6 right-6 bg-white/10 p-3 rounded-full"
          >
            <FiX size={22} />
          </button>
        </div>
      )}

      {/* INPUT BAR */}
      <div className="p-3 border-t border-white/10 bg-black flex items-center gap-3">
        {/* Image */}
        <label className="cursor-pointer">
          <FiImage size={22} />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => sendImage(e.target.files[0])}
          />
        </label>

        {/* Record */}
        {!recording ? (
          <button onClick={startRecording}>
            <FiMic size={22} />
          </button>
        ) : (
          <button onClick={stopRecording} className="text-red-400">
            <FiMic size={22} />
          </button>
        )}

        {/* Text box */}
        <input
          value={messageInput}
          onChange={(e) => {
            setMessageInput(e.target.value);
            sendTyping();
          }}
          placeholder="Message..."
          className="flex-1 bg-white/10 p-2 rounded-xl outline-none"
        />

        {/* Send */}
        <button onClick={sendMessage}>
          <FiSend size={22} />
        </button>
      </div>
    </div>
  );
}
