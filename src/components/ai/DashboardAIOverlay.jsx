import React, { useMemo, useState } from "react";

export default function DashboardAIOverlay({ open, onClose }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(() => []);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const canSend = useMemo(() => {
    return !loading && input.trim().length > 0;
  }, [loading, input]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    setErr("");
    setLoading(true);
    setInput("");

    // push user message
    setMessages((prev) => [...prev, { role: "user", text }]);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.error || "AI failed";
        throw new Error(msg);
      }

      const reply = data?.reply || "No reply";
      setMessages((prev) => [...prev, { role: "ai", text: reply }]);
    } catch (e) {
      setErr(e?.message || "AI failed");
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "AI failed (server error). Check Vercel logs." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(900px, 100%)",
          height: "min(700px, 100%)",
          background: "#0b0b0b",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: 14,
            borderBottom: "1px solid rgba(255,255,255,0.12)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#fff",
            fontWeight: 700,
          }}
        >
          <div>ArmPal AI (Test)</div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 10,
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        <div
          style={{
            flex: 1,
            padding: 14,
            overflow: "auto",
            color: "#fff",
            fontSize: 14,
          }}
        >
          {messages.length === 0 ? (
            <div style={{ opacity: 0.7 }}>
              Type anything and hit Enter. If it replies, we’re done.
            </div>
          ) : (
            messages.map((m, idx) => (
              <div
                key={idx}
                style={{
                  marginBottom: 10,
                  padding: 10,
                  borderRadius: 12,
                  background:
                    m.role === "user"
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(0,200,255,0.10)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  whiteSpace: "pre-wrap",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 6, opacity: 0.9 }}>
                  {m.role === "user" ? "You" : "AI"}
                </div>
                <div>{m.text}</div>
              </div>
            ))
          )}
        </div>

        <div
          style={{
            padding: 14,
            borderTop: "1px solid rgba(255,255,255,0.12)",
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Say something…"
            rows={2}
            style={{
              flex: 1,
              resize: "none",
              borderRadius: 12,
              padding: 12,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.06)",
              color: "#fff",
              outline: "none",
            }}
          />
          <button
            onClick={send}
            disabled={!canSend}
            style={{
              borderRadius: 12,
              padding: "12px 14px",
              border: "1px solid rgba(255,255,255,0.18)",
              background: canSend ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)",
              color: "#fff",
              cursor: canSend ? "pointer" : "not-allowed",
              minWidth: 110,
              fontWeight: 700,
            }}
          >
            {loading ? "Thinking…" : "Send"}
          </button>
        </div>

        {err ? (
          <div
            style={{
              padding: "10px 14px",
              color: "#ffb3b3",
              borderTop: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,0,0,0.06)",
              fontSize: 13,
            }}
          >
            Error: {err}
          </div>
        ) : null}
      </div>
    </div>
  );
}
