// src/pages/ChatPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import {
  FiArrowLeft,
  FiSend,
  FiImage,
  FiVideo,
  FiX,
  FiTrash2,
  FiMic,
  FiStopCircle,
} from "react-icons/fi";

/* ============================================================
   TIME HELPERS (UNCHANGED)
============================================================ */

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

/* ============================================================
   AUDIO HELPERS (NEW)
============================================================ */

const MAX_AUDIO_SECONDS = 30;

function getAudioPath({ chatId, userId }) {
  return `chat-audio/${chatId}/${userId}/${Date.now()}.webm`;
}

/* ============================================================
   WORKOUT SHARE (UNCHANGED)
============================================================ */

function tryParseJSON(val) {
  if (val == null) return null;
  if (typeof val === "object") return val;
  if (typeof val !== "string") return null;

  const s = val.trim();
  if (!s) return null;
  if (!(s.startsWith("{") || s.startsWith("["))) return null;

  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function extractWorkoutShareFromMessage(m) {
  const candidates = [m.text, m.message, m.body, m.content, m.payload, m.data];

  for (const c of candidates) {
    const parsed = tryParseJSON(c);
    if (!parsed) continue;

    if (parsed?.type === "workout_share" && parsed?.workout) return parsed;

    if (parsed?.type === "workout_share" && parsed?.payload?.workout) {
      return {
        type: "workout_share",
        workout: parsed.payload.workout,
        exercises: parsed.payload.exercises || [],
        sent_at: parsed.payload.sent_at || parsed.sent_at || null,
      };
    }

    if (parsed?.workout && Array.isArray(parsed?.exercises)) {
      return { type: "workout_share", ...parsed };
    }
  }

  return null;
}

/* ============================================================
   VIDEO URL FALLBACK (UNCHANGED)
============================================================ */

function extractInlineVideoUrl(m) {
  const direct = m?.video_url;
  if (direct) return direct;

  const t = (m?.text || "").trim();
  if (!t) return null;

  if (t.startsWith("VIDEO:")) {
    const url = t.slice("VIDEO:".length).trim();
    if (url.startsWith("http")) return url;
  }

  return null;
}

/* ============================================================
   MAIN COMPONENT
============================================================ */

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

  const [savingWorkoutKey, setSavingWorkoutKey] = useState(null);
  const [toast, setToast] = useState("");

  // -------------------------
  // DELETE / VIDEO (UNCHANGED)
  // -------------------------
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  // -------------------------
  // AUDIO STATE (NEW)
  // -------------------------
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordDuration, setRecordDuration] = useState(0);
  const [sendingAudio, setSendingAudio] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordTimerRef = useRef(null);

  const listRef = useRef(null);
  const holdTimer = useRef(null);

  // -------------------------
  // PRESENCE REFS (UNCHANGED)
  // -------------------------
  const idleTimer = useRef(null);
  const heartbeatTimer = useRef(null);
  const isOnlineRef = useRef(false);

  /* ============================================================
     AUDIO RECORD CONTROL (NEW)
  ============================================================ */

  async function startRecording() {
    if (isRecording) return;
    setError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        setRecordedBlob(blob);
        audioChunksRef.current = [];
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordDuration(0);

      recordTimerRef.current = setInterval(() => {
        setRecordDuration((d) => {
          if (d + 1 >= MAX_AUDIO_SECONDS) {
            stopRecording();
            return MAX_AUDIO_SECONDS;
          }
          return d + 1;
        });
      }, 1000);
    } catch (e) {
      setError("Microphone permission denied.");
    }
  }

  function stopRecording() {
    if (!mediaRecorderRef.current) return;

    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current = null;

    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }

    setIsRecording(false);
  }

  function cancelRecording() {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current = null;
    }

    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }

    audioChunksRef.current = [];
    setRecordedBlob(null);
    setIsRecording(false);
    setRecordDuration(0);
  }

  /* ============================================================
     CONTINUES IN PART 2
  ============================================================ */
  /* ============================================================
     AUDIO SEND (NEW)
  ============================================================ */

  async function sendRecordedAudio() {
    if (!recordedBlob || !user || sendingAudio) return;
    setSendingAudio(true);
    setError("");

    try {
      const path = getAudioPath({
        chatId: friendId,
        userId: user.id,
      });

      const { error: uploadErr } = await supabase.storage
        .from("chat-audio")
        .upload(path, recordedBlob, {
          contentType: "audio/webm",
        });

      if (uploadErr) {
        setSendingAudio(false);
        setError(uploadErr.message);
        return;
      }

      const { data } = supabase.storage
        .from("chat-audio")
        .getPublicUrl(path);

      const audioUrl = data?.publicUrl;

      if (!audioUrl) {
        setSendingAudio(false);
        setError("Failed to get audio URL.");
        return;
      }

      const { error: insertErr } = await supabase.from("messages").insert({
        sender_id: user.id,
        receiver_id: friendId,
        audio_url: audioUrl,
        audio_duration: recordDuration,
      });

      if (insertErr) {
        setSendingAudio(false);
        setError(insertErr.message);
        return;
      }

      setRecordedBlob(null);
      setRecordDuration(0);
      setToast("🎙️ Voice message sent");
    } catch (e) {
      setError("Failed sending audio.");
    } finally {
      setSendingAudio(false);
    }
  }

  /* ============================================================
     TOAST TIMER (UNCHANGED)
  ============================================================ */

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  /* ============================================================
     LOAD FRIEND + MESSAGES (UNCHANGED)
  ============================================================ */

  async function loadFriendProfile() {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, is_online, last_seen")
      .eq("id", friendId)
      .single();

    if (data) setFriend(data);
  }

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

  /* ============================================================
     INITIAL LOAD (UNCHANGED)
  ============================================================ */

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

  /* ============================================================
     REALTIME MESSAGES (UNCHANGED)
  ============================================================ */

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

  /* ============================================================
     SCROLL (UNCHANGED)
  ============================================================ */

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  /* ============================================================
     SEND TEXT / IMAGE / VIDEO (UNCHANGED)
  ============================================================ */

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

  /* ============================================================
     CONTINUES IN PART 3
  ============================================================ */
  /* ============================================================
     MESSAGE RENDER HELPERS (NEW)
  ============================================================ */

  function AudioMessageBubble({ url, duration }) {
    const audioRef = useRef(null);
    const [playing, setPlaying] = useState(false);

    function togglePlay() {
      if (!audioRef.current) return;

      if (playing) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }

    useEffect(() => {
      const a = audioRef.current;
      if (!a) return;

      const onEnd = () => setPlaying(false);
      a.addEventListener("ended", onEnd);
      return () => a.removeEventListener("ended", onEnd);
    }, []);

    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          minWidth: 180,
        }}
      >
        <button
          onClick={togglePlay}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            border: "none",
            background: "#000",
            color: "#fff",
            fontWeight: 900,
          }}
        >
          {playing ? "❚❚" : "▶"}
        </button>

        <div style={{ flex: 1 }}>
          <div
            style={{
              height: 6,
              background: "rgba(255,255,255,0.25)",
              borderRadius: 999,
            }}
          />
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
            {duration ? `${duration}s` : "Voice message"}
          </div>
        </div>

        <audio ref={audioRef} src={url} preload="metadata" />
      </div>
    );
  }

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <div style={shell}>
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
                borderRadius: "50%",
                background: friendOnline ? "#2dff57" : "rgba(255,255,255,0.3)",
                boxShadow: friendOnline
                  ? "0 0 8px rgba(45,255,87,0.9)"
                  : "none",
              }}
            />
          </div>

          {friendStatus && (
            <span style={{ fontSize: 12, opacity: 0.85 }}>
              {friendStatus}
            </span>
          )}
        </div>
      </div>

      {/* MESSAGES */}
      <div ref={listRef} style={messagesBox}>
        {loading && <div style={{ opacity: 0.6 }}>Loading…</div>}
        {error && <div style={errBox}>{error}</div>}

        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          const share = extractWorkoutShareFromMessage(m);
          const saveKey = `${m.id}-${share?.workout?.id || "w"}`;
          const saving = savingWorkoutKey === saveKey;
          const videoUrl = extractInlineVideoUrl(m);

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
                  maxWidth: "78%",
                  fontSize: 16,
                }}
              >
                {share ? (
                  <WorkoutShareCard
                    share={share}
                    mine={mine}
                    saving={saving}
                    onSave={() => saveSharedWorkout(share, m.id)}
                  />
                ) : (
                  <>
                    {m.text && !m.text.startsWith("VIDEO:") && (
                      <div>{m.text}</div>
                    )}
                  </>
                )}

                {m.audio_url && (
                  <div style={{ marginTop: 6 }}>
                    <AudioMessageBubble
                      url={m.audio_url}
                      duration={m.audio_duration}
                    />
                  </div>
                )}

                {m.image_url && (
                  <img
                    src={m.image_url}
                    onClick={() => setImageView(m.image_url)}
                    style={{
                      marginTop: 6,
                      borderRadius: 12,
                      maxHeight: 220,
                      maxWidth: "100%",
                      cursor: "pointer",
                    }}
                  />
                )}

                {videoUrl && (
                  <video
                    src={videoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    style={{
                      marginTop: 6,
                      borderRadius: 12,
                      maxHeight: 260,
                      maxWidth: "100%",
                      background: "#000",
                    }}
                  />
                )}

                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 6 }}>
                  {formatTime(m.created_at)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      /* ============================================================
         INPUT BAR CONTINUES IN PART 4
      ============================================================ */
      {/* INPUT BAR */}
      <div style={inputBar}>
        {/* IMAGE */}
        <label style={{ display: "flex", alignItems: "center" }}>
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

        {/* VIDEO */}
        <label style={{ display: "flex", alignItems: "center" }}>
          <FiVideo size={22} />
          <input
            type="file"
            hidden
            accept="video/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = null;
              sendVideo(file);
            }}
          />
        </label>

        {/* AUDIO */}
        {!recordedBlob && !isRecording && (
          <button onClick={startRecording} style={micBtn}>
            <FiMic size={22} />
          </button>
        )}

        {isRecording && (
          <button onClick={stopRecording} style={stopBtn}>
            <FiStopCircle size={24} />
          </button>
        )}

        {recordedBlob && !isRecording && (
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={cancelRecording} style={cancelAudioBtn}>
              <FiX size={18} />
            </button>
            <button
              onClick={sendRecordedAudio}
              disabled={sendingAudio}
              style={sendAudioBtn}
            >
              <FiSend size={18} />
            </button>
          </div>
        )}

        {/* TEXT INPUT */}
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

      {/* DELETE CONFIRM MODAL */}
      {deleteTarget && (
        <div style={deleteOverlay}>
          <div style={deleteModal}>
            <FiTrash2 size={28} color="#ff2f2f" />
            <div style={{ fontWeight: 900, fontSize: 18 }}>
              Delete message?
            </div>
            <div style={{ opacity: 0.8, textAlign: "center" }}>
              This can’t be undone.
            </div>

            <div style={{ display: "flex", gap: 10, width: "100%" }}>
              <button
                onClick={() => setDeleteTarget(null)}
                style={cancelBtn}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteMessage}
                style={deleteBtn}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && <div style={toastStyle}>{toast}</div>}

      {/* IMAGE VIEW */}
      {imageView && (
        <div style={imageOverlay} onClick={() => setImageView(null)}>
          <img src={imageView} style={imageFull} />
          <FiX size={28} style={closeIcon} />
        </div>
      )}
    </div>
  );
}

