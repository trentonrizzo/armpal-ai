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
   TIME HELPERS
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
  if (diffDay === 1) return "yesterday";
  return `${diffDay}d ago`;
}

/* ============================================================
   AUDIO HELPERS
============================================================ */

const MAX_AUDIO_SECONDS = 30;

function getAudioPath({ chatId, userId }) {
  return `chat-audio/${chatId}/${userId}/${Date.now()}.webm`;
}

/* ============================================================
   WORKOUT SHARE HELPERS
============================================================ */

function tryParseJSON(val) {
  if (!val) return null;
  if (typeof val === "object") return val;
  if (typeof val !== "string") return null;
  const s = val.trim();
  if (!s.startsWith("{") && !s.startsWith("[")) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function extractWorkoutShareFromMessage(m) {
  const fields = [m.text, m.message, m.body, m.payload, m.data];
  for (const f of fields) {
    const parsed = tryParseJSON(f);
    if (parsed?.type === "workout_share") return parsed;
  }
  return null;
}

function WorkoutShareCard({ share, mine, onSave, saving }) {
  const workoutName = share?.workout?.name || "Workout";
  const exercises = Array.isArray(share?.exercises) ? share.exercises : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontWeight: 900 }}>📋 {workoutName}</div>
      {exercises.slice(0, 6).map((ex, i) => (
        <div key={i} style={{ fontSize: 13, opacity: 0.9 }}>
          • {ex.name}
        </div>
      ))}
      <button
        onClick={onSave}
        disabled={saving}
        style={{
          marginTop: 6,
          padding: "8px 10px",
          borderRadius: 10,
          background: mine ? "#000" : "#ff2f2f",
          color: "#fff",
          border: "none",
          fontWeight: 800,
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? "Saving…" : "Save to My Workouts"}
      </button>
    </div>
  );
}

/* ============================================================
   VIDEO FALLBACK
============================================================ */

function extractInlineVideoUrl(m) {
  if (m.video_url) return m.video_url;
  if (m.text?.startsWith("VIDEO:")) {
    const u = m.text.replace("VIDEO:", "").trim();
    if (u.startsWith("http")) return u;
  }
  return null;
}

