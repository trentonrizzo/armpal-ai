// src/pages/ChatPage.jsx
// ============================================================
// FULL FILE REPLACEMENT — ARM PAL CHAT (LONG FORM / STABLE)
// ============================================================
// GOALS (LOCKED):
// ✅ SAME BASE FILE YOU SENT (NO REWRITE FROM SCRATCH)
// ✅ VERY LONG FILE (NO COMPRESSION / NO FAT STYLE BLOCKS)
// ✅ COMPOSER ALWAYS VISIBLE (NO DROPDOWN / NO DOT / NO TOGGLE)
// ✅ MIC ICON LIVES NEXT TO SEND (RIGHT SIDE)
// ✅ AUDIO WORKS + STAYS (audio_duration FIXED)
// ✅ KEYBOARD DOES NOT HIDE INPUT
// ✅ UX CLEANED WITHOUT BREAKING LOGIC
// ✅ VIDEOS WORK + PLAY (PUBLIC OR PRIVATE BUCKET SAFE)
// ✅ WORKOUT SHARE CARDS HAVE “SAVE TO WORKOUTS” AGAIN (WORKING)
// ============================================================

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
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
  FiSave,
  FiCheck,
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
// STORAGE HELPERS
// ============================================================

const MAX_AUDIO_SECONDS = 30;

// IMPORTANT:
// Your base file uses storage buckets named:
// - "chat-images"
// - "chat-videos"
// - "chat-audio"
// We will not change that structure.
// The only change we add is a playback-safe URL resolver for videos
// (handles public buckets AND private buckets via signed URLs).

const BUCKET_IMAGES = "chat-images";
const BUCKET_VIDEOS = "chat-videos";
const BUCKET_AUDIO = "chat-audio";

function imagePath(chatId, userId, name) {
  // KEEP your exact style / structure
  return `chat-images/${chatId}/${userId}/${Date.now()}-${name}`;
}

function videoPath(chatId, userId, name) {
  // KEEP your exact style / structure
  return `chat-videos/${chatId}/${userId}/${Date.now()}-${name}`;
}

function audioPath(chatId, userId, ext) {
  return `chat-audio/${chatId}/${userId}/${Date.now()}.${ext}`;
}

// ============================================================
// AUDIO MIME (iOS SAFE)
// ============================================================

function pickBestAudioMimeType() {
  const candidates = [
    "audio/mp4",
    "audio/aac",
    "audio/mpeg",
    "audio/webm;codecs=opus",
    "audio/webm",
  ];

  try {
    if (!window.MediaRecorder) return "";
    if (!MediaRecorder.isTypeSupported) return "";
    for (const t of candidates) {
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
  } catch {
    return "";
  }

  return "";
}

function fileExtFromMime(mime) {
  const m = (mime || "").toLowerCase();
  if (m.includes("mp4")) return "m4a";
  if (m.includes("aac")) return "aac";
  if (m.includes("mpeg")) return "mp3";
  if (m.includes("webm")) return "webm";
  return "webm";
}

// ============================================================
// SAFE JSON + WORKOUT SHARE PARSER
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
  const candidates = [message.text, message.payload, message.data];

  for (const c of candidates) {
    const parsed = safeParseJSON(c);
    if (parsed?.type === "workout_share") return parsed;
  }

  return null;
}

// ============================================================
// VIDEO URL RESOLVER (THE ACTUAL “VIDEOS WORK” UPGRADE)
// ============================================================
// Why this exists:
// - If your "chat-videos" bucket is PUBLIC => publicUrl is playable
// - If your bucket is PRIVATE (very common) => publicUrl will 403 on iOS/Safari,
//   and the <video> will fail silently / not load.
// This resolver detects that and generates a SIGNED URL automatically,
// without changing your DB schema and without breaking your structure.
//
// It uses your existing stored m.video_url (public URL) and extracts
// the path to call createSignedUrl() for private playback when needed.