/* ============================================================
   AUDIO BUTTON STYLES (NEW)
============================================================ */

const micBtn = {
  width: 44,
  height: 44,
  borderRadius: 12,
  background: "#222",
  border: "none",
  color: "#fff",
};

const stopBtn = {
  width: 44,
  height: 44,
  borderRadius: 12,
  background: "#ff2f2f",
  border: "none",
  color: "#fff",
};

const cancelAudioBtn = {
  width: 36,
  height: 36,
  borderRadius: 10,
  background: "#333",
  border: "none",
  color: "#fff",
};

const sendAudioBtn = {
  width: 36,
  height: 36,
  borderRadius: 10,
  background: "#ff2f2f",
  border: "none",
  color: "#fff",
};

/* ============================================================
   EXISTING STYLES BELOW (UNCHANGED)
============================================================ */
/* ============================================================
   DELETE MODAL STYLES
============================================================ */

const deleteOverlay = {
  position: "absolute",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
};

const deleteModal = {
  background: "#111",
  borderRadius: 16,
  padding: 20,
  width: "85%",
  maxWidth: 320,
  display: "flex",
  flexDirection: "column",
  gap: 12,
  alignItems: "center",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.1)",
};

const cancelBtn = {
  flex: 1,
  padding: "10px 12px",
  borderRadius: 12,
  background: "#222",
  color: "#fff",
  border: "none",
  fontWeight: 800,
};

