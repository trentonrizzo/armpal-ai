
import React, { useState, useRef, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import AISettingsOverlay from "./AISettingsOverlay"; // ORIGINAL settings overlay (mode control preserved)

export default function DashboardAIChat({ onClose }) {

  /* ==================================================
     STATE (UNCHANGED FROM ORIGINAL)
     ================================================== */

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // GOD MODE animation state (visual only)
  const [animateIn, setAnimateIn] = useState(false);

  const bottomRef = useRef(null);

  /* ==================================================
     HARD SCROLL LOCK — prevents background movement
     ================================================== */

  useEffect(() => {

    const scrollY = window.scrollY;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    requestAnimationFrame(() => setAnimateIn(true));

    return () => {
      const y = document.body.style.top;
      document.body.style.position = "";
      document.body.style.top = "";
      window.scrollTo(0, parseInt(y || "0") * -1);
    };

  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  /* ==================================================
     LOAD CHAT HISTORY (UNCHANGED)
     ================================================== */

  useEffect(() => {

    let cancelled = false;

    async function loadChatHistory() {

      try {

        const { data, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw new Error(authErr.message);

        const userId = data?.user?.id;
        if (!userId) return;

        const { data: history, error: histErr } = await supabase
          .from("ai_messages")
          .select("role, content, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(30);

        if (histErr) throw histErr;

        const safe = Array.isArray(history) ? [...history].reverse() : [];

        const mapped = safe.map((row) => {

          let parsed = null;
          try {
            parsed = JSON.parse(row.content);
          } catch {
            parsed = null;
          }

          if (parsed?.type === "create_workout") {
            return { role: row.role, content: parsed, isWorkoutCard: true };
          }

          return { role: row.role, content: row.content };
        });

        if (!cancelled && mapped.length) {
          setMessages(mapped);
        }

      } catch (err) {
        console.error("LOAD AI HISTORY ERROR:", err);
      }
    }

    loadChatHistory();

    return () => {
      cancelled = true;
    };

  }, []);

  /* ==================================================
     SAVE WORKOUT (UNCHANGED)
     ================================================== */

  async function saveWorkout(workout) {

    try {

      const { data, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw new Error(authErr.message);

      const userId = data?.user?.id;
      if (!userId) throw new Error("User not logged in");

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

      if (Array.isArray(workout.exercises) && workout.exercises.length > 0) {

        const exerciseRows = workout.exercises.map((ex, index) => ({
          user_id: userId,
          workout_id: workoutId,
          name: ex.name || "Exercise",
          sets: Number(ex.sets) || null,
          reps: ex.reps ?? null,
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
     SEND MESSAGE (UNCHANGED — ensures chosen AI mode works)
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

      await supabase.from("ai_messages").insert({
        user_id: userId,
        role: "user",
        content: userMessage
      });

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

/* 🔥 NEW ERROR HANDLING (PRO + LIMIT) */

if (!res.ok) {

  if (json?.error === "PRO_REQUIRED") {
    alert("🔒 ArmPal AI is Pro only. Upgrade to unlock.");
    return;
  }

  if (json?.error === "DAILY_LIMIT_REACHED") {
    alert("You reached your daily AI limit.");
    return;
  }

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

      let parsed = null;
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

        await supabase.from("ai_messages").insert({
          user_id: userId,
          role: "assistant",
          content: JSON.stringify(parsed)
        });

      } else {

        setMessages(prev => [
          ...prev,
          { role: "assistant", content: reply }
        ]);

        await supabase.from("ai_messages").insert({
          user_id: userId,
          role: "assistant",
          content: reply
        });
      }

    } catch (err) {

      console.error("AI CHAT ERROR:", err);
      setError(err.message || "AI failed");

    } finally {

      setLoading(false);

    }
  }

  /* ==================================================
     GOD MODE UI — ONLY VISUAL POLISH ADDED
     ================================================== */

  return (

    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(14px)",
        zIndex: 9999,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "env(safe-area-inset-top) 12px env(safe-area-inset-bottom)",
        overscrollBehavior: "contain"
      }}
    >

      <div
        style={{
          width: "100%",
          maxWidth: 520,
          height: "min(88vh, 720px)",
          background: "var(--card)",
          borderRadius: 20,
          border: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
          boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
          transform: animateIn ? "translateY(0px) scale(1)" : "translateY(40px) scale(0.96)",
          opacity: animateIn ? 1 : 0,
          transition: "all 0.35s cubic-bezier(.22,1,.36,1)"
        }}
      >

        {/* HEADER — ORIGINAL STYLE RESTORED (NO IOS PILL BUTTONS) */}

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

          <div style={{ display: "flex", gap: 10 }}>

            <button
              onClick={() => setShowSettings(true)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: 18,
                cursor: "pointer",
                color: "var(--text)"
              }}
              aria-label="AI Settings"
            >
              ⚙️
            </button>

            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                fontSize: 18,
                cursor: "pointer",
                color: "var(--text)"
              }}
              aria-label="Close"
            >
              ✕
            </button>

          </div>
        </div>

        {/* ERROR */}

        {error && (
          <div
            style={{
              padding: "10px 12px",
              borderBottom: "1px solid var(--border)",
              background: "rgba(255,0,0,0.10)",
              color: "var(--text)",
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
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
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

        {showSettings && (
          <AISettingsOverlay onClose={() => setShowSettings(false)} />
        )}

      </div>

    </div>

  );
}