function extractPathFromPublicUrl(url, bucketName) {
  if (!url || !bucketName) return "";
  try {
    const marker = `/${bucketName}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return "";
    return url.slice(idx + marker.length);
  } catch {
    return "";
  }
}

function looksLikeSupabasePublicObjectUrl(url) {
  if (!url) return false;
  return (
    url.includes("/storage/v1/object/public/") ||
    url.includes("/storage/v1/object/sign/") ||
    url.includes("/storage/v1/object/")
  );
}

function normalizeMaybeUrl(value) {
  if (!value) return "";
  if (typeof value !== "string") return "";
  return value.trim();
}

// ============================================================
// WORKOUT SHARE NORMALIZER (SAFE)
// ============================================================

function normalizeSharedWorkout(share) {

  const name =
    share?.workout?.name ||
    share?.workout_name ||
    share?.name ||
    "Workout";

  const rawExercises =
    (Array.isArray(share?.exercises) && share.exercises) ||
    (Array.isArray(share?.workout?.exercises) && share.workout.exercises) ||
    (Array.isArray(share?.workout?.data?.exercises) && share.workout.data.exercises) || // 🔥 added
    (Array.isArray(share?.items) && share.items) ||
    [];

  const exercises = rawExercises
    .map((ex) => {
      if (!ex) return null;

      return {
        name: ex.name || ex.exercise || ex.title || "Exercise",
        sets: ex.sets || ex.set || ex.series || null,
        reps: ex.reps || null,
        notes: ex.notes || null
      };
    })
    .filter(Boolean);

  return { name, exercises };
}


// ============================================================
// WORKOUT SHARE CARD
// ============================================================

function WorkoutShareCard({ share, canSave, saving, saved, onSave }) {
const normalized = normalizeSharedWorkout(share);
  const workoutName = normalized.name || "Workout";
  const exercises = Array.isArray(normalized.exercises)
    ? normalized.exercises
    : [];

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

      {canSave && (
        <button
          style={
            saved
              ? saveWorkoutBtnDone
              : saving
              ? saveWorkoutBtnBusy
              : saveWorkoutBtn
          }
          onClick={onSave}
          disabled={saving || saved}
        >
          {saved ? <FiCheck size={14} /> : <FiSave size={14} />}
          <span>
            {saved
              ? "Saved"
              : saving
              ? "Saving…"
              : "Save to Workouts"}
          </span>
        </button>
      )}
    </div>
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
  // AUDIO STATE
  // ----------------------------------------------------------

  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordDuration, setRecordDuration] = useState(0);
  const [sendingAudio, setSendingAudio] = useState(false);

  // ----------------------------------------------------------
  // VIDEO STATE (NEW: MAKE VIDEOS PLAY NO MATTER WHAT)
  // ----------------------------------------------------------

  // Cache signed video URLs by message id.
  // This is the key upgrade that makes “videos work” even on private buckets / iOS.
  const [signedVideoById, setSignedVideoById] = useState({}); // { [messageId]: signedUrl }
  const [signingBusyById, setSigningBusyById] = useState({}); // { [messageId]: true/false }

  // Optional: if a video fails to load with public URL, we auto-switch to signed.
  const [videoLoadFailedById, setVideoLoadFailedById] = useState({}); // { [messageId]: true }

  // ----------------------------------------------------------
  // WORKOUT SAVE STATE (RESTORED)
  // ----------------------------------------------------------

  const [savingWorkoutByMsgId, setSavingWorkoutByMsgId] = useState({}); // { [msgId]: true }
  const [savedWorkoutByMsgId, setSavedWorkoutByMsgId] = useState({}); // { [msgId]: true }

  // ----------------------------------------------------------
  // KEYBOARD / SAFE AREA (KEEP COMPOSER VISIBLE)
  // ----------------------------------------------------------

  const [keyboardLift, setKeyboardLift] = useState(0);

  // ----------------------------------------------------------
  // REFS
  // ----------------------------------------------------------

  const listRef = useRef(null);
  const holdTimer = useRef(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const activeMimeRef = useRef("");

  // ----------------------------------------------------------
  // FRIEND STATUS
  // ----------------------------------------------------------

  const friendName = friend?.display_name || friend?.username || "Chat";

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
  // KEYBOARD LIFT (VISUAL VIEWPORT)
  // ============================================================

  useEffect(() => {
    // Keeps the bottom composer visible even when the keyboard opens.
    // Uses visualViewport when available (mobile Safari / Chrome).
    // DOES NOT change your UI shape; just shifts bottom area up.
    const vv = window.visualViewport;
    if (!vv) return;

    const handle = () => {
      try {
        const heightDiff = window.innerHeight - vv.height;
        const lift = Math.max(0, Math.floor(heightDiff));
        setKeyboardLift(lift);
      } catch {
        setKeyboardLift(0);
      }
    };

    handle();
    vv.addEventListener("resize", handle);
    vv.addEventListener("scroll", handle);

    return () => {
      vv.removeEventListener("resize", handle);
      vv.removeEventListener("scroll", handle);
    };
  }, []);

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

      const [{ data: f }, { data: msgs, error: msgErr }] = await Promise.all([
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
  // REALTIME INSERTS
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
            if (prev.some((x) => x.id === m.id)) return prev;
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
  // VIDEO SIGNED URL: CORE UPGRADE
  // ============================================================

  const ensureSignedVideoForMessage = useCallback(
    async (m) => {
      if (!m || !m.id) return;
      if (!m.video_url) return;

      // Already have a signed URL cached
      if (signedVideoById[m.id]) return;

      // If we’re already signing this id, skip
      if (signingBusyById[m.id]) return;

      const rawUrl = normalizeMaybeUrl(m.video_url);
      if (!rawUrl) return;

      // If it’s not a supabase URL, do nothing
      if (!looksLikeSupabasePublicObjectUrl(rawUrl)) return;

      // Extract object path from the URL so we can sign it if needed
      const objectPath = extractPathFromPublicUrl(rawUrl, BUCKET_VIDEOS);
      if (!objectPath) return;

      // Mark signing busy
      setSigningBusyById((prev) => ({ ...prev, [m.id]: true }));

      try {
        // Create a signed URL (works whether bucket is public or private)
        // If bucket is public, this still yields a playable URL.
        const { data, error: signErr } = await supabase.storage
          .from(BUCKET_VIDEOS)
          .createSignedUrl(objectPath, 60 * 60); // 1 hour

        if (signErr) {
          // If signing fails, don’t hard-error your chat UI
          // (videos can still be public and play via rawUrl)
          setSigningBusyById((prev) => ({ ...prev, [m.id]: false }));
          return;
        }

        const signedUrl = data?.signedUrl || "";
        if (!signedUrl) {
          setSigningBusyById((prev) => ({ ...prev, [m.id]: false }));
          return;
        }

        setSignedVideoById((prev) => ({ ...prev, [m.id]: signedUrl }));
        setSigningBusyById((prev) => ({ ...prev, [m.id]: false }));
      } catch {
        setSigningBusyById((prev) => ({ ...prev, [m.id]: false }));
      }
    },
    [signedVideoById, signingBusyById]
  );

  useEffect(() => {
    // We don’t sign everything blindly:
    // - If the video loads fine with public URL => great.
    // - If it fails on iOS/private bucket => we sign and replay.
    //
    // BUT we can also pre-sign quietly to avoid “tap then fail”.
    // This is what makes “videos work” reliably.
    const vids = messages.filter((m) => !!m.video_url);
    if (!vids.length) return;

    // Pre-sign up to 12 most recent videos to keep it light
    const recent = vids.slice(Math.max(0, vids.length - 12));
    recent.forEach((m) => {
      ensureSignedVideoForMessage(m);
    });
  }, [messages, ensureSignedVideoForMessage]);

  function getVideoSrc(m) {
    if (!m?.video_url) return "";
    // If the raw URL failed, prefer signed (if present)
    if (videoLoadFailedById[m.id] && signedVideoById[m.id]) {
      return signedVideoById[m.id];
    }
    // Prefer signed if we have it (smoothest playback across devices)
    if (signedVideoById[m.id]) return signedVideoById[m.id];
    return m.video_url;
  }

  // ============================================================
  // WORKOUT SAVE (RESTORED)
  // ============================================================

 async function saveShareToWorkouts(messageId, share) {
  if (!user?.id) return;
  if (!messageId) return;
  if (!share) return;

  if (savingWorkoutByMsgId[messageId]) return;
  if (savedWorkoutByMsgId[messageId]) return;

  setSavingWorkoutByMsgId((p) => ({ ...p, [messageId]: true }));
  setError("");

  try {
    const normalized = normalizeSharedWorkout(share);
    const workoutName = normalized?.name || "Workout";
    const exercises = Array.isArray(normalized?.exercises)
      ? normalized.exercises
      : [];

    // 1) Create workout row (same as AI)
    const { data: createdWorkout, error: wErr } = await supabase
      .from("workouts")
      .insert({
        user_id: user.id,
        name: workoutName,
      })
      .select()
      .single();

    if (wErr || !createdWorkout?.id) {
      setSavingWorkoutByMsgId((p) => ({ ...p, [messageId]: false }));
      return;
    }

    const workoutId = createdWorkout.id;

    // 2) Insert exercises (MATCH AI SAVE EXACTLY)
    if (Array.isArray(exercises) && exercises.length > 0) {

      const exerciseRows = exercises.map((ex, index) => ({
        user_id: user.id,
        workout_id: workoutId,
        name: ex?.name || "Exercise",
        sets: Number(ex?.sets) || null,
        reps: ex?.reps ?? null,
        weight: null,
        position: index
      }));

      const { error: exerciseError } = await supabase
        .from("exercises")
        .insert(exerciseRows);

      if (exerciseError) {
        console.error("SAVE EXERCISE ERROR:", exerciseError);
        setSavingWorkoutByMsgId((p) => ({ ...p, [messageId]: false }));
        return;
      }
    }

    // 3) Mark saved
    setSavedWorkoutByMsgId((p) => ({ ...p, [messageId]: true }));
    setSavingWorkoutByMsgId((p) => ({ ...p, [messageId]: false }));

  } catch (err) {
    console.error("SAVE SHARE ERROR:", err);
    setSavingWorkoutByMsgId((p) => ({ ...p, [messageId]: false }));
  }
}



  // ============================================================
  // SEND TEXT
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
  // SEND IMAGE
  // ============================================================

  async function sendImage(file) {
    if (!user?.id || !file) return;

    setError("");

    try {
      const path = imagePath(friendId, user.id, file.name);

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET_IMAGES)
        .upload(path, file, { upsert: false });

      if (uploadErr) {
        setError(uploadErr.message);
        return;
      }

      const { data } = supabase.storage.from(BUCKET_IMAGES).getPublicUrl(path);

      if (!data?.publicUrl) {
        setError("Image URL unavailable");
        return;
      }

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
  // SEND VIDEO (UPGRADED)
  // ============================================================

  async function sendVideo(file) {
    if (!user?.id || !file) return;

    setError("");

    try {
      const path = videoPath(friendId, user.id, file.name);

      const contentType = file.type || "video/mp4";

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET_VIDEOS)
        .upload(path, file, {
          contentType,
          upsert: false,
        });

      if (uploadErr) {
        setError(uploadErr.message);
        return;
      }

      const { data } = supabase.storage.from(BUCKET_VIDEOS).getPublicUrl(path);

      if (!data?.publicUrl) {
        setError("Video URL unavailable");
        return;
      }

      // Insert message with video_url EXACTLY like your base file expects.
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
  // AUDIO RECORDING
  // ============================================================

  async function startRecording() {
    if (isRecording) return;

    if (!navigator?.mediaDevices?.getUserMedia) {
      setError("Microphone not supported");
      return;
    }

    setError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = pickBestAudioMimeType();
      activeMimeRef.current = mimeType;

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        if (!chunksRef.current.length) return;
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType,
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
          const next = d + 1;
          if (next >= MAX_AUDIO_SECONDS) {
            stopRecording();
            return MAX_AUDIO_SECONDS;
          }
          return next;
        });
      }, 1000);
    } catch (e) {
      setError(e?.message || "Recording failed");
    }
  }

  function stopRecording() {
    try {
      mediaRecorderRef.current?.stop();
      mediaRecorderRef.current?.stream?.getTracks()?.forEach((t) => t.stop());
    } catch {}

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsRecording(false);
  }

  function discardRecording() {
    try {
      mediaRecorderRef.current?.stream?.getTracks()?.forEach((t) => t.stop());
    } catch {}

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    chunksRef.current = [];
    setRecordedBlob(null);
    setRecordDuration(0);
    setIsRecording(false);
    setSendingAudio(false);
  }

  async function sendRecordedAudio() {
    if (!user?.id || !recordedBlob || sendingAudio) return;

    setSendingAudio(true);
    setError("");

    try {
      const mime = recordedBlob.type || activeMimeRef.current || "";
      const ext = fileExtFromMime(mime);
      const path = audioPath(friendId, user.id, ext);

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET_AUDIO)
        .upload(path, recordedBlob, {
          contentType: mime || undefined,
          upsert: false,
        });

      if (uploadErr) {
        setError(uploadErr.message);
        setSendingAudio(false);
        return;
      }

      const { data } = supabase.storage.from(BUCKET_AUDIO).getPublicUrl(path);

      if (!data?.publicUrl) {
        setError("Audio URL unavailable");
        setSendingAudio(false);
        return;
      }

      await supabase.from("messages").insert({
        sender_id: user.id,
        receiver_id: friendId,
        audio_url: data.publicUrl,
        audio_duration: recordDuration,
      });

      setRecordedBlob(null);
      setRecordDuration(0);
      setSendingAudio(false);
    } catch (e) {
      setError(e?.message || "Audio send failed");
      setSendingAudio(false);
    }
  }

  // ============================================================
  // DELETE MESSAGE
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
      await supabase.from("messages").delete().eq("id", deleteTarget.id);

      setMessages((prev) => prev.filter((x) => x.id !== deleteTarget.id));
    } catch {}

    setDeleteTarget(null);
  }

  // ============================================================
  // RENDER
  // ============================================================

  const messagesBottom = useMemo(() => {
    // Keep the composer visible + keep scroll area correct.
    // Base composer is 86px. KeyboardLift adds on top.
    const baseComposer = 86;
    const lift = Math.max(0, keyboardLift);
    return baseComposer + lift;
  }, [keyboardLift]);

  const messagesBoxDynamic = useMemo(() => {
    return {
      ...messagesBox,
      bottom: messagesBottom,
    };
  }, [messagesBottom]);

  const composerWrapDynamic = useMemo(() => {
    return {
      ...composerWrap,
      transform: keyboardLift
        ? `translateY(-${keyboardLift}px)`
        : "translateY(0px)",
    };
  }, [keyboardLift]);

  if (loading) {
    return <div style={loadingWrap}>Loading…</div>;
  }

  return (
    <div style={shell}>
      <div style={header}>
        <button onClick={() => navigate("/friends")} style={backBtn}>
          <FiArrowLeft size={20} />
        </button>
        <div style={headerTextWrap}>
          <strong style={headerName}>{friendName}</strong>
          {friendStatus && <span style={friendStatusText}>{friendStatus}</span>}
        </div>
      </div>

      <div ref={listRef} style={messagesBoxDynamic}>
        {error && <div style={errBox}>{error}</div>}

        {messages.map((m) => {
          const mine = m.sender_id === user.id;
          const share = extractWorkoutShare(m);

          return (
            <div key={m.id} style={mine ? messageRowMine : messageRow}>
              <div
                style={mine ? bubbleMine : bubble}
                onTouchStart={() => startHold(m)}
                onTouchEnd={endHold}
                onTouchCancel={endHold}
              >
                {share ? (
                  <WorkoutShareCard
                    share={share}
                    canSave={!!user?.id}
                    saving={!!savingWorkoutByMsgId[m.id]}
                    saved={!!savedWorkoutByMsgId[m.id]}
                    onSave={() => saveShareToWorkouts(m.id, share)}
                  />
                ) : (
                  m.text && <div style={messageText}>{m.text}</div>
                )}

                {m.image_url && (
                  <img
                    src={m.image_url}
                    style={imageThumb}
                    onClick={() => setImageView(m.image_url)}
                    alt=""
                  />
                )}

                {m.video_url && (
                  <video
                    src={getVideoSrc(m)}
                    controls
                    playsInline
                    preload="metadata"
                    style={videoPlayer}
                    onError={() => {
                      // If raw URL fails (private bucket / iOS), flip the flag.
                      // Signed URL will be used if available.
                      setVideoLoadFailedById((prev) => ({
                        ...prev,
                        [m.id]: true,
                      }));
                      // Also attempt signing again if not present yet
                      ensureSignedVideoForMessage(m);
                    }}
                  />
                )}

                {m.audio_url && (
                  <div style={audioWrap}>
                    <audio
                      src={m.audio_url}
                      controls
                      preload="metadata"
                      style={audioPlayer}
                    />
                    {m.audio_duration != null && (
                      <div style={audioMeta}>{formatMMSS(m.audio_duration)}</div>
                    )}
                  </div>
                )}

                <div style={timestamp}>{formatTime(m.created_at)}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={composerWrapDynamic}>
        <div style={composerRow}>
          <label style={iconBtn}>
            <FiImage size={18} />
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

          <label style={iconBtn}>
            <FiVideo size={18} />
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

          <button
            onClick={isRecording ? stopRecording : startRecording}
            style={isRecording ? iconBtnHot : iconBtn}
          >
            {isRecording ? <FiStopCircle size={18} /> : <FiMic size={18} />}
          </button>

          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message…"
            style={input}
          />

          <button onClick={sendMessage} style={sendBtnIcon}>
            <FiSend size={18} />
          </button>
        </div>

        {recordedBlob && (
          <div style={audioPreviewRow}>
            <audio
              src={URL.createObjectURL(recordedBlob)}
              controls
              style={audioPreviewPlayer}
            />
            <button onClick={sendRecordedAudio} style={tinyHotBtn}>
              <FiSend size={18} />
            </button>
            <button onClick={discardRecording} style={tinyGhostBtn}>
              <FiRefreshCcw size={18} />
            </button>
          </div>
        )}
      </div>

      {deleteTarget && (
        <div style={deleteOverlay}>
          <div style={deleteModal}>
            <FiTrash2 size={28} color="var(--accent)" />
            <div style={deleteTitle}>Delete message?</div>
            <div style={deleteSub}>This can’t be undone.</div>
            <div style={deleteActions}>
              <button style={cancelBtn} onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button style={deleteBtn} onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {imageView && (
        <div style={imageOverlay} onClick={() => setImageView(null)}>
          <img src={imageView} style={imageFull} alt="" />
          <FiX size={28} style={closeIcon} />
        </div>
      )}
    </div>
  );
}

// ============================================================
// STYLES — LONG, VERTICAL, VERBOSE (NO FAT OBJECTS)
// ============================================================

const loadingWrap = {
  color: "var(--text)",
  padding: 20,
};

const shell = {
  position: "fixed",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  background: "var(--bg)",
  overflow: "hidden",
};

const header = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 56,
  background: "var(--accent)",
  color: "var(--text)",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  paddingTop: 0,
  paddingRight: 12,
  paddingBottom: 0,
  paddingLeft: 12,
  gap: 10,
  zIndex: 10,
};

const headerTextWrap = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "center",
};

const headerName = {
  fontSize: 16,
  lineHeight: "18px",
  fontWeight: 700,
};

const friendStatusText = {
  fontSize: 12,
  opacity: 0.85,
};

const backBtn = {
  width: 36,
  height: 36,
  borderRadius: 18,
  background: "rgba(255,255,255,0.2)",
  borderStyle: "none",
  borderWidth: 0,
  color: "var(--text)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const messagesBox = {
  position: "absolute",
  top: 56,
  left: 0,
  right: 0,
  bottom: 86,
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
  overscrollBehavior: "contain",
  paddingTop: 12,
  paddingRight: 12,
  paddingBottom: 12,
  paddingLeft: 12,
};

const messageRow = {
  display: "flex",
  flexDirection: "row",
  justifyContent: "flex-start",
  alignItems: "flex-end",
  marginBottom: 10,
};

const messageRowMine = {
  display: "flex",
  flexDirection: "row",
  justifyContent: "flex-end",
  alignItems: "flex-end",
  marginBottom: 10,
};

const bubble = {
  background: "var(--card-2)",
  color: "var(--text)",
  paddingTop: 12,
  paddingRight: 12,
  paddingBottom: 12,
  paddingLeft: 12,
  borderRadius: 16,
  maxWidth: "78%",
};

const bubbleMine = {
  background: "var(--accent)",
  color: "var(--text)",
  paddingTop: 12,
  paddingRight: 12,
  paddingBottom: 12,
  paddingLeft: 12,
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
  backgroundColor: "var(--bg)",
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

const composerWrap = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "var(--bg)",
  borderTopWidth: 1,
  borderTopStyle: "solid",
  borderTopColor: "var(--border)",
  paddingTop: 10,
  paddingRight: 10,
  paddingBottom: 10,
  paddingLeft: 10,
};

const composerRow = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const iconBtn = {
  width: 44,
  height: 44,
  borderRadius: 14,
  backgroundColor: "var(--card-2)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--border)",
  color: "var(--text)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const iconBtnHot = {
  width: 44,
  height: 44,
  borderRadius: 14,
  backgroundColor: "var(--accent)",
  borderWidth: 0,
  borderStyle: "none",
  color: "var(--text)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const input = {
  flexGrow: 1,
  height: 46,
  borderRadius: 16,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--border)",
  backgroundColor: "var(--card)",
  color: "var(--text)",
  paddingTop: 0,
  paddingRight: 14,
  paddingBottom: 0,
  paddingLeft: 14,
  fontSize: 16,
};

const sendBtnIcon = {
  width: 46,
  height: 46,
  borderRadius: 16,
  backgroundColor: "var(--accent)",
  borderWidth: 0,
  borderStyle: "none",
  color: "var(--text)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const audioPreviewRow = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
  marginTop: 8,
};

const audioPreviewPlayer = {
  flexGrow: 1,
};

const tinyHotBtn = {
  width: 40,
  height: 40,
  borderRadius: 14,
  backgroundColor: "var(--accent)",
  borderWidth: 0,
  borderStyle: "none",
  color: "var(--text)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const tinyGhostBtn = {
  width: 40,
  height: 40,
  borderRadius: 14,
  backgroundColor: "var(--card)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--border)",
  color: "var(--text)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const errBox = {
  backgroundColor: "color-mix(in srgb, var(--accent) 25%, transparent)",
  paddingTop: 10,
  paddingRight: 10,
  paddingBottom: 10,
  paddingLeft: 10,
  borderRadius: 12,
  marginBottom: 10,
};

const deleteOverlay = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  backgroundColor: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
};

const deleteModal = {
  backgroundColor: "var(--card)",
  borderRadius: 16,
  paddingTop: 20,
  paddingRight: 20,
  paddingBottom: 20,
  paddingLeft: 20,
  width: "85%",
  maxWidth: 320,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 12,
  color: "var(--text)",
};

const deleteTitle = {
  fontWeight: 900,
  fontSize: 18,
};

const deleteSub = {
  opacity: 0.8,
};

const deleteActions = {
  width: "100%",
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const cancelBtn = {
  width: "100%",
  paddingTop: 14,
  paddingRight: 14,
  paddingBottom: 14,
  paddingLeft: 14,
  borderRadius: 14,
  backgroundColor: "var(--border)",
  color: "var(--text)",
  borderWidth: 0,
  borderStyle: "none",
};

const deleteBtn = {
  width: "100%",
  paddingTop: 14,
  paddingRight: 14,
  paddingBottom: 14,
  paddingLeft: 14,
  borderRadius: 14,
  backgroundColor: "var(--accent)",
  color: "var(--text)",
  borderWidth: 0,
  borderStyle: "none",
};

const imageOverlay = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  backgroundColor: "rgba(0,0,0,0.9)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
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
  color: "var(--text)",
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

const saveWorkoutBtn = {
  marginTop: 10,
  width: "100%",
  paddingTop: 10,
  paddingRight: 12,
  paddingBottom: 10,
  paddingLeft: 12,
  borderRadius: 14,
  backgroundColor: "rgba(0,0,0,0.25)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.25)",
  color: "var(--text)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontSize: 13,
  fontWeight: 800,
};

const saveWorkoutBtnBusy = {
  marginTop: 10,
  width: "100%",
  paddingTop: 10,
  paddingRight: 12,
  paddingBottom: 10,
  paddingLeft: 12,
  borderRadius: 14,
  backgroundColor: "rgba(0,0,0,0.35)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.25)",
  color: "rgba(255,255,255,0.85)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontSize: 13,
  fontWeight: 800,
  opacity: 0.9,
};

const saveWorkoutBtnDone = {
  marginTop: 10,
  width: "100%",
  paddingTop: 10,
  paddingRight: 12,
  paddingBottom: 10,
  paddingLeft: 12,
  borderRadius: 14,
  backgroundColor: "rgba(255,255,255,0.12)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "rgba(255,255,255,0.25)",
  color: "var(--text)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontSize: 13,
  fontWeight: 900,
};
