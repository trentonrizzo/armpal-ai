import React, { useState } from "react";

export default function DashboardAIChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMessage = input;
    setInput("");
    setError(null);

    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage },
    ]);

    setLoading(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: userMessage }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "AI request failed");
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
    } catch (err) {
      console.error("AI CHAT ERROR:", err);
      setError(err.message || "AI failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h3>ArmPal AI (Test)</h3>

      <div style={{ marginBottom: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <strong>{m.role === "user" ? "You" : "AI"}:</strong>{" "}
            {m.content}
          </div>
        ))}
      </div>

      {error && (
        <div style={{ color: "red", marginBottom: 8 }}>
          Error: {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Say something…"
          style={{ flex: 1 }}
        />
        <button onClick={sendMessage} disabled={loading}>
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}
