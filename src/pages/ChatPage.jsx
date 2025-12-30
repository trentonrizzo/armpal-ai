// src/pages/ChatPage.jsx
// ============================================================
// FULL FILE REPLACEMENT — LONG, TALL, iOS‑COMPATIBLE
// ============================================================
// GOALS (NO GUESSING — BASED ON YOUR CURRENT FILE):
// ✅ Keep workout share cards EXACTLY (no raw JSON dumps)
// ✅ Keep images working exactly the same
// ✅ Audio: real recording UI + timer + circular 30s progress
// ✅ Audio: preview (replay) before send + discard
// ✅ Audio: inserts + renders (no invisible messages)
// ✅ Bottom UI: STRICTLY VERTICAL (no horizontal flex rows)
// ✅ VSCode red fix: valid JS/JSX, no broken blocks
// ✅ Realtime: dedupe + optimistic replace (no double messages)
// ============================================================

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import {
  FiArrowLeft,
  FiSend,
  FiImage,
  FiVideo,
  FiMic,
  FiStopCircle,
  FiTrash2,
  FiX,
  FiRefreshCcw,
} from "react-icons/fi";

// ============================================================
// TIME HELPERS
// ============================================================

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
  const diff = Math.floor((now - then) / 1000);

  if (diff < 10) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatMMSS(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

// ============================================================
// STORAGE HELPERS (MATCH YOUR BUCKET NAMES)
// ============================================================

const MAX_AUDIO_SECONDS = 30;

function audioPath(chatId, userId) {
  return `chat-audio/${chatId}/${userId}/${Date.now()}.webm`;
}

function imagePath(chatId, userId, name) {
  return `chat-images/${chatId}/${userId}/${Date.now()}-${name}`;
}

function videoPath(chatId, userId, name) {
  return `chat-videos/${chatId}/${userId}/${Date.now()}-${name}`;
}

// ============================================================
// SAFE JSON + WORKOUT SHARE PARSING (UNCHANGED LOGIC)
// ============================================================

function safeParseJSON(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function extractWorkoutShare(message) {
  const candidates = [
    message.text,
    message.message,
    message.payload,
    message.data,
  ];

  for (const c of candidates) {
    const parsed = safeParseJSON(c);
    if (parsed?.type === "workout_share") {
      return parsed;
    }
  }

  return null;
}

// ============================================================
// WORKOUT SHARE CARD (RESTORED — NEVER JSON DUMP)
// ============================================================

function WorkoutShareCard({ share }) {
  const workoutName = share?.workout?.name || "Workout";
  const exercises = Array.isArray(share?.exercises) ? share.exercises : [];

  return (
    <div style={workoutCard}>
      <div style={workoutTitle}>📋 {workoutName}</div>

      {exercises.slice(0, 8).map((ex, i) => (
        <div key={i} style={workoutRow}>
          • {ex.name}
        </div>
      ))}

      {exercises.length === 0 && (
        <div style={workoutRowMuted}>No exercises listed</div>
      )}
    </div>
  );
}

// ============================================================
// CIRCULAR PROGRESS (CLOCK STYLE)
// ============================================================

function CircularProgressRing({
  size = 64,
  stroke = 5,
  progress = 0,
  color = "#ff2f2f",
  track = "rgba(255,255,255,0.12)",
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));
  const dashOffset = (1 - clamped) * circumference;

  return (
    <svg width={size} height={size} style={ringSvg}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={track}
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function ChatPage() {
  const { friendId } = useParams();
  const navigate = useNavigate();

  // ----------------------------------------------------------
  // CORE STATE
  // ----------------------------------------------------------

  const [user, setUser] = useState(null);
  const [friend, setFriend] = useState(null);
  const [messages, setMessages] = useState([]);

  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [imageView, setImageView] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ----------------------------------------------------------
  // AUDIO STATE (REAL UI)
  // ----------------------------------------------------------

  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordDuration, setRecordDuration] = useState(0);
  const [sendingAudio, setSendingAudio] = useState(false);

  // audio preview URL (replay before send)
  const previewUrl = useMemo(() => {
    if (!recordedBlob) return null;
    try {
      return URL.createObjectURL(recordedBlob);
    } catch {
      return null;
    }
  }, [recordedBlob]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        try {
          URL.revokeObjectURL(previewUrl);
        } catch {
          // ignore
        }
      }
    };
  }, [previewUrl]);

  // ----------------------------------------------------------
  // REFS
  // ----------------------------------------------------------

  const listRef = useRef(null);
  const holdTimer = useRef(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  // ----------------------------------------------------------
  // DERIVED FRIEND STATUS
  // ----------------------------------------------------------

  const friendName =
    friend?.display_name || friend?.username || "Chat";

  const friendOnline =
    !!friend?.is_online &&
    friend?.last_seen &&
    Date.now() - new Date(friend.last_seen).getTime() < 60000;

  const friendStatus = friendOnline
    ? "Online"
    : friend?.last_seen
    ? `Last seen ${timeAgo(friend.last_seen)}`
    : "";

  // ============================================================
  // LOAD USER / FRIEND / MESSAGES
  // ============================================================

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError("");

      const { data } = await supabase.auth.getUser();
      if (!mounted) return;

      const u = data?.user;
      if (!u) {
        setError("Not logged in");
        setLoading(false);
        return;
      }

      setUser(u);

      const [{ data: f }, { data: msgs, error: msgErr }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, username, display_name, is_online, last_seen")
            .eq("id", friendId)
            .single(),
          supabase
            .from("messages")
            .select("*")
            .or(
              `and(sender_id.eq.${u.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${u.id})`
            )
            .order("created_at", { ascending: true }),
        ]);

      if (!mounted) return;

      setFriend(f || null);
      if (msgErr) setError(msgErr.message);
      setMessages(msgs || []);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [friendId]);

  // ============================================================
  // REALTIME INSERTS (DEDUPED)
  // ============================================================

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

          setMessages((prev) => {
            // If we already have the real id, do nothing
            if (prev.some((x) => x.id === m.id)) return prev;

            // If we have an optimistic local message with the SAME media URL,
            // replace it with the real one.
            const idx = prev.findIndex(
              (x) =>
                typeof x.id === "string" &&
                x.id.startsWith("local-") &&
                ((x.audio_url && m.audio_url && x.audio_url === m.audio_url) ||
                  (x.image_url && m.image_url && x.image_url === m.image_url) ||
                  (x.video_url && m.video_url && x.video_url === m.video_url))
            );

            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = m;
              return copy;
            }

            return [...prev, m];
          });
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user, friendId]);

  // ============================================================
  // AUTOSCROLL
  // ============================================================

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // ============================================================
  // SEND TEXT MESSAGE
  // ============================================================

  async function sendMessage() {
    if (!user?.id) return;
    if (!text.trim()) return;

    const payload = text;
    setText("");
    setError("");

    try {
      await supabase.from("messages").insert({
        sender_id: user.id,
        receiver_id: friendId,
        text: payload,
      });
    } catch (e) {
      setError(e?.message || "Send failed");
    }
  }

  // ============================================================
  // SEND IMAGE (SAFE)
  // ============================================================

  async function sendImage(file) {
    if (!user?.id) return;
    if (!file) return;

    setError("");

    try {
      const path = imagePath(friendId, user.id, file.name);

      const { error: uploadErr } = await supabase.storage
        .from("chat-images")
        .upload(path, file, { upsert: false });

      if (uploadErr) {
        setError(uploadErr.message);
        return;
      }

      const { data } = supabase.storage
        .from("chat-images")
        .getPublicUrl(path);

      if (!data?.publicUrl) {
        setError("Image URL unavailable");
        return;
      }

      // Insert message (no guessing)
      await supabase.from("messages").insert({
        sender_id: user.id,
        receiver_id: friendId,
        image_url: data.publicUrl,
      });
    } catch (e) {
      setError(e?.message || "Image send failed");
    }
  }

  // ============================================================
  // SEND VIDEO (SAFE)
  // ============================================================

  async function sendVideo(file) {
    if (!user?.id) return;
    if (!file) return;

    setError("");

    try {
      const path = videoPath(friendId, user.id, file.name);

      const { error: uploadErr } = await supabase.storage
        .from("chat-videos")
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadErr) {
        setError(
          uploadErr.message ||
            "Video upload failed (ensure chat-videos bucket exists + is public)"
        );
        return;
      }

      const { data } = supabase.storage
        .from("chat-videos")
        .getPublicUrl(path);

      if (!data?.publicUrl) {
        setError("Video URL unavailable");
        return;
      }

      await supabase.from("messages").insert({
        sender_id: user.id,
        receiver_id: friendId,
        video_url: data.publicUrl,
      });
    } catch (e) {
      setError(e?.message || "Video send failed");
    }
  }

  // ============================================================
  // AUDIO RECORDING (iOS SAFE)
  // ============================================================

  async function startRecording() {
    if (isRecording) return;
    if (!navigator?.mediaDevices?.getUserMedia) {
      setError("Microphone not supported on this device");
      return;
    }

    setError("");

    try {
      // If a preview is already present, discard it before new recording
      if (recordedBlob) {
        setRecordedBlob(null);
        setRecordDuration(0);
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      // NOTE: We keep mimeType as in your current file.
      const recorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        try {
          if (!chunksRef.current.length) return;
          const blob = new Blob(chunksRef.current, {
            type: "audio/webm",
          });
          setRecordedBlob(blob);
          chunksRef.current = [];
        } catch {
          // ignore
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;

      setIsRecording(true);
      setRecordDuration(0);

      // Start timer (visual + cap)
      timerRef.current = setInterval(() => {
        setRecordDuration((d) => {
          const next = d + 1;
          if (next >= MAX_AUDIO_SECONDS) {
            // stop at cap
            stopRecording();
            return MAX_AUDIO_SECONDS;
          }
          return next;
        });
      }, 1000);
    } catch (e) {
      setError(e?.message || "Could not start recording");
    }
  }

  function stopRecording() {
    if (!mediaRecorderRef.current) {
      setIsRecording(false);
      return;
    }

    try {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    } catch {
      // ignore
    }

    mediaRecorderRef.current = null;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsRecording(false);
  }

  function discardRecording() {
    // Stop recorder if still running
    try {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
        mediaRecorderRef.current = null;
      }
    } catch {
      // ignore
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    chunksRef.current = [];
    setIsRecording(false);
    setRecordedBlob(null);
    setRecordDuration(0);
    setSendingAudio(false);
  }

  async function sendRecordedAudio() {
    if (!user?.id) return;
    if (!recordedBlob) return;
    if (sendingAudio) return;

    setSendingAudio(true);
    setError("");

    const tempId = `local-${Date.now()}`;

    try {
      const path = audioPath(friendId, user.id);

      const { error: uploadErr } = await supabase.storage
        .from("chat-audio")
        .upload(path, recordedBlob, {
          contentType: "audio/webm",
          upsert: false,
        });

      if (uploadErr) {
        setError(uploadErr.message);
        setSendingAudio(false);
        return;
      }

      const { data } = supabase.storage
        .from("chat-audio")
        .getPublicUrl(path);

      if (!data?.publicUrl) {
        setError("Audio URL unavailable");
        setSendingAudio(false);
        return;
      }

      // OPTIMISTIC INSERT (so it is NEVER invisible)
      const optimistic = {
        id: tempId,
        sender_id: user.id,
        receiver_id: friendId,
        audio_url: data.publicUrl,
        audio_duration: recordDuration,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimistic]);

      // Insert real message row
      // Note: not guessing schema — same fields you already use.
      const { data: inserted, error: insertErr } = await supabase
        .from("messages")
        .insert({
          sender_id: user.id,
          receiver_id: friendId,
          audio_url: data.publicUrl,
          audio_duration: recordDuration,
        })
        .select("*")
        .single();

      if (insertErr) {
        setError(insertErr.message);
        setMessages((prev) => prev.filter((x) => x.id !== tempId));
        setSendingAudio(false);
        return;
      }

      // Replace optimistic with real immediately
      if (inserted?.id) {
        setMessages((prev) => {
          const idx = prev.findIndex((x) => x.id === tempId);
          if (idx < 0) return prev;
          const copy = [...prev];
          copy[idx] = inserted;
          return copy;
        });
      }

      // Clear preview
      setRecordedBlob(null);
      setRecordDuration(0);
      setSendingAudio(false);
    } catch (e) {
      setError(e?.message || "Audio send failed");
      setMessages((prev) => prev.filter((x) => x.id !== tempId));
      setSendingAudio(false);
    }
  }

  // ============================================================
  // DELETE MESSAGE (HOLD)
  // ============================================================

  function startHold(m) {
    if (!user?.id) return;
    if (m.sender_id !== user.id) return;

    holdTimer.current = setTimeout(() => {
      setDeleteTarget(m);
    }, 500);
  }

  function endHold() {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    try {
      await supabase
        .from("messages")
        .delete()
        .eq("id", deleteTarget.id);

      setMessages((prev) => prev.filter((x) => x.id !== deleteTarget.id));
    } catch {
      // ignore
    }

    setDeleteTarget(null);
  }

  // ============================================================
  // RENDER
  // ============================================================

  if (loading) {
    return <div style={loadingWrap}>Loading…</div>;
  }

  const ringProgress = isRecording
    ? recordDuration / MAX_AUDIO_SECONDS
    : 0;

  return (
    <div style={shell}>
      {/* HEADER */}
      <div style={header}>
        <button
          onClick={() => navigate("/friends")}
          style={backBtn}
          aria-label="Back"
        >
          <FiArrowLeft size={20} />
        </button>

        <div style={headerTextWrap}>
          <strong style={headerName}>{friendName}</strong>
          {friendStatus && (
            <span style={friendStatusText}>{friendStatus}</span>
          )}
        </div>
      </div>

      {/* MESSAGES */}
      <div ref={listRef} style={messagesBox}>
        {error && <div style={errBox}>{error}</div>}

        {messages.map((m) => {
          const mine = user?.id && m.sender_id === user.id;
          const share = extractWorkoutShare(m);

          return (
            <div
              key={m.id}
              style={mine ? messageRowMine : messageRow}
            >
              <div
                onTouchStart={() => startHold(m)}
                onTouchEnd={endHold}
                onTouchCancel={endHold}
                style={mine ? bubbleMine : bubble}
              >
                {/* WORKOUT SHARE OR TEXT */}
                {share ? (
                  <WorkoutShareCard share={share} />
                ) : (
                  m.text && <div style={messageText}>{m.text}</div>
                )}

                {/* IMAGE */}
                {m.image_url && (
                  <img
                    src={m.image_url}
                    style={imageThumb}
                    onClick={() => setImageView(m.image_url)}
                    alt="Sent image"
                  />
                )}

                {/* VIDEO */}
                {m.video_url && (
                  <video
                    src={m.video_url}
                    controls
                    playsInline
                    preload="metadata"
                    style={videoPlayer}
                  />
                )}

                {/* AUDIO */}
                {m.audio_url && (
                  <div style={audioWrap}>
                    <audio
                      src={m.audio_url}
                      controls
                      preload="metadata"
                      style={audioPlayer}
                    />
                    {m.audio_duration != null && (
                      <div style={audioMeta}>
                        {formatMMSS(m.audio_duration)}
                      </div>
                    )}
                  </div>
                )}

                <div style={timestamp}>{formatTime(m.created_at)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* INPUT — STRICTLY VERTICAL / TALL */}
      <div style={inputBar}>
        {/* ATTACHMENTS (STACKED) */}
        <label style={attachBtn}>
          <div style={attachInner}>
            <FiImage size={20} />
            <span style={attachText}>Send Photo</span>
          </div>
          <input
            hidden
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = null;
              if (file) sendImage(file);
            }}
          />
        </label>

        <label style={attachBtn}>
          <div style={attachInner}>
            <FiVideo size={20} />
            <span style={attachText}>Send Video</span>
          </div>
          <input
            hidden
            type="file"
            accept="video/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = null;
              if (file) sendVideo(file);
            }}
          />
        </label>

        {/* AUDIO PANEL */}
        <div style={audioPanel}>
          {/* STATE: idle */}
          {!isRecording && !recordedBlob && (
            <button
              onClick={startRecording}
              style={micBtn}
              aria-label="Record audio"
            >
              <FiMic size={22} />
              <span style={micText}>Record Voice Memo (30s)</span>
            </button>
          )}

          {/* STATE: recording */}
          {isRecording && (
            <div style={recordingPanel}>
              <div style={ringWrap}>
                <CircularProgressRing
                  size={72}
                  stroke={6}
                  progress={ringProgress}
                />
                <div style={ringCenterText}>
                  {formatMMSS(recordDuration)}
                </div>
              </div>

              <div style={recordingHint}>Recording…</div>

              <button
                onClick={stopRecording}
                style={stopBtn}
                aria-label="Stop recording"
              >
                <FiStopCircle size={22} />
                <span style={stopText}>Stop</span>
              </button>

              <button
                onClick={discardRecording}
                style={discardBtn}
                aria-label="Discard recording"
              >
                <FiX size={20} />
                <span style={discardText}>Cancel</span>
              </button>
            </div>
          )}

          {/* STATE: preview */}
          {recordedBlob && !isRecording && (
            <div style={previewPanel}>
              <div style={previewHeader}>Preview</div>

              {previewUrl ? (
                <audio
                  src={previewUrl}
                  controls
                  preload="metadata"
                  style={previewAudio}
                />
              ) : (
                <div style={previewMissing}>Preview unavailable</div>
              )}

              <div style={previewMeta}>
                Duration: {formatMMSS(recordDuration)}
              </div>

              <button
                onClick={sendRecordedAudio}
                disabled={sendingAudio}
                style={sendAudioBtn}
              >
                <FiSend size={20} />
                <span style={sendAudioText}>
                  {sendingAudio ? "Sending…" : "Send Voice Memo"}
                </span>
              </button>

              <button
                onClick={discardRecording}
                disabled={sendingAudio}
                style={redoBtn}
              >
                <FiRefreshCcw size={18} />
                <span style={redoText}>Discard & Re-record</span>
              </button>
            </div>
          )}
        </div>

        {/* TEXT INPUT (STACKED) */}
        <div style={textPanel}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message…"
            style={input}
          />

          <button
            onClick={sendMessage}
            style={sendBtn}
            aria-label="Send message"
          >
            <FiSend size={20} />
            <span style={sendText}>Send</span>
          </button>
        </div>
      </div>

      {/* DELETE CONFIRM */}
      {deleteTarget && (
        <div style={deleteOverlay}>
          <div style={deleteModal}>
            <FiTrash2 size={28} color="#ff2f2f" />
            <div style={deleteTitle}>Delete message?</div>
            <div style={deleteSub}>This can’t be undone.</div>

            <div style={deleteActions}>
              <button
                style={cancelBtn}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button style={deleteBtn} onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMAGE VIEW */}
      {imageView && (
        <div
          style={imageOverlay}
          onClick={() => setImageView(null)}
        >
          <img src={imageView} style={imageFull} alt="Full" />
          <FiX size={28} style={closeIcon} />
        </div>
      )}
    </div>
  );
}

// ============================================================
// STYLES — VERTICAL, CLEAN, SAFE (NO SINGLE-LINE CONST BLOBS)
// ============================================================

const loadingWrap = {
  color: "#fff",
  padding: 20,
};

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

const headerTextWrap = {
  display: "flex",
  flexDirection: "column",
};

const headerName = {
  fontSize: 16,
  lineHeight: "18px",
};

const friendStatusText = {
  fontSize: 12,
  opacity: 0.85,
};

const backBtn = {
  background: "rgba(255,255,255,0.2)",
  border: "none",
  borderRadius: 18,
  width: 36,
  height: 36,
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

// messagesBox bottom is LARGE so the tall input never overlaps
const messagesBox = {
  position: "absolute",
  top: 56,
  left: 0,
  right: 0,
  bottom: 340,
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
  overscrollBehavior: "contain",
  padding: 12,
};

const messageRow = {
  display: "flex",
  justifyContent: "flex-start",
  marginBottom: 10,
};

const messageRowMine = {
  display: "flex",
  justifyContent: "flex-end",
  marginBottom: 10,
};

const bubble = {
  background: "#1a1a1a",
  color: "#fff",
  padding: 12,
  borderRadius: 16,
  maxWidth: "78%",
};

const bubbleMine = {
  background: "#ff2f2f",
  color: "#fff",
  padding: 12,
  borderRadius: 16,
  maxWidth: "78%",
};

const messageText = {
  fontSize: 16,
  whiteSpace: "pre-wrap",
};

const timestamp = {
  fontSize: 10,
  opacity: 0.7,
  marginTop: 6,
};

const imageThumb = {
  marginTop: 6,
  borderRadius: 12,
  maxWidth: "100%",
  maxHeight: 220,
  cursor: "pointer",
};

const videoPlayer = {
  marginTop: 6,
  borderRadius: 12,
  maxWidth: "100%",
  background: "#000",
};

const audioWrap = {
  marginTop: 8,
  width: "100%",
};

const audioPlayer = {
  width: "100%",
};

const audioMeta = {
  marginTop: 4,
  fontSize: 11,
  opacity: 0.8,
};

// INPUT — STRICTLY TALL / VERTICAL
const inputBar = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  background: "#000",
  borderTop: "1px solid #222",
  padding: "14px 12px",
  paddingBottom: "calc(14px + env(safe-area-inset-bottom))",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

// attachments as full-width buttons (no horizontal flex row)
const attachBtn = {
  width: "100%",
  height: 52,
  borderRadius: 16,
  background: "#0f0f0f",
  border: "1px solid #222",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const attachInner = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
};

const attachText = {
  fontSize: 12,
  opacity: 0.9,
  fontWeight: 800,
};

const audioPanel = {
  width: "100%",
  background: "#0b0b0b",
  border: "1px solid #222",
  borderRadius: 16,
  padding: 12,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const micBtn = {
  width: "100%",
  height: 58,
  borderRadius: 16,
  background: "#ff2f2f",
  border: "none",
  color: "#fff",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  fontWeight: 900,
};

const micText = {
  fontSize: 12,
  opacity: 0.95,
};

const recordingPanel = {
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 10,
};

const ringWrap = {
  position: "relative",
  width: 72,
  height: 72,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const ringSvg = {
  display: "block",
};

const ringCenterText = {
  position: "absolute",
  color: "#fff",
  fontWeight: 900,
  fontSize: 12,
};

const recordingHint = {
  fontSize: 12,
  opacity: 0.85,
  fontWeight: 800,
  color: "#fff",
};

const stopBtn = {
  width: "100%",
  height: 54,
  borderRadius: 16,
  background: "#ff2f2f",
  border: "none",
  color: "#fff",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  fontWeight: 900,
};

const stopText = {
  fontSize: 12,
  opacity: 0.95,
};

const discardBtn = {
  width: "100%",
  height: 50,
  borderRadius: 16,
  background: "#151515",
  border: "1px solid #2a2a2a",
  color: "#fff",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  fontWeight: 900,
  opacity: 0.95,
};

const discardText = {
  fontSize: 12,
  opacity: 0.9,
};

const previewPanel = {
  width: "100%",
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const previewHeader = {
  fontWeight: 900,
  fontSize: 13,
  opacity: 0.95,
};

const previewAudio = {
  width: "100%",
};

const previewMissing = {
  padding: 10,
  borderRadius: 12,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#fff",
  fontSize: 12,
};

const previewMeta = {
  fontSize: 12,
  opacity: 0.85,
};

const sendAudioBtn = {
  width: "100%",
  height: 56,
  borderRadius: 16,
  background: "#ff2f2f",
  border: "none",
  color: "#fff",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  fontWeight: 900,
};

const sendAudioText = {
  fontSize: 12,
  opacity: 0.95,
};

const redoBtn = {
  width: "100%",
  height: 52,
  borderRadius: 16,
  background: "#151515",
  border: "1px solid #2a2a2a",
  color: "#fff",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  fontWeight: 900,
};

const redoText = {
  fontSize: 12,
  opacity: 0.9,
};

const textPanel = {
  width: "100%",
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const input = {
  width: "100%",
  height: 56,
  borderRadius: 16,
  border: "1px solid #333",
  background: "#111",
  color: "#fff",
  padding: "0 14px",
  fontSize: 16,
};

const sendBtn = {
  width: "100%",
  height: 56,
  borderRadius: 16,
  background: "#ff2f2f",
  border: "none",
  color: "#fff",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  fontWeight: 900,
};

const sendText = {
  fontSize: 12,
  opacity: 0.95,
};

const errBox = {
  background: "rgba(255,47,47,0.25)",
  padding: 10,
  borderRadius: 12,
  marginBottom: 10,
};

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

const deleteTitle = {
  fontWeight: 900,
  fontSize: 18,
};

const deleteSub = {
  opacity: 0.8,
};

// vertical actions (no horizontal row)
const deleteActions = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  width: "100%",
};

const cancelBtn = {
  width: "100%",
  padding: "14px",
  borderRadius: 14,
  background: "#222",
  color: "#fff",
  border: "none",
  fontWeight: 800,
};

const deleteBtn = {
  width: "100%",
  padding: "14px",
  borderRadius: 14,
  background: "#ff2f2f",
  color: "#fff",
  border: "none",
  fontWeight: 900,
};

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

const workoutCard = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const workoutTitle = {
  fontWeight: 900,
};

const workoutRow = {
  fontSize: 13,
  opacity: 0.9,
};

const workoutRowMuted = {
  fontSize: 13,
  opacity: 0.6,
};
