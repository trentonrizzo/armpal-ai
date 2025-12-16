// src/pages/ChatPage.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { FiArrowLeft, FiSend, FiImage, FiX } from "react-icons/fi";

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
   WORKOUT SHARE: parsing + rendering + save-to-my-workouts
   ============================================================ */

function tryParseJSON(val) {
  if (val == null) return null;
  if (typeof val === "object") return val; // already json
  if (typeof val !== "string") return null;

  const s = val.trim();
  if (!s) return null;

  // If it doesn't look like JSON, bail
  if (!(s.startsWith("{") || s.startsWith("["))) return null;

  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function extractWorkoutShareFromMessage(m) {
  // Try common columns where share payload could be stored
  const candidates = [
    m.text,
    m.message,
    m.body,
    m.content,
    m.payload,
    m.data,
  ];

  for (const c of candidates) {
    const parsed = tryParseJSON(c);
    if (!parsed) continue;

    // Case A: { type:"workout_share", workout:{...}, exercises:[...] }
    if (parsed?.type === "workout_share" && parsed?.workout) {
      return parsed;
    }

    // Case B: { type:"workout_share", payload:{workout, exercises} }
    if (parsed?.type === "workout_share" && parsed?.payload?.workout) {
      return {
        type: "workout_share",
        workout: parsed.payload.workout,
        exercises: parsed.payload.exercises || [],
        sent_at: parsed.payload.sent_at || parsed.sent_at || null,
      };
    }

    // Case C: some systems store just {workout, exercises} with no type
    if (parsed?.workout && Array.isArray(parsed?.exercises)) {
      return { type: "workout_share", ...parsed };
    }
  }

  return null;
}

function prettyLine(ex) {
  const sets = ex.sets ?? ex.sets === 0 ? ex.sets : null;
  const reps = ex.reps ?? ex.reps === 0 ? ex.reps : null;
  const weight = ex.weight ?? "";

  let mid = "";
  if (sets != null || reps != null) {
    mid = `${sets ?? "—"}×${reps ?? "—"}`;
  }
  let w = "";
  if (weight) w = ` @ ${weight}`;

  return `${ex.name || "Exercise"}${mid ? ` — ${mid}` : ""}${w}`;
}

function WorkoutShareCard({ share, mine, onSave, saving }) {
  const workoutName = share?.workout?.name || "Workout";
  const exercises = Array.isArray(share?.exercises) ? share.exercises : [];

  // Keep message compact in chat: show first 6, then "+X more"
  const maxShow = 6;
  const shown = exercises.slice(0, maxShow);
  const remaining = Math.max(0, exercises.length - maxShow);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: -0.2 }}>
        📋 {workoutName}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {shown.map((ex, idx) => (
          <div
            key={idx}
            style={{
              fontSize: 13.5,
              lineHeight: 1.25,
              opacity: 0.95,
              paddingLeft: 2,
            }}
          >
            • {prettyLine(ex)}
          </div>
        ))}

        {remaining > 0 && (
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            + {remaining} more…
          </div>
        )}
      </div>

      {/* Save button (you asked for it) */}
      <button
        onClick={onSave}
        disabled={saving}
        style={{
          marginTop: 6,
          width: "100%",
          padding: "10px 12px",
          borderRadius: 12,
          border: mine ? "1px solid rgba(255,255,255,0.25)" : "none",
          background: mine ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.25)",
          color: "#fff",
          fontWeight: 900,
          cursor: saving ? "not-allowed" : "pointer",
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? "Saving…" : "Save to My Workouts"}
      </button>
    </div>
  );
}