const deleteBtn = {
  flex: 1,
  padding: "10px 12px",
  borderRadius: 12,
  background: "#ff2f2f",
  color: "#fff",
  border: "none",
  fontWeight: 900,
};

/* ============================================================
   TOAST
============================================================ */

const toastStyle = {
  position: "absolute",
  bottom: 86,
  left: "50%",
  transform: "translateX(-50%)",
  background: "rgba(0,0,0,0.85)",
  border: "1px solid rgba(255,255,255,0.15)",
  color: "#fff",
  padding: "10px 14px",
  borderRadius: 999,
  fontWeight: 800,
  zIndex: 9999,
};

/* ============================================================
   BASE CHAT STYLES
============================================================ */

const shell = {
  position: "fixed",
  inset: 0,
  background: "#000",
  overflow: "hidden",
};

const header = {
  position: "absolute",
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
  position: "absolute",
  top: 56,
  left: 0,
  right: 0,
  bottom: 72,
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
  overscrollBehavior: "contain",
  touchAction: "pan-y",
  padding: 12,
  background: "#000",
};

const inputBar = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  height: 72,
  paddingBottom: "env(safe-area-inset-bottom)",
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

/* ============================================================
   IMAGE VIEW
============================================================ */

const imageOverlay = {
  position: "absolute",
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
