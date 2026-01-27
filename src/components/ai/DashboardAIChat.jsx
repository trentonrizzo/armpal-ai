import { useEffect, useRef, useState } from "react";

/**
 * DashboardAIChat (PREMIUM + REAL AI)
 * ----------------------------------
 * - Calls backend AI brain
 * - Personality-aware
 * - Loading + error handling
 */

export default function DashboardAIChat({ isPro }) {
  if (!isPro) return null;

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  const mode = localStorage.getItem("armpal_ai_mode") || "coach";

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(scrollToBottom, [messages, open]);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMsg = {
      id: crypto.randomUUID(),
      role: "user",
      text: input.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isPro: true,
          message: userMsg.text,
          mode,
          context: "",
        }),
      });

      const data = await res.json();

      const aiMsg = {
        id: crypto.randomUUID(),
        role: "ai",
        text: data.reply || "AI error.",
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "ai", text: "AI failed. Try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const bubble = (role) => ({
    maxWidth: "85%",
    padding: "10px 12px",
    borderRadius: 14,
    fontSize: 13,
    background: role === "user" ? "var(--accent)" : "var(--card-2)",
    color: "var(--text)",
    alignSelf: role === "user" ? "flex-end" : "flex-start",
    whiteSpace: "pre-line",
  });

  return (
    <>
      <div
        style={{
          background: "var(--card-2)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <strong>AI Coach Chat</strong>
          <button
            onClick={() => setOpen(true)}
            style={{
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text)",
              borderRadius: 10,
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            Open Chat
          </button>
        </div>
      </div>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: 12,
            zIndex: 1000000,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 820,
              height: "85vh",
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: 12,
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <strong>AI Coach</strong>
              <button onClick={() => setOpen(false)}>✕</button>
            </div>

            <div
              style={{
                flex: 1,
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                overflowY: "auto",
              }}
            >
              {messages.map((m) => (
                <div key={m.id} style={bubble(m.role)}>
                  {m.text}
                </div>
              ))}
              {loading && <div style={{ opacity: 0.6 }}>Thinking…</div>}
              <div ref={bottomRef} />
            </div>

            <div
              style={{
                padding: 12,
                borderTop: "1px solid var(--border)",
                display: "flex",
                gap: 8,
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Ask your coach…"
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--card-2)",
                  color: "var(--text)",
                }}
              />
              <button
                onClick={sendMessage}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: "var(--accent)",
                  color: "var(--text)",
                  fontWeight: 900,
                  border: "none",
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
