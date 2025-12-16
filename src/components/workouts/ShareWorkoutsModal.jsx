import React, { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";

export default function ShareWorkoutsModal({ open, onClose }) {
  const [step, setStep] = useState("workouts"); // workouts | friends
  const [workouts, setWorkouts] = useState([]);
  const [friends, setFriends] = useState([]);
  const [selectedWorkoutIds, setSelectedWorkoutIds] = useState(new Set());
  const [selectedFriendIds, setSelectedFriendIds] = useState(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) return;

      const { data: ws } = await supabase
        .from("workouts")
        .select("id,name")
        .eq("user_id", uid)
        .order("position", { ascending: true });

      const { data: fr } = await supabase
        .from("friends")
        .select(`
          friend_id,
          profiles:friend_id ( id, username, display_name )
        `)
        .eq("user_id", uid)
        .eq("status", "accepted");

      setWorkouts(ws || []);
      setFriends(
        (fr || []).map(f => ({
          id: f.profiles.id,
          name: f.profiles.display_name || f.profiles.username || "Friend",
        }))
      );
    })();
  }, [open]);

  if (!open) return null;

  const toggleWorkout = (id) => {
    setSelectedWorkoutIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleFriend = (id) => {
    setSelectedFriendIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  async function send() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;

    const selectedWorkouts = workouts.filter(w => selectedWorkoutIds.has(w.id));
    const payloads = [];

    for (const w of selectedWorkouts) {
      const { data: ex } = await supabase
        .from("exercises")
        .select("name,sets,reps,weight,position")
        .eq("workout_id", w.id)
        .order("position", { ascending: true });

      payloads.push({
        type: "workout_share",
        workout: { id: w.id, name: w.name },
        exercises: ex || [],
        sent_at: new Date().toISOString(),
      });
    }

    const inserts = [];
    for (const fid of selectedFriendIds) {
      for (const p of payloads) {
        inserts.push({
          sender_id: uid,
          receiver_id: fid,
          message_type: "workout",
          content: p,
        });
      }
    }

    await supabase.from("messages").insert(inserts);
    setLoading(false);
    onClose();
  }

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <h2 style={{ marginBottom: 8 }}>
          {step === "workouts" ? "Select Workouts" : "Select Friends"}
        </h2>

        {step === "workouts" && (
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {workouts.map(w => {
              const sel = selectedWorkoutIds.has(w.id);
              return (
                <div
                  key={w.id}
                  onClick={() => toggleWorkout(w.id)}
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    marginBottom: 6,
                    cursor: "pointer",
                    border: sel ? "1px solid #ff2f2f" : "1px solid rgba(255,255,255,0.1)",
                    boxShadow: sel ? "0 0 12px rgba(255,47,47,0.35)" : "none",
                  }}
                >
                  {sel ? "✓ " : ""}{w.name}
                </div>
              );
            })}
          </div>
        )}

        {step === "friends" && (
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {friends.map(f => {
              const sel = selectedFriendIds.has(f.id);
              return (
                <div
                  key={f.id}
                  onClick={() => toggleFriend(f.id)}
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    marginBottom: 6,
                    cursor: "pointer",
                    border: sel ? "1px solid #ff2f2f" : "1px solid rgba(255,255,255,0.1)",
                    boxShadow: sel ? "0 0 12px rgba(255,47,47,0.35)" : "none",
                  }}
                >
                  {sel ? "✓ " : ""}{f.name}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          {step === "friends" && (
            <button style={btn} onClick={() => setStep("workouts")}>Back</button>
          )}
          {step === "workouts" && (
            <button
              style={btnPrimary}
              disabled={!selectedWorkoutIds.size}
              onClick={() => setStep("friends")}
            >
              Next
            </button>
          )}
          {step === "friends" && (
            <button
              style={btnPrimary}
              disabled={!selectedFriendIds.size || loading}
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
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
};
const card = {
  background: "#111", borderRadius: 12, padding: 16, width: "92%", maxWidth: 420,
};
const btn = {
  flex: 1, padding: 10, borderRadius: 10, background: "transparent",
  border: "1px solid rgba(255,255,255,0.2)", color: "white",
};
const btnPrimary = {
  flex: 1, padding: 10, borderRadius: 10, background: "#ff2f2f",
  border: "none", color: "white", fontWeight: 700,
};
