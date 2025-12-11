// src/pages/ChatPage.jsx
import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import { useParams, useNavigate } from "react-router-dom";

// Icons
import { FiArrowLeft, FiSend, FiImage, FiMic, FiX } from "react-icons/fi";

// Time formatter
function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [friend, setFriend] = useState(null);
  const [friendId, setFriendId] = useState(null);

  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");

  const [friendTyping, setFriendTyping] = useState(false);

  const [imagePreview, setImagePreview] = useState(null);

  const [recording, setRecording] = useState(false);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);

  const bottomRef = useRef(null);

  // ---------------------------
  // Load User + Conversation
  // ---------------------------
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return;
      setUser(data.user);

      const convoRes = await supabase
        .from("conversations")
        .select("*")
        .eq("id", conversationId)
        .single();

      if (!convoRes.data) return;

      const convo = convoRes.data;

      // Figure out who the friend is
      const fid = convo.user1_id === data.user.id ? convo.user2_id : convo.user1_id;
      setFriendId(fid);

      // Load friend profile
      const friendProfile = await supabase
        .from("profiles")
        .select("*")
        .eq("id", fid)
        .single();

      setFriend(friendProfile.data);
    })();
  }, [conversationId]);

  // ---------------------------
  // Load Messages + Subscribe
  // ---------------------------
  useEffect(() => {
    if (!user || !friendId) return;

    loadMessages();

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user, friendId, conversationId]);

  async function loadMessages() {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    setMessages(data || []);
    scrollToBottom();
  }

  // ---------------------------
  // Send Text Message
  // ---------------------------
  async function sendMessage() {
    if (!messageInput.trim()) return;

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      text: messageInput.trim(),
      image_url: null,
      audio_url: null,
    });

    setMessageInput("");
    scrollToBottom();
  }

  // ---------------------------
  // Upload Image + Send
  // ---------------------------
  async function sendImage(file) {
    if (!file) return;

    const ext = file.name.split(".").pop();
    const path = `${user.id}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("chat_images")
      .upload(path, file);

    if (error) return;

    const { data: url } = supabase.storage
      .from("chat_images")
      .getPublicUrl(path);

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      text: null,
      image_url: url.publicUrl,
      audio_url: null,
    });

    scrollToBottom();
  }

  // ---------------------------
  // Audio Recording + Send
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

      const path = `${user.id}-${Date.now()}.webm`;

      const { error } = await supabase.storage
        .from("chat_audio")
        .upload(path, file);

      if (!error) {
        const { data: url } = supabase.storage
          .from("chat_audio")
          .getPublicUrl(path);

        await supabase.from("messages").insert({
          conversation_id: conversationId,
          sender_id: user.id,
          text: null,
          image_url: null,
          audio_url: url.publicUrl,
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
  // Auto-scroll
  // ---------------------------
  function scrollToBottom() {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }

  // ---------------------------
  // UI RENDER -----------------
  // ---------------------------
  return (
    <div className="flex flex-col h-screen bg-black text-white">
      
      {/* HEADER */}
      <div className="flex items-center gap-3 p-4 border-b border-white/10 bg-black sticky top-0">
        <button onClick={() => navigate("/friends")}>
          <FiArrowLeft size={22} />
        </button>

        <div className="flex flex-col">
          <span className="font-semibold text-lg">{friend?.username || "User"}</span>
        </div>
      </div>

      {/* MESSAGE LIST */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;

          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] px-4 py-3 rounded-2xl ${
                  mine ? "bg-[#ff2f2f]" : "bg-white/10"
                }`}
              >
                {m.text && <p className="text-sm mb-1">{m.text}</p>}

                {m.image_url && (
                  <img
                    src={m.image_url}
                    className="rounded-xl mt-1 mb-1 max-h-64"
                    onClick={() => setImagePreview(m.image_url)}
                  />
                )}

                {m.audio_url && (
                  <audio controls src={m.audio_url} className="mt-1 w-full" />
                )}

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
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <img src={imagePreview} className="max-w-[90%] max-h-[80%] rounded-xl" />

          <button
            onClick={() => setImagePreview(null)}
            className="absolute top-5 right-5 bg-white/10 p-3 rounded-full"
          >
            <FiX size={24} />
          </button>
        </div>
      )}

      {/* INPUT BAR */}
      <div className="p-3 border-t border-white/10 bg-black flex items-center gap-3">

        {/* Upload Image */}
        <label className="cursor-pointer">
          <FiImage size={24} />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => sendImage(e.target.files?.[0])}
          />
        </label>

        {/* Audio Recording */}
        {!recording ? (
          <button onClick={startRecording}>
            <FiMic size={24} />
          </button>
        ) : (
          <button onClick={stopRecording} className="text-red-400">
            <FiMic size={24} />
          </button>
        )}

        {/* Text input */}
        <input
          className="flex-1 bg-white/10 px-4 py-2 rounded-xl outline-none"
          placeholder="Message..."
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
        />

        {/* Send */}
        <button onClick={sendMessage}>
          <FiSend size={24} />
        </button>
      </div>
    </div>
  );
}
