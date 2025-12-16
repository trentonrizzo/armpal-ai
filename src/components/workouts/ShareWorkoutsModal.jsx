import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";

export default function ShareWorkoutsModal({ open, onClose }) {
  const [step, setStep] = useState("workouts"); // workouts | friends
  const [workouts, setWorkouts] = useState([]);
  const [friends, setFriends] = useState([]);

  const [selectedWorkoutIds, setSelectedWorkoutIds] = useState(() => new Set());
  const [selectedFriendIds, setSelectedFriendIds] = useState(() => new Set());

  const [loading, setLoading] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [errorText, setErrorText] = useState("");

  // Reset when opening/closing
  useEffect(() => {
    if (!open) return;
    setStep("workouts");
    setSelectedWorkoutIds(new Set());
    setSelectedFriendIds(new Set());
    setErrorText("");
  }, [open]);

  useEffect(() => {
    if (!open) return;

    (async () => {
      setErrorText("");
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) {
        setErrorText(userErr.message || "Auth error.");
        return;
      }
      const uid = userData?.user?.id;
      if (!uid) return;

      // Workouts
      const { data: ws, error: wErr } = await supabase
        .from("workouts")
        .select("id,name,position")
        .eq("user_id", uid)
        .order("position", { ascending: true });

      if (wErr) setErrorText(wErr.message || "Failed loading workouts.");
      setWorkouts(ws || []);

      // Friends (IMPORTANT: both directions)
      await loadFriends(uid);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function loadFriends(uid) {
    setLoadingFriends(true);
    setErrorText("");

    // Pull any accepted friendship where you are either side.
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

    if (otherIds.length === 0) {
      setFriends([]);
      setLoadingFriends(false);
      return;
    }

    // Fetch profiles for the other side
    const { data: profs, error: pErr } = await supabase
      .from("profiles")
      .select("id,username,display_name,avatar_url,last_seen,is_online")
      .in("id", otherIds);

    if (pErr) {
      setErrorText(pErr.message || "Failed loading friend profiles.");
      setFriends([]);
      setLoadingFriends(false);
      return;
    }

    // Preserve a stable order (you can change this later to "most recent chat" sorting)
    const map = new Map((profs || []).map((p) => [p.id, p]));
    const list = otherIds
      .map((id) => map.get(id))
      .filter(Boolean)
      .map((p) => ({
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

  const toggleWorkout = (id) => {
    setSelectedWorkoutIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleFriend = (id) => {
    setSelectedFriendIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  async function loadExercisesForWorkout(workoutId) {
    const { data, error } = await supabase
      .from("exercises")
      .select("name,sets,reps,weight,position")
      .eq("workout_id", workoutId)
      .order("position", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async function send() {
    setErrorText("");
    setLoading(true);

    try {
      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      const uid = userData?.user?.id;
      if (!uid) throw new Error("No user session.");

      if (selectedWorkoutIds.size === 0) throw new Error("No workouts selected.");
      if (selectedFriendIds.size === 0) throw new Error("No friends selected.");

      // Build payloads
      const payloads = [];
      for (const w of selectedWorkouts) {
        const ex = await loadExercisesForWorkout(w.id);
        payloads.push({
          type: "workout_share",
          workout: { id: w.id, name: w.name },
          exercises: ex,
          sent_at: new Date().toISOString(),
        });
      }

      // Insert messages
      const now = new Date().toISOString();
      const inserts = [];
      for (const fid of selectedFriendIds) {
        for (const p of payloads) {
          inserts.push({
            sender_id: uid,
            receiver_id: fid,
            message_type: "workout",
            content: p,
            created_at: now,
          });
        }
      }

      const { error: mErr } = await supabase.from("messages").insert(inserts);
      if (mErr) throw mErr;

      setLoading(false);
      onClose();
    } catch (e) {
      console.error("SEND WORKOUTS ERROR:", e);
      setErrorText(e?.message || "Failed to send workouts.");
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: 0, marginBottom: 8, fontSize: 26, fontWeight: 900 }}>
          {step === "workouts" ? "Select Workouts" : "Select Friends"}
        </h2>

        {errorText ? (
          <div
            style={{
              marginBottom: 10,
              padding: 10,
              borderRadius: 10,
              background: "rgba(255,47,47,0.12)",
              border: "1px solid rgba(255,47,47,0.35)",
              fontSize: 12,
              lineHeight: 1.3,
            }}
          >
            {errorText}
          </div>
        ) : null}

        {step === "workouts" && (
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {workouts.length === 0 ? (
              <p style={{ opacity: 0.7, margin: 0 }}>No workouts found.</p>
            ) : (
              workouts.map((w) => {
                const sel = selectedWorkoutIds.has(w.id);
                return (
                  <div
                    key={w.id}
                    onClick={() => toggleWorkout(w.id)}
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      marginBottom: 10,
                      cursor: "pointer",
                      background: "rgba(255,255,255,0.03)",
                      border: sel
                        ? "1px solid rgba(255,47,47,0.9)"
                        : "1px solid rgba(255,255,255,0.10)",
                      boxShadow: sel ? "0 0 18px rgba(255,47,47,0.28)" : "none",
                      fontSize: 18,
                      fontWeight: 700,
                    }}
                  >
                    {sel ? "✓ " : ""} {w.name}
                  </div>
                );
              })
            )}
          </div>
        )}

        {step === "friends" && (
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {loadingFriends ? (
              <p style={{ opacity: 0.7, margin: 0 }}>Loading friends…</p>
            ) : friends.length === 0 ? (
              <p style={{ opacity: 0.7, margin: 0 }}>
                No accepted friends found. (If you expect friends here, your friendship may be stored only on the other side — this file now checks both directions.)
              </p>
            ) : (
              friends.map((f) => {
                const sel = selectedFriendIds.has(f.id);
                const initial = (f.name || "F").trim().charAt(0).toUpperCase();

                return (
                  <div
                    key={f.id}
                    onClick={() => toggleFriend(f.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: 12,
                      borderRadius: 14,
                      marginBottom: 10,
                      cursor: "pointer",
                      background: "rgba(255,255,255,0.03)",
                      border: sel
                        ? "1px solid rgba(255,47,47,0.9)"
                        : "1px solid rgba(255,255,255,0.10)",
                      boxShadow: sel ? "0 0 18px rgba(255,47,47,0.28)" : "none",
                    }}
                  >
                    {/* Avatar / Icon */}
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 999,
                        overflow: "hidden",
                        background: "#000",
                        border: "1px solid rgba(255,255,255,0.15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 900,
                      }}
                    >
                      {f.avatar_url ? (
                        <img
                          src={f.avatar_url}
                          alt={f.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <span>{initial}</span>
                      )}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 18, fontWeight: 800 }}>{f.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.65 }}>
                        {f.is_online ? "Online" : f.last_seen ? "Offline" : "—"}
                      </div>
                    </div>

                    {sel ? (
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 999,
                          background: "#ff2f2f",
                          color: "#fff",
                          fontWeight: 900,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        ✓
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          {step === "friends" && (
            <button style={btn} onClick={() => setStep("workouts")} disabled={loading}>
              Back
            </button>
          )}

          {step === "workouts" && (
            <button
              style={btnPrimary}
              disabled={selectedWorkoutIds.size === 0}
              onClick={() => setStep("friends")}
            >
              Next
            </button>
          )}

          {step === "friends" && (
            <button
              style={btnPrimary}
              disabled={selectedFriendIds.size === 0 || loading}
              onClick={send}
            >
              {loading ? "Sending…" : "Send"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const backdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: 14,
};

const card = {
  width: "100%",
  maxWidth: 520,
  background: "#111",
  borderRadius: 18,
  padding: 16,
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: "0 18px 50px rgba(0,0,0,0.7)",
};

const btn = {
  flex: 1,
  padding: 12,
  borderRadius: 14,
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.22)",
  color: "white",
  fontWeight: 800,
};

const btnPrimary = {
  flex: 1,
  padding: 12,
  borderRadius: 14,
  background: "#ff2f2f",
  border: "none",
  color: "white",
  fontWeight: 900,
};
