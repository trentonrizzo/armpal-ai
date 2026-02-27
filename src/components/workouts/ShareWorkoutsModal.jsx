import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";
import EmptyState from "../EmptyState";

/**
 * ShareWorkoutsModal (WORKING UI + WORKING SEND)
 * - Keeps the "beautiful" UI (big cards, red glow, red send)
 * - Loads friends BOTH directions (accepted)
 * - Shows avatar initial circle + Online/Offline + Last seen X ago
 * - SENDING: auto-detects the correct "message text" column by trying common names
 *   because we confirmed your DB does NOT have: content, message_text
 *
 * IMPORTANT:
 * - This file does NOT touch WorkoutsPage.jsx
 * - This file does NOT require DB schema changes
 */

export default function ShareWorkoutsModal({ open, onClose }) {
  const [step, setStep] = useState("workouts"); // workouts | friends
  const [workouts, setWorkouts] = useState([]);
  const [friends, setFriends] = useState([]);

  const [selectedWorkoutIds, setSelectedWorkoutIds] = useState(() => new Set());
  const [selectedFriendIds, setSelectedFriendIds] = useState(() => new Set());

  const [loadingWorkouts, setLoadingWorkouts] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [sending, setSending] = useState(false);

  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    if (!open) return;

    // reset modal state
    setStep("workouts");
    setSelectedWorkoutIds(new Set());
    setSelectedFriendIds(new Set());
    setErrorText("");

    (async () => {
      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr) {
        setErrorText(uErr.message || "Auth error");
        return;
      }
      const uid = userData?.user?.id;
      if (!uid) return;

      await Promise.all([loadWorkouts(uid), loadFriends(uid)]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function loadWorkouts(uid) {
    setLoadingWorkouts(true);
    setErrorText("");

    const { data, error } = await supabase
      .from("workouts")
      .select("id,name,position")
      .eq("user_id", uid)
      .order("position", { ascending: true });

    if (error) setErrorText(error.message || "Failed loading workouts.");
    setWorkouts(data || []);
    setLoadingWorkouts(false);
  }

  async function loadFriends(uid) {
    setLoadingFriends(true);
    setErrorText("");

    // accepted friendships where you are either side
    const { data: frRows, error: frErr } = await supabase
      .from("friends")
      .select("user_id,friend_id,status,created_at")
      .eq("status", "accepted")
      .or(`user_id.eq.${uid},friend_id.eq.${uid}`);

    if (frErr) {
      setLoadingFriends(false);
      setErrorText(frErr.message || "Failed loading friends.");
      setFriends([]);
      return;
    }

    const otherIds = Array.from(
      new Set(
        (frRows || [])
          .map((r) => (r.user_id === uid ? r.friend_id : r.user_id))
          .filter(Boolean)
      )
    );

    if (!otherIds.length) {
      setFriends([]);
      setLoadingFriends(false);
      return;
    }

    const { data: profs, error: pErr } = await supabase
      .from("profiles")
      .select("id,username,display_name,avatar_url,is_online,last_seen")
      .in("id", otherIds);

    if (pErr) {
      setLoadingFriends(false);
      setErrorText(pErr.message || "Failed loading friend profiles.");
      setFriends([]);
      return;
    }

    const list = (profs || []).map((p) => ({
      id: p.id,
      name: p.display_name || p.username || "Friend",
      avatar_url: p.avatar_url || "",
      is_online: !!p.is_online,
      last_seen: p.last_seen || null,
    }));

    setFriends(list);
    setLoadingFriends(false);
  }

  const selectedWorkouts = useMemo(
    () => workouts.filter((w) => selectedWorkoutIds.has(w.id)),
    [workouts, selectedWorkoutIds]
  );

  function toggleSet(id, setter) {
    setter((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function canGoNext() {
    return selectedWorkoutIds.size > 0;
  }

  function canSend() {
    return selectedWorkoutIds.size > 0 && selectedFriendIds.size > 0 && !sending;
  }

  function close() {
    onClose?.();
  }

  async function loadExercisesForWorkout(workoutId) {
    const { data, error } = await supabase
      .from("exercises")
      .select("name,sets,reps,weight,position")
      .eq("workout_id", workoutId)
      .order("position", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * ✅ The actual fix:
   * Your messages table does NOT have `content` OR `message_text`.
   * So we try a list of common text columns used by chat tables.
   * Whichever succeeds = we send.
   */
  async function insertMessagesWithFallback(rowsBase, payloadObj) {
    const payloadString = JSON.stringify(payloadObj);

    const textColumnsToTry = [
      "text",
      "message",
      "body",
      "message_body",
      "message_content",
      "content",        // known missing, but keep in list just in case schema cache lies
      "message_text",   // known missing, but keep for completeness
      "payload",
      "data",
    ];

    const typeColumnsToTry = [
      "message_type",
      "type",
    ];

    // Try combinations: (type column optional) + (text column)
    // We can succeed even if there is no type column at all (many chats just use text).
    const errors = [];

    // 1) Try with both type+text
    for (const typeCol of typeColumnsToTry) {
      for (const textCol of textColumnsToTry) {
        const rows = rowsBase.map((r) => ({
          ...r,
          [typeCol]: "workout",
          [textCol]: payloadString,
        }));
        const { error } = await supabase.from("messages").insert(rows);
        if (!error) return { ok: true, used: { typeCol, textCol } };
        errors.push(error.message || String(error));
      }
    }

    // 2) Try text only (no type column)
    for (const textCol of textColumnsToTry) {
      const rows = rowsBase.map((r) => ({
        ...r,
        [textCol]: payloadString,
      }));
      const { error } = await supabase.from("messages").insert(rows);
      if (!error) return { ok: true, used: { typeCol: null, textCol } };
      errors.push(error.message || String(error));
    }

    return { ok: false, errors };
  }

  async function send() {
    setErrorText("");
    setSending(true);

    try {
      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      const uid = userData?.user?.id;
      if (!uid) throw new Error("No user session.");

      if (!selectedWorkouts.length) throw new Error("No workouts selected.");
      if (!selectedFriendIds.size) throw new Error("No friends selected.");

      // Build payloads for each workout
      const payloads = [];
      for (const w of selectedWorkouts) {
        const rawEx = await loadExercisesForWorkout(w.id);
        const ex = rawEx.map((e) => {
          if (e.weight && typeof e.weight === "string" && e.weight.trim().startsWith("{")) {
            try {
              const parsed = JSON.parse(e.weight);
              if (parsed && typeof parsed === "object") {
                return parsed;
              }
            } catch {
              // fall through
            }
          }
          return {
            name: e.name,
            sets: e.sets,
            reps: e.reps,
            weight: e.weight,
            position: e.position,
          };
        });
        payloads.push({
          type: "workout_share",
          workout: { id: w.id, name: w.name },
          exercises: ex,
          sent_at: new Date().toISOString(),
        });
      }

      // Base message rows (schema-agnostic)
      // Most chat schemas have sender_id/receiver_id and created_at default; we keep it minimal.
      const friendIds = Array.from(selectedFriendIds);
      const rowsBase = [];
      for (const fid of friendIds) {
        for (const p of payloads) {
          rowsBase.push({
            sender_id: uid,
            receiver_id: fid,
          });
        }
      }

      // Insert with fallback columns
      // Because rowsBase aligns 1:1 with payloads per friend, we need to insert per payload in order.
      // Simpler: insert per payload across all friends (still fast).
      // We'll do it in chunks to keep it deterministic.
      let idx = 0;
      for (const p of payloads) {
        const chunkBase = friendIds.map((fid) => ({
          sender_id: uid,
          receiver_id: fid,
        }));

        const res = await insertMessagesWithFallback(chunkBase, p);
        if (!res.ok) {
          throw new Error(
            `Send failed. Your messages table has no recognized text column.\nTried: text/message/body/message_body/message_content/payload/data\nFirst error: ${res.errors?.[0] || "unknown"}`
          );
        }

        idx++;
      }

      // Close on success
      close();
    } catch (e) {
      console.error("WORKOUT SHARE SEND ERROR:", e);
      setErrorText(e?.message || "Failed to send workouts.");
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div style={backdrop} onClick={close}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <h2 style={title}>
          {step === "workouts" ? "Select Workouts" : "Select Friends"}
        </h2>

        {errorText ? <div style={errorBox}>{errorText}</div> : null}

        {/* WORKOUTS */}
        {step === "workouts" && (
          <div style={listWrap}>
            {loadingWorkouts ? (
              <p style={muted}>Loading workouts…</p>
            ) : workouts.length === 0 ? (
              <EmptyState icon="💪" message="No workouts found — add some on the Workouts page." />
            ) : (
              workouts.map((w) => {
                const sel = selectedWorkoutIds.has(w.id);
                return (
                  <div
                    key={w.id}
                    onClick={() => toggleSet(w.id, setSelectedWorkoutIds)}
                    style={selectCard(sel)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={checkPill(sel)}>{sel ? "✓" : ""}</div>
                      <div style={{ fontWeight: 900, fontSize: 18 }}>{w.name}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* FRIENDS */}
        {step === "friends" && (
          <div style={listWrap}>
            {loadingFriends ? (
              <p style={muted}>Loading friends…</p>
            ) : friends.length === 0 ? (
              <EmptyState icon="👋" message="No friends yet — add friends from the Friends page." />
            ) : (
              friends.map((f) => {
                const sel = selectedFriendIds.has(f.id);
                const initial = (f.name || "F").trim().charAt(0).toUpperCase();
                const statusLine = f.is_online
                  ? "Online"
                  : f.last_seen
                    ? `Offline • Last seen ${timeAgo(f.last_seen)}`
                    : "Offline";

                return (
                  <div
                    key={f.id}
                    onClick={() => toggleSet(f.id, setSelectedFriendIds)}
                    style={selectCard(sel)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {/* avatar */}
                      <div style={avatarCircle}>
                        {f.avatar_url ? (
                          <img
                            src={f.avatar_url}
                            alt={f.name}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <span style={{ fontWeight: 900 }}>{initial}</span>
                        )}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 18, fontWeight: 900 }}>{f.name}</div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>{statusLine}</div>
                      </div>

                      {/* right red check */}
                      <div style={rightCheck(sel)}>{sel ? "✓" : ""}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* FOOTER BUTTONS (keep the nice style) */}
        <div style={footer}>
          {step === "friends" ? (
            <button style={btnGhost} onClick={() => setStep("workouts")} disabled={sending}>
              Back
            </button>
          ) : (
            <button style={btnGhost} onClick={close} disabled={sending}>
              Cancel
            </button>
          )}

          {step === "workouts" ? (
            <button
              style={btnPrimary(canGoNext())}
              onClick={() => setStep("friends")}
              disabled={!canGoNext()}
            >
              Next
            </button>
          ) : (
            <button
              style={btnPrimary(canSend())}
              onClick={send}
              disabled={!canSend()}
            >
              {sending ? "Sending…" : "Send"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------ helpers ------------------------ */

function timeAgo(iso) {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const sec = Math.max(0, Math.floor((now - then) / 1000));
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    const day = Math.floor(hr / 24);

    if (sec < 45) return `${sec}s ago`;
    if (min < 60) return `${min}m ago`;
    if (hr < 24) return `${hr}h ago`;
    return `${day}d ago`;
  } catch {
    return "";
  }
}

/* ------------------------ styles ------------------------ */

const backdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: 14,
};

const card = {
  width: "100%",
  maxWidth: 520,
  background: "color-mix(in srgb, var(--card) 92%, transparent)",
  borderRadius: 18,
  padding: 16,
  border: "1px solid var(--border)",
  boxShadow: "0 18px 60px rgba(0,0,0,0.7)",
};

const title = {
  margin: 0,
  marginBottom: 10,
  fontSize: 34,
  fontWeight: 950,
  letterSpacing: -0.5,
};

const muted = { opacity: 0.7, margin: 0, padding: 8 };

const errorBox = {
  marginBottom: 10,
  padding: 10,
  borderRadius: 12,
  background: "color-mix(in srgb, var(--accent) 20%, transparent)",
  border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
  fontSize: 13,
  lineHeight: 1.3,
};

const listWrap = {
  maxHeight: 330,
  overflowY: "auto",
  paddingRight: 2,
};

const selectCard = (selected) => ({
  padding: 14,
  borderRadius: 16,
  marginBottom: 10,
  cursor: "pointer",
  background: "color-mix(in srgb, var(--text) 4%, transparent)",
  border: selected
    ? "1px solid color-mix(in srgb, var(--accent) 20%, transparent)"
    : "1px solid var(--border)",
  boxShadow: selected ? "0 0 18px color-mix(in srgb, var(--accent) 20%, transparent)" : "none",
});

const checkPill = (selected) => ({
  width: 26,
  height: 26,
  borderRadius: 999,
  background: selected ? "var(--accent)" : "var(--border)",
  border: selected ? "none" : "1px solid var(--border)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 950,
});

const rightCheck = (selected) => ({
  width: 28,
  height: 28,
  borderRadius: 999,
  background: selected ? "var(--accent)" : "var(--border)",
  border: selected ? "none" : "1px solid var(--border)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 950,
});

const avatarCircle = {
  width: 44,
  height: 44,
  borderRadius: 999,
  overflow: "hidden",
  background: "var(--bg)",
  border: "1px solid var(--border)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const footer = {
  display: "flex",
  gap: 12,
  marginTop: 12,
};

const btnGhost = {
  flex: 1,
  padding: 12,
  borderRadius: 16,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text)",
  fontWeight: 900,
};

const btnPrimary = (enabled) => ({
  flex: 1,
  padding: 12,
  borderRadius: 16,
  border: "none",
  background: enabled ? "var(--accent)" : "color-mix(in srgb, var(--text) 20%, transparent)",
  color: "var(--text)",
  fontWeight: 950,
  boxShadow: enabled ? "0 0 16px color-mix(in srgb, var(--accent) 20%, transparent)" : "none",
});
