import React, { useState, useRef, useEffect } from "react";
import { supabase } from "../../supabaseClient"; // ✅ correct for src/components/ai

export default function DashboardAIChat({ onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMessage = input;
    setInput("");
    setError(null);

    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      // ✅ Get logged-in user id (so backend can read Supabase safely)
      const { data, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw new Error(authErr.message);
      const userId = data?.user?.id;
      if (!userId) throw new Error("Not logged in. Please sign in again.");

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, userId }),
      });

      // ✅ If server returns non-JSON, this avoids "Unexpected end of JSON"
      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      if (!res.ok) {
        throw new Error(json?.error || json?.message || `AI request failed (${res.status})`);
      }

      const reply = json?.reply;
      if (!reply) throw new Error("AI returned no reply.");

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      console.error("AI CHAT ERROR:", err);
      setError(err.message || "AI failed");
    } finally {
      setLoading(false);
    }
  }

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
        alignItems: "flex-end",
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
          overflow: "hidden",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
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
              color: "var(--text)",
            }}
          >
            ✕
          </button>
        </div>

        {/* ERROR BANNER */}
        {error && (
          <div
            style={{
              padding: "10px 12px",
              borderBottom: "1px solid var(--border)",
              background: "rgba(255,0,0,0.10)",
              color: "var(--text)",
              fontSize: 13,
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
            gap: 10,
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
                color: m.role === "user" ? "#fff" : "var(--text)",
              }}
            >
              {m.content}
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
            gap: 8,
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
              outline: "none",
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
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
