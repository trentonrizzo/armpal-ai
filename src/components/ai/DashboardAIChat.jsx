import React, { useState, useRef, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import AISettingsOverlay from "./AISettingsOverlay";

export default function DashboardAIChat({ onClose }) {

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const bottomRef = useRef(null);

  /* ==================================================
     LOAD CHAT HISTORY
     ================================================== */

  useEffect(() => {

    async function loadChat() {

      const { data } = await supabase.auth.getUser();
      const userId = data?.user?.id;
      if (!userId) return;

      const { data: history } = await supabase
        .from("ai_messages")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(30);

      if (history) {

        const mapped = history.map(m => {

          let parsed;

          try {
            parsed = JSON.parse(m.content);
          } catch {
            parsed = null;
          }

          if (parsed?.type === "create_workout") {
            return {
              role: m.role,
              content: parsed,
              isWorkoutCard: true
            };
          }

          return {
            role: m.role,
            content: m.content
          };
        });

        setMessages(mapped);
      }
    }

    loadChat();

  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  /* ==================================================
     SAVE WORKOUT
     ================================================== */

  async function saveWorkout(workout) {

    try {

      const { data } = await supabase.auth.getUser();
      const userId = data?.user?.id;

      const { data: workoutInsert } = await supabase
        .from("workouts")
        .insert({
          user_id: userId,
          name: workout.title
        })
        .select()
        .single();

      const workoutId = workoutInsert.id;

      const exerciseRows = workout.exercises.map((ex, index) => ({
        user_id: userId,
        workout_id: workoutId,
        name: ex.name,
        sets: Number(ex.sets) || null,
        reps: ex.reps ?? null,
        weight: null,
        position: index
      }));

      await supabase.from("exercises").insert(exerciseRows);

      alert("Workout saved successfully! 💪");

    } catch (err) {
      console.error(err);
    }
  }

  /* ==================================================
     SEND MESSAGE
     ================================================== */

  async function sendMessage() {

    if (!input.trim() || loading) return;

    const userMessage = input;
    setInput("");
    setError(null);

    const { data } = await supabase.auth.getUser();
    const userId = data?.user?.id;

    const newUserMsg = { role:"user", content:userMessage };

    setMessages(prev => [...prev, newUserMsg]);

    /* SAVE USER MESSAGE */
    await supabase.from("ai_messages").insert({
      user_id:userId,
      role:"user",
      content:userMessage
    });

    setLoading(true);

    try {

      const res = await fetch("/api/ai", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ message:userMessage, userId })
      });

      const json = await res.json();

      const reply = json?.reply;

      let parsed;

      try {
        parsed = JSON.parse(reply);
      } catch {
        parsed = null;
      }

      let newAssistantMsg;

      if (parsed?.type === "create_workout") {

        newAssistantMsg = {
          role:"assistant",
          content:parsed,
          isWorkoutCard:true
        };

        await supabase.from("ai_messages").insert({
          user_id:userId,
          role:"assistant",
          content: JSON.stringify(parsed)
        });

      } else {

        newAssistantMsg = {
          role:"assistant",
          content:reply
        };

        await supabase.from("ai_messages").insert({
          user_id:userId,
          role:"assistant",
          content: reply
        });
      }

      setMessages(prev => [...prev, newAssistantMsg]);

    } catch(err) {

      console.error(err);
      setError(err.message || "AI failed");

    } finally {
      setLoading(false);
    }
  }

  /* ==================================================
     UI
     ================================================== */

  return (

    <div style={{
      position:"fixed",
      inset:0,
      background:"rgba(0,0,0,0.65)",
      backdropFilter:"blur(8px)",
      zIndex:9999,
      display:"flex",
      justifyContent:"center",
      alignItems:"flex-end"
    }}>

      <div style={{
        width:"100%",
        maxWidth:520,
        height:"85vh",
        background:"var(--card)",
        borderRadius:"18px 18px 0 0",
        border:"1px solid var(--border)",
        display:"flex",
        flexDirection:"column",
        overflow:"hidden"
      }}>

        <div style={{
          padding:"14px 16px",
          borderBottom:"1px solid var(--border)",
          display:"flex",
          justifyContent:"space-between"
        }}>
          <strong>ArmPal AI</strong>

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={()=>setShowSettings(true)}>⚙️</button>
            <button onClick={onClose}>✕</button>
          </div>
        </div>

        <div style={{
          flex:1,
          overflowY:"auto",
          padding:16,
          display:"flex",
          flexDirection:"column",
          gap:10
        }}>

          {messages.map((m,i)=>(

            <div key={i} style={{
              alignSelf:m.role==="user"?"flex-end":"flex-start",
              background:m.role==="user"?"var(--accent)":"var(--card-2)",
              padding:"10px 14px",
              borderRadius:14,
              maxWidth:"80%",
              whiteSpace:"pre-wrap"
            }}>

              {m.isWorkoutCard ? (

                <div>

                  <strong>{m.content.title}</strong>

                  {m.content.exercises.map((ex,idx)=>(
                    <div key={idx}>
                      <strong>{ex.name}</strong>
                      <div>{ex.sets} sets • {ex.reps}</div>
                    </div>
                  ))}

                  <button onClick={()=>saveWorkout(m.content)}>
                    Save Workout
                  </button>

                </div>

              ) : m.content}

            </div>

          ))}

          {loading && <div>ArmPal is thinking…</div>}

          <div ref={bottomRef} />

        </div>

        <div style={{ padding:10, display:"flex", gap:8 }}>

          <input
            value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter" && sendMessage()}
            style={{ flex:1 }}
          />

          <button onClick={sendMessage}>
            Send
          </button>

        </div>

      </div>

      {showSettings && (
        <AISettingsOverlay onClose={()=>setShowSettings(false)} />
      )}

    </div>
  );
}
