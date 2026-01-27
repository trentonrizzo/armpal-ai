import { useEffect, useRef, useState } from "react";

export default function DashboardAIChat({ isPro }) {
  if (!isPro) return null;

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  const mode =
    typeof window !== "undefined"
      ? localStorage.getItem("armpal_ai_mode") || "coach"
      : "coach";

  function uid() {
    return Math.random().toString(36).slice(2);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput("");
    setLoading(true);

    setMessages((p) => [...p, { id: uid(), role: "user", text: userText }]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isPro: true,
          message: userText,
          mode,
          context: "",
        }),
      });

      if (!res.ok) throw new Error("Bad response");

      const data = await res.json();

      setMessages((p) => [
        ...p,
        { id: uid(), role: "ai", text: data.reply || "No reply." },
      ]);
    } catch {
      setMessages((p) => [
        ...p,
        { id: uid(), role: "ai", text: "AI failed. Try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => setOpen(true)}>Open AI Chat</button>
      </div>

      {open && (
        <div style={{ position: "fixed", inset: 0, background: "#0008" }}>
          <div
            style={{
              maxWidth: 800,
              margin: "40px auto",
              background: "#111",
              padding: 16,
            }}
          >
            <button onClick={() => setOpen(false)}>Close</button>

            <div style={{ minHeight: 300 }}>
              {messages.map((m) => (
                <div key={m.id}>{m.text}</div>
              ))}
              {loading && <div>Thinking…</div>}
              <div ref={bottomRef} />
            </div>

            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Ask your coach"
            />
            <button onClick={sendMessage}>Send</button>
          </div>
        </div>
      )}
    </>
  );
}
