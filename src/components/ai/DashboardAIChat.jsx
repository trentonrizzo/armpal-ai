import { useEffect, useRef, useState } from "react";

/**
 * DashboardAIChat (PREMIUM ONLY)
 * --------------------------------------------------
 * - Inline preview + expandable full overlay (Option C)
 * - HARD pro gate (no AI rendered for free users)
 * - Personality-aware styling
 * - Stubbed AI responses (engine drops in later)
 * - History capped & ready for Supabase
 * - ZERO assumptions about workouts
 *
 * Required localStorage flags (for now):
 * - armpal_is_pro = "true"
 * - armpal_ai_mode
 */

export default function DashboardAIChat({
  isPro,
  userContext = {},
}) {
  /* ================= HARD PRO GATE ================= */
  if (!isPro) return null;

  /* ================= STATE ================= */
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const bottomRef = useRef(null);

  const mode = localStorage.getItem("armpal_ai_mode") || "coach";

  /* ================= HELPERS ================= */

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function fakeAIResponse(userText) {
    // NOTE: This is intentionally dumb.
    // Replaced later by real AI engine.
    const base = {
      savage: "Be honest with yourself. You already know the answer.",
      coach: "Let’s break this down step by step and stay objective.",
      motivation: "You’re asking the right questions. Keep momentum.",
      recovery: "Pay attention to fatigue, joints, and sleep here.",
      science: "Let’s look at volume, intensity, and recovery variables.",
      vulgar: "Alright champ, let’s talk before you do something stupid.",
    };

    return (
      base[mode] +
      "\n\nYou asked: “" +
      userText +
      "”"
    );
  }

  function sendMessage() {
    if (!input.trim()) return;

    const userMsg = {
      id: crypto.randomUUID(),
      role: "user",
      text: input.trim(),
      ts: Date.now(),
    };

    const aiMsg = {
      id: crypto.randomUUID(),
      role: "ai",
      text: fakeAIResponse(input.trim()),
      ts: Date.now() + 1,
    };

    setMessages((prev) => {
      const next = [...prev, userMsg, aiMsg];
      // cap history (safe default)
      return next.slice(-40);
    });

    setInput("");
  }

  useEffect(scrollToBottom, [messages, open]);

  /* ================= STYLES ================= */

  const bubbleStyle = (role) => ({
    maxWidth: "85%",
    padding: "10px 12px",
    borderRadius: 14,
    fontSize: 13,
    lineHeight: 1.4,
    background:
      role === "user" ? "var(--accent)" : "var(--card-2)",
    color: "var(--text)",
    alignSelf: role === "user" ? "flex-end" : "flex-start",
    whiteSpace: "pre-line",
  });

  /* ================= RENDER ================= */

  return (
    <>
      {/* INLINE PREVIEW */}
      <div
        style={{
          background: "var(--card-2)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 12,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
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
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Open Chat
          </button>
        </div>

        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            opacity: 0.8,
          }}
        >
          Ask your AI coach anything about training, recovery, or programming.
        </div>
      </div>

      {/* FULL CHAT OVERLAY */}
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000000,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: 12,
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
              overflow: "hidden",
            }}
          >
            {/* HEADER */}
            <div
              style={{
                padding: 12,
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <strong>AI Coach</strong>
              <button
                onClick={() => setOpen(false)}
                style={{
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text)",
                  borderRadius: 10,
                  padding: "6px 10px",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            {/* MESSAGES */}
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
              {messages.length === 0 && (
                <div style={{ opacity: 0.6, fontSize: 13 }}>
                  Ask anything. This AI remembers your goals (premium).
                </div>
              )}

              {messages.map((m) => (
                <div key={m.id} style={bubbleStyle(m.role)}>
                  {m.text}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* INPUT */}
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
                placeholder="Ask your coach…"
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--card-2)",
                  color: "var(--text)",
                  fontSize: 13,
                  outline: "none",
                }}
              />

              <button
                onClick={sendMessage}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "none",
                  background: "var(--accent)",
                  color: "var(--text)",
                  fontWeight: 900,
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