/* ============================================================
   MAIN
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

  // Save workflow state
  const [savingWorkoutKey, setSavingWorkoutKey] = useState(null);
  const [toast, setToast] = useState("");

  const listRef = useRef(null);
  const holdTimer = useRef(null);

  // presence refs
  const idleTimer = useRef(null);
  const heartbeatTimer = useRef(null);
  const isOnlineRef = useRef(false);

  // 🔒 Lock background scroll (PWA fix)
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = "";
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(t);
  }, [toast]);

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

  // Realtime messages
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

  // Realtime friend presence updates
  useEffect(() => {
    if (!friendId) return;

    const ch = supabase
      .channel(`presence-friend-${friendId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        (payload) => {
          const p = payload.new;
          if (p?.id !== friendId) return;
          setFriend((prev) => ({ ...(prev || {}), ...p }));
        }
      )
      .subscribe();

    return () => supabase.removeChannel(ch);
  }, [friendId]);

  // Auto scroll
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

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

  // HOLD TO DELETE
  function startHold(m) {
    holdTimer.current = setTimeout(async () => {
      if (m.sender_id !== user.id) return;
      if (!window.confirm("Delete this message?")) return;

      await supabase.from("messages").delete().eq("id", m.id);
      setMessages((prev) => prev.filter((x) => x.id !== m.id));
    }, 500);
  }

  function endHold() {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }

  // -------------------------
  // PRESENCE — SELF ONLINE/OFFLINE
  // -------------------------
  async function setMyPresence(online) {
    if (!user?.id) return;
    if (isOnlineRef.current === online) return;

    isOnlineRef.current = online;

    await supabase
      .from("profiles")
      .update({
        is_online: online,
        last_seen: new Date().toISOString(),
      })
      .eq("id", user.id);
  }

  function clearIdleTimer() {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
  }

  function armIdleTimer() {
    clearIdleTimer();
    idleTimer.current = setTimeout(() => {
      setMyPresence(false);
    }, 2 * 60 * 1000);
  }

  function startHeartbeat() {
    if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
    heartbeatTimer.current = setInterval(() => {
      if (
        !user?.id ||
        document.visibilityState !== "visible" ||
        !isOnlineRef.current
      )
        return;

      supabase
        .from("profiles")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", user.id);
    }, 30 * 1000);
  }

  function stopHeartbeat() {
    if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
    heartbeatTimer.current = null;
  }

  useEffect(() => {
    if (!user?.id) return;

    setMyPresence(true);
    armIdleTimer();
    startHeartbeat();

    const onVis = () => {
      if (document.visibilityState === "visible") {
        setMyPresence(true);
        armIdleTimer();
      } else {
        setMyPresence(false);
        clearIdleTimer();
      }
    };

    const onActivity = () => {
      if (document.visibilityState !== "visible") return;
      setMyPresence(true);
      armIdleTimer();
    };

    window.addEventListener("visibilitychange", onVis);
    window.addEventListener("touchstart", onActivity, { passive: true });
    window.addEventListener("mousemove", onActivity);
    window.addEventListener("keydown", onActivity);

    return () => {
      window.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("touchstart", onActivity);
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);

      clearIdleTimer();
      stopHeartbeat();
      setMyPresence(false);
    };
  }, [user?.id, friendId]);

  const friendName = friend?.display_name || friend?.username || "Chat";

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
     SAVE SHARED WORKOUT -> my workouts table + exercises table
     ============================================================ */

  async function saveSharedWorkout(share, messageId) {
    if (!user?.id) return;
    if (!share?.workout?.name) return;

    const key = `${messageId || "m"}-${share?.workout?.id || share?.workout?.name}`;
    setSavingWorkoutKey(key);
    setError("");

    try {
      const ok = window.confirm(
        `Save "${share.workout.name}" to your workouts?`
      );
      if (!ok) {
        setSavingWorkoutKey(null);
        return;
      }

      // get position = append to end
      const { data: existing, error: e1 } = await supabase
        .from("workouts")
        .select("id")
        .eq("user_id", user.id);

      if (e1) throw e1;

      const position = (existing || []).length;

      const { data: insertedWorkout, error: e2 } = await supabase
        .from("workouts")
        .insert({
          user_id: user.id,
          name: share.workout.name,
          scheduled_for: null,
          position,
        })
        .select("id")
        .single();

      if (e2) throw e2;

      const newWorkoutId = insertedWorkout.id;

      const exercises = Array.isArray(share.exercises) ? share.exercises : [];
      if (exercises.length) {
        const rows = exercises.map((ex, idx) => ({
          user_id: user.id,
          workout_id: newWorkoutId,
          name: ex.name || "Exercise",
          sets: ex.sets === "" || ex.sets == null ? null : Number(ex.sets),
          reps: ex.reps === "" || ex.reps == null ? null : Number(ex.reps),
          weight: ex.weight ?? null,
          position: typeof ex.position === "number" ? ex.position : idx,
        }));

        const { error: e3 } = await supabase.from("exercises").insert(rows);
        if (e3) throw e3;
      }

      setToast("✅ Saved to your workouts");
    } catch (e) {
      console.error("SAVE WORKOUT ERROR:", e);
      setError(e?.message || "Failed saving workout.");
    } finally {
      setSavingWorkoutKey(null);
    }
  }

  return (
    <>
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
            <span style={{ fontSize: 12, opacity: 0.85 }}>{friendStatus}</span>
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

          const saveKey = `${m.id}-${share?.workout?.id || share?.workout?.name || "w"}`;
          const saving = savingWorkoutKey === saveKey;

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
                {/* ✅ Workout Share Card */}
                {share ? (
                  <WorkoutShareCard
                    share={share}
                    mine={mine}
                    saving={saving}
                    onSave={() => saveSharedWorkout(share, m.id)}
                  />
                ) : (
                  <>
                    {/* Normal text */}
                    {m.text && <div>{m.text}</div>}
                    {/* If your schema ever stores other text columns, you can display them here too,
                        but we leave it as-is to avoid breaking current chat. */}
                  </>
                )}

                {/* Image */}
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

                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 6 }}>
                  {formatTime(m.created_at)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* INPUT */}
      <div style={inputBar}>
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

      {/* TOAST */}
      {toast && (
        <div
          style={{
            position: "fixed",
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
          }}
        >
          {toast}
        </div>
      )}

      {/* IMAGE VIEW */}
      {imageView && (
        <div style={imageOverlay} onClick={() => setImageView(null)}>
          <img src={imageView} style={imageFull} />
          <FiX size={28} style={closeIcon} />
        </div>
      )}
    </>
  );
}

/* STYLES */
const header = {
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
  bottom: "env(safe-area-inset-bottom)",
  left: 0,
  right: 0,
  height: 72,
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

const imageOverlay = {
  position: "fixed",
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
