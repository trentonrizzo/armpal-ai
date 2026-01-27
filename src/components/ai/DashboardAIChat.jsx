
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
        <button
          onClick={() => setOpen(true)}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--card)",
            color: "var(--text)",
            cursor: "pointer",
          }}
        >
          Open AI Chat
        </button>
      </div>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 820,
              height: "80vh",
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 60px rgba(0,0,0,.5)",
            }}
          >
            <div
              style={{
                padding: 12,
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <strong style={{ color: "var(--text)" }}>AI Coach</strong>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  fontSize: 18,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                flex: 1,
                padding: 12,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                    padding: "10px 12px",
                    borderRadius: 14,
                    background:
                      m.role === "user"
                        ? "var(--accent)"
                        : "var(--card-2)",
                    color: "var(--text)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {m.text}
                </div>
              ))}
              {loading && (
                <div style={{ opacity: 0.7, color: "var(--text-muted)" }}>
                  Thinking…
                </div>
              )}
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
                  fontWeight: 700,
                  border: "none",
                  cursor: "pointer",
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