/* ============================================================
   MAIN COMPONENT — STATE
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
  const [toast, setToast] = useState("");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [savingWorkoutKey, setSavingWorkoutKey] = useState(null);

  const listRef = useRef(null);
  const holdTimer = useRef(null);

  /* presence */
  const idleTimer = useRef(null);
  const heartbeatTimer = useRef(null);
  const isOnlineRef = useRef(false);

  /* audio */
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordDuration, setRecordDuration] = useState(0);
  const [sendingAudio, setSendingAudio] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  /* ============================================================
     CONTINUES IN PART 2
  ============================================================ */
  /* ============================================================
     FRIEND PRESENCE + DERIVED LABELS
  ============================================================ */

  const friendName =
    friend?.display_name || friend?.username || "Chat";

  const friendOnline =
    !!friend?.is_online &&
    friend?.last_seen &&
    Date.now() - new Date(friend.last_seen).getTime() <= 60 * 1000;

  const friendStatus = friendOnline
    ? "Online"
    : friend?.last_seen
    ? `Last seen ${timeAgo(friend.last_seen)}`
    : "";

  /* ============================================================
     LOAD USER / FRIEND / MESSAGES
  ============================================================ */

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);

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

  /* ============================================================
     REALTIME MESSAGE INSERTS
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
            (m.sender_id === user.id &&
              m.receiver_id === friendId) ||
            (m.sender_id === friendId &&
              m.receiver_id === user.id);

          if (!match) return;

          setMessages((prev) =>
            prev.some((x) => x.id === m.id)
              ? prev
              : [...prev, m]
          );
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user, friendId]);

  /* ============================================================
     FRIEND PRESENCE REALTIME
  ============================================================ */

  useEffect(() => {
    if (!friendId) return;

    const ch = supabase
      .channel(`presence-${friendId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
        },
        (payload) => {
          const p = payload.new;
          if (p?.id !== friendId) return;
          setFriend((prev) => ({ ...(prev || {}), ...p }));
        }
      )
      .subscribe();

    return () => supabase.removeChannel(ch);
  }, [friendId]);

  /* ============================================================
     AUTO SCROLL
  ============================================================ */

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop =
        listRef.current.scrollHeight;
    }
  }, [messages]);

  /* ============================================================
     DELETE — HOLD TO ACTIVATE
  ============================================================ */

  function startHold(m) {
    if (m.sender_id !== user?.id) return;
    holdTimer.current = setTimeout(
      () => setDeleteTarget(m),
      500
    );
  }

  function endHold() {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }

  async function confirmDeleteMessage() {
    if (!deleteTarget) return;

    await supabase
      .from("messages")
      .delete()
      .eq("id", deleteTarget.id);

    setMessages((prev) =>
      prev.filter((x) => x.id !== deleteTarget.id)
    );

    setDeleteTarget(null);
  }

  /* ============================================================
     SAVE WORKOUT SHARE
  ============================================================ */

  async function saveSharedWorkout(share, messageId) {
    if (!user?.id || !share?.workout?.name) return;

    const key = `${messageId}-${share.workout.name}`;
    setSavingWorkoutKey(key);
    setError("");

    try {
      const { data: existing, error: e1 } =
        await supabase
          .from("workouts")
          .select("id")
          .eq("user_id", user.id);

      if (e1) throw e1;

      const position = (existing || []).length;

      const { data: inserted, error: e2 } =
        await supabase
          .from("workouts")
          .insert({
            user_id: user.id,
            name: share.workout.name,
            position,
          })
          .select("id")
          .single();

      if (e2) throw e2;

      const workoutId = inserted.id;

      const exercises = Array.isArray(
        share.exercises
      )
        ? share.exercises
        : [];

      if (exercises.length) {
        const rows = exercises.map(
          (ex, idx) => ({
            user_id: user.id,
            workout_id: workoutId,
            name: ex.name || "Exercise",
            sets:
              ex.sets === "" || ex.sets == null
                ? null
                : Number(ex.sets),
            reps:
              ex.reps === "" || ex.reps == null
                ? null
                : Number(ex.reps),
            weight: ex.weight ?? null,
            position: idx,
          })
        );

        const { error: e3 } =
          await supabase
            .from("exercises")
            .insert(rows);

        if (e3) throw e3;
      }

      setToast("✅ Saved to your workouts");
    } catch (e) {
      setError(e.message || "Save failed");
    } finally {
      setSavingWorkoutKey(null);
    }
  }

  /* ============================================================
     AUDIO RECORD CONTROL
  ============================================================ */

  async function startRecording() {
    if (isRecording) return;
    setError("");

    const stream =
      await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

    const recorder = new MediaRecorder(stream, {
      mimeType: "audio/webm",
    });

    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data?.size)
        chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: "audio/webm",
      });
      setRecordedBlob(blob);
      chunksRef.current = [];
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    setRecordDuration(0);

    timerRef.current = setInterval(() => {
      setRecordDuration((d) => {
        if (d + 1 >= MAX_AUDIO_SECONDS) {
          stopRecording();
          return MAX_AUDIO_SECONDS;
        }
        return d + 1;
      });
    }, 1000);
  }

  function stopRecording() {
    if (!mediaRecorderRef.current) return;

    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream
      .getTracks()
      .forEach((t) => t.stop());

    mediaRecorderRef.current = null;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsRecording(false);
  }

  function cancelRecording() {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((t) => t.stop());
      mediaRecorderRef.current = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    chunksRef.current = [];
    setRecordedBlob(null);
    setIsRecording(false);
    setRecordDuration(0);
  }

  async function sendRecordedAudio() {
    if (!recordedBlob || sendingAudio) return;

    setSendingAudio(true);
    setError("");

    try {
      const path = getAudioPath({
        chatId: friendId,
        userId: user.id,
      });

      const { error: upErr } =
        await supabase.storage
          .from("chat-audio")
          .upload(path, recordedBlob, {
            contentType: "audio/webm",
          });

      if (upErr) throw upErr;

      const { data } =
        supabase.storage
          .from("chat-audio")
          .getPublicUrl(path);

      await supabase.from("messages").insert({
        sender_id: user.id,
        receiver_id: friendId,
        audio_url: data.publicUrl,
        audio_duration: recordDuration,
      });

      setRecordedBlob(null);
      setRecordDuration(0);
    } catch (e) {
      setError(e.message || "Audio send failed");
    } finally {
      setSendingAudio(false);
    }
  }

  /* ============================================================
     CONTINUES IN PART 3
  ============================================================ */
  /* ============================================================
     RENDER
  ============================================================ */

  if (loading) {
    return (
      <div style={{ color: "#fff", padding: 20 }}>
        Loading…
      </div>
    );
  }

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
                background: friendOnline
                  ? "#2dff57"
                  : "rgba(255,255,255,0.3)",
                boxShadow: friendOnline
                  ? "0 0 8px rgba(45,255,87,0.9)"
                  : "none",
              }}
            />
          </div>
          {friendStatus && (
            <span style={{ fontSize: 12, opacity: 0.8 }}>
              {friendStatus}
            </span>
          )}
        </div>
      </div>

      {/* MESSAGES */}
      <div ref={listRef} style={messagesBox}>
        {error && <div style={errBox}>{error}</div>}

        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          const share = extractWorkoutShareFromMessage(m);
          const videoUrl = extractInlineVideoUrl(m);
          const saving =
            savingWorkoutKey ===
            `${m.id}-${share?.workout?.name || ""}`;

          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                justifyContent: mine ? "flex-end" : "flex-start",
                marginBottom: 10,
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
                  position: "relative",
                }}
              >
                {/* WORKOUT SHARE */}
                {share ? (
                  <WorkoutShareCard
                    share={share}
                    mine={mine}
                    saving={saving}
                    onSave={() =>
                      saveSharedWorkout(share, m.id)
                    }
                  />
                ) : (
                  <>
                    {m.text &&
                      !m.text.startsWith("VIDEO:") && (
                        <div>{m.text}</div>
                      )}
                  </>
                )}

                {/* AUDIO */}
                {m.audio_url && (
                  <div style={{ marginTop: 8 }}>
                    <audio
                      src={m.audio_url}
                      controls
                      preload="metadata"
                      style={{ width: "100%" }}
                    />
                    {m.audio_duration && (
                      <div
                        style={{
                          fontSize: 11,
                          opacity: 0.7,
                          marginTop: 2,
                        }}
                      >
                        {m.audio_duration}s
                      </div>
                    )}
                  </div>
                )}

                {/* IMAGE */}
                {m.image_url && (
                  <img
                    src={m.image_url}
                    onClick={() =>
                      setImageView(m.image_url)
                    }
                    style={{
                      marginTop: 6,
                      borderRadius: 12,
                      maxHeight: 220,
                      maxWidth: "100%",
                      cursor: "pointer",
                    }}
                  />
                )}

                {/* VIDEO */}
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

                <div
                  style={{
                    fontSize: 10,
                    opacity: 0.7,
                    marginTop: 6,
                  }}
                >
                  {formatTime(m.created_at)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

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
              if (file) sendImage(file);
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
              if (file) sendVideo(file);
            }}
          />
        </label>

        {/* AUDIO CONTROLS */}
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
            <button
              onClick={cancelRecording}
              style={cancelAudioBtn}
            >
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

        {/* TEXT */}
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

      {/* DELETE CONFIRM */}
      {deleteTarget && (
        <div style={deleteOverlay}>
          <div style={deleteModal}>
            <FiTrash2 size={28} color="#ff2f2f" />
            <div style={{ fontWeight: 900, fontSize: 18 }}>
              Delete message?
            </div>
            <div style={{ opacity: 0.8 }}>
              This can’t be undone.
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                width: "100%",
              }}
            >
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
        <div
          style={imageOverlay}
          onClick={() => setImageView(null)}
        >
          <img src={imageView} style={imageFull} />
          <FiX size={28} style={closeIcon} />
        </div>
      )}
    </div>
  );
}
/* ============================================================
   AUDIO BUTTON STYLES
============================================================ */

const micBtn = {
  width: 44,
  height: 44,
  borderRadius: 12,
  background: "#222",
  border: "none",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const stopBtn = {
  width: 44,
  height: 44,
  borderRadius: 12,
  background: "#ff2f2f",
  border: "none",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const cancelAudioBtn = {
  width: 36,
  height: 36,
  borderRadius: 10,
  background: "#333",
  border: "none",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const sendAudioBtn = {
  width: 36,
  height: 36,
  borderRadius: 10,
  background: "#ff2f2f",
  border: "none",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

/* ============================================================
   DELETE MODAL
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
   BASE CHAT LAYOUT
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
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
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
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
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
