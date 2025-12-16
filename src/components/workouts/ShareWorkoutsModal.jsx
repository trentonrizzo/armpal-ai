import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";

export default function ShareWorkoutsModal({ open, onClose }) {
  const [step, setStep] = useState("workouts");
  const [workouts, setWorkouts] = useState([]);
  const [friends, setFriends] = useState([]);
  const [selectedWorkoutIds, setSelectedWorkoutIds] = useState(new Set());
  const [selectedFriendIds, setSelectedFriendIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    if (!open) return;
    setStep("workouts");
    setSelectedWorkoutIds(new Set());
    setSelectedFriendIds(new Set());
    setErrorText("");

    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) return;

      const { data: ws } = await supabase
        .from("workouts")
        .select("id,name,position")
        .eq("user_id", uid)
        .order("position");

      setWorkouts(ws || []);
      await loadFriends(uid);
    })();
  }, [open]);

  async function loadFriends(uid) {
    const { data: fr } = await supabase
      .from("friends")
      .select("user_id,friend_id")
      .eq("status", "accepted")
      .or(`user_id.eq.${uid},friend_id.eq.${uid}`);

    const ids = Array.from(
      new Set(
        (fr || []).map(r => (r.user_id === uid ? r.friend_id : r.user_id))
      )
    );

    if (!ids.length) return setFriends([]);

    const { data: profs } = await supabase
      .from("profiles")
      .select("id,display_name,username,avatar_url,is_online,last_seen")
      .in("id", ids);

    setFriends(
      (profs || []).map(p => ({
        id: p.id,
        name: p.display_name || p.username || "Friend",
        avatar: p.avatar_url,
        online: p.is_online,
        lastSeen: p.last_seen,
      }))
    );
  }

  const selectedWorkouts = useMemo(
    () => workouts.filter(w => selectedWorkoutIds.has(w.id)),
    [workouts, selectedWorkoutIds]
  );

  async function send() {
    setLoading(true);
    setErrorText("");

    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error("No user session");

      const payloads = [];
      for (const w of selectedWorkouts) {
        const { data: ex } = await supabase
          .from("exercises")
          .select("name,sets,reps,weight,position")
          .eq("workout_id", w.id)
          .order("position");

        payloads.push({
          workout: { id: w.id, name: w.name },
          exercises: ex || [],
        });
      }

      const inserts = [];
      for (const fid of selectedFriendIds) {
        for (const p of payloads) {
          inserts.push({
            sender_id: uid,
            receiver_id: fid,
            message_type: "workout",
            message_text: JSON.stringify(p), // ✅ FIX
          });
        }
      }

      const { error } = await supabase.from("messages").insert(inserts);
      if (error) throw error;

      onClose();
    } catch (e) {
      setErrorText(e.message || "Failed to send workouts");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <h2>{step === "workouts" ? "Select Workouts" : "Select Friends"}</h2>

        {errorText && <div style={errorBox}>{errorText}</div>}

        {step === "workouts" && workouts.map(w => (
          <div
            key={w.id}
            onClick={() => toggle(w.id, selectedWorkoutIds, setSelectedWorkoutIds)}
            style={item(selectedWorkoutIds.has(w.id))}
          >
            {selectedWorkoutIds.has(w.id) && "✓ "} {w.name}
          </div>
        ))}

        {step === "friends" && friends.map(f => (
          <div
            key={f.id}
            onClick={() => toggle(f.id, selectedFriendIds, setSelectedFriendIds)}
            style={item(selectedFriendIds.has(f.id))}
          >
            <div style={avatar}>
              {f.avatar ? <img src={f.avatar} /> : f.name[0]}
            </div>
            <div>
              <strong>{f.name}</strong>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {f.online ? "Online" : f.lastSeen ? "Offline" : "—"}
              </div>
            </div>
          </div>
        ))}

        <div style={{ display: "flex", gap: 8 }}>
          {step === "friends" && <button onClick={() => setStep("workouts")}>Back</button>}
          {step === "workouts" && <button onClick={() => setStep("friends")}>Next</button>}
          {step === "friends" && (
            <button disabled={loading} onClick={send}>
              {loading ? "Sending…" : "Send"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* helpers + styles */

function toggle(id, set, setter) {
  const n = new Set(set);
  n.has(id) ? n.delete(id) : n.add(id);
  setter(n);
}

const backdrop = { position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 };
const card = { background: "#111", padding: 16, borderRadius: 16, width: "92%", maxWidth: 420 };
const errorBox = { background: "rgba(255,47,47,.15)", padding: 10, borderRadius: 8, marginBottom: 10 };
const item = sel => ({ padding: 12, borderRadius: 12, marginBottom: 8, cursor: "pointer", border: sel ? "1px solid #ff2f2f" : "1px solid rgba(255,255,255,.1)" });
const avatar = { width: 40, height: 40, borderRadius: "50%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 10 };
