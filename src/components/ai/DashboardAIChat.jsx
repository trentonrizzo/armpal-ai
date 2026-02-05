import React, { useState } from "react";

export default function DashboardAIChat({ onClose }) {
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "AI request failed");

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
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
      <div className="bg-white text-black w-full max-w-md rounded-lg p-4 shadow-xl">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold">ArmPal AI</h3>
          <button onClick={onClose}>✕</button>
        </div>

        <div className="h-64 overflow-y-auto mb-2 text-sm">
          {messages.map((m, i) => (
            <div key={i} className="mb-1">
              <strong>{m.role === "user" ? "You" : "AI"}:</strong>{" "}
              {m.content}
            </div>
          ))}
        </div>

        {error && <div className="text-red-500 text-sm mb-1">{error}</div>}

        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Ask ArmPal…"
            className="flex-1 border px-2 py-1 rounded"
          />
          <button onClick={sendMessage} disabled={loading}>
            {loading ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
