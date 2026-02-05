import React, { useState, useRef, useEffect } from "react";
import { supabase } from "../../supabaseClient";

export default function DashboardAIChat({ onClose }) {

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  /* ==================================================
     🔥 SAVE WORKOUT — FULL ARM PAL NATIVE INTEGRATION
     ==================================================

     This now matches your REAL database architecture:

     1️⃣ Create workout row
     2️⃣ Capture returned workout_id
     3️⃣ Insert exercises linked to workout_id
     4️⃣ Workouts page automatically detects it

     No fake schema. No guessing. Native flow.
  */

  async function saveWorkout(workout) {

    try {

      const { data } = await supabase.auth.getUser();
      const userId = data?.user?.id;

      if (!userId) throw new Error("User not logged in");

      /* ---------- CREATE WORKOUT ---------- */

      const { data: workoutInsert, error: workoutError } = await supabase
        .from("workouts")
        .insert({
          user_id: userId,
          name: workout.title
        })
        .select()
        .single();

      if (workoutError) throw workoutError;

      const workoutId = workoutInsert.id;

      /* ---------- CREATE EXERCISES ---------- */

      if (Array.isArray(workout.exercises) && workout.exercises.length > 0) {

        const exerciseRows = workout.exercises.map((ex, index) => ({
          user_id: userId,
          workout_id: workoutId,
          name: ex.name || "Exercise",
          sets: Number(ex.sets) || null,
          reps: parseInt(ex.reps) || null,
          weight: null,
          position: index
        }));

        const { error: exerciseError } = await supabase
          .from("exercises")
          .insert(exerciseRows);

        if (exerciseError) throw exerciseError;
      }

      alert("Workout saved successfully! 💪");

    } catch (err) {

      console.error("SAVE WORKOUT ERROR:", err);
      alert(err.message || "Failed to save workout");

    }
  }

  /* ==================================================
     🧠 SEND MESSAGE — STRUCTURED AI PIPELINE
     ================================================== */

  async function sendMessage() {

    if (!input.trim() || loading) return;

    const userMessage = input;
    setInput("");
    setError(null);

    setMessages(prev => [
      ...prev,
      { role: "user", content: userMessage }
    ]);

    setLoading(true);

    try {

      const { data, error: authErr } = await supabase.auth.getUser();

      if (authErr) throw new Error(authErr.message);

      const userId = data?.user?.id;

      if (!userId) throw new Error("Not logged in");

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, userId })
      });

      const text = await res.text();

      let json = null;

      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      if (!res.ok) {
        throw new Error(
          json?.error ||
          json?.message ||
          `AI request failed (${res.status})`
        );
      }

      const reply = json?.reply;

      if (!reply) throw new Error("AI returned no reply");

      /* ---------- STRUCTURED RESPONSE DETECTION ---------- */

      let parsed;

      try {
        parsed = JSON.parse(reply);
      } catch {
        parsed = null;
      }

      if (parsed?.type === "create_workout") {

        setMessages(prev => [
          ...prev,
          {
            role: "assistant",
            content: parsed,
            isWorkoutCard: true
          }
        ]);

      } else {

        setMessages(prev => [
          ...prev,
          { role: "assistant", content: reply }
        ]);
      }

    } catch (err) {

      console.error("AI CHAT ERROR:", err);
      setError(err.message || "AI failed");

    } finally {

      setLoading(false);

    }
  }

  /* ==================================================
     🎨 UI — YOUR ORIGINAL DESIGN (PRESERVED)
     ================================================== */

  return (

    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(8px)",
        zIndex: 9999,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end"
      }}
    >

      <div
        style={{
          width: "100%",
          maxWidth: 520,
          height: "85vh",
          background: "var(--card)",
          borderRadius: "18px 18px 0 0",
          border: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
      >

        {/* HEADER */}

        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <strong>ArmPal AI</strong>

          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              fontSize: 18,
              cursor: "pointer",
              color: "var(--text)"
            }}
          >
            ✕
          </button>
        </div>

        {/* ERROR */}

        {error && (
          <div
            style={{
              padding: "10px 12px",
              borderBottom: "1px solid var(--border)",
              background: "rgba(255,0,0,0.10)",
              fontSize: 13
            }}
          >
            <strong style={{ color: "var(--accent)" }}>AI Error:</strong> {error}
          </div>
        )}

        {/* CHAT */}

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10
          }}
        >

          {messages.map((m, i) => (

            <div
              key={i}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                background: m.role === "user" ? "var(--accent)" : "var(--card-2)",
                padding: "10px 14px",
                borderRadius: 14,
                maxWidth: "80%",
                fontSize: 14,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                color: m.role === "user" ? "#fff" : "var(--text)"
              }}
            >

              {m.isWorkoutCard ? (

                <div>

                  <strong>{m.content.title}</strong>

                  {m.content.exercises.map((ex, idx) => (

                    <div key={idx} style={{ marginTop: 6 }}>

                      <div><strong>{ex.name}</strong></div>

                      <div>{ex.sets} sets • {ex.reps}</div>

                      {ex.notes && (
                        <small>{ex.notes}</small>
                      )}

                    </div>

                  ))}

                  <button
                    onClick={() => saveWorkout(m.content)}
                    style={{
                      marginTop: 10,
                      background: "var(--accent)",
                      border: "none",
                      borderRadius: 8,
                      padding: "6px 12px",
                      color: "#fff",
                      cursor: "pointer"
                    }}
                  >
                    Save Workout
                  </button>

                </div>

              ) : m.content}

            </div>

          ))}

          {loading && (
            <div style={{ opacity: 0.7, fontSize: 13 }}>
              ArmPal is thinking…
            </div>
          )}

          <div ref={bottomRef} />

        </div>

        {/* INPUT */}

        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: 10,
            display: "flex",
            gap: 8
          }}
        >

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Ask ArmPal…"
            style={{
              flex: 1,
              background: "var(--card-2)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "10px 12px",
              color: "var(--text)",
              outline: "none"
            }}
          />

          <button
            onClick={sendMessage}
            disabled={loading}
            style={{
              background: "var(--accent)",
              border: "none",
              borderRadius: 12,
              padding: "10px 16px",
              fontWeight: 800,
              color: "#fff",
              cursor: "pointer",
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? "…" : "Send"}
          </button>

        </div>

      </div>

    </div>

  );
}
