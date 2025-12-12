import React, { useEffect, useMemo, useRef, useState } from "react";
import "./ChatUITest.css";

function formatTime(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function ChatUITest() {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState(() => [
    {
      id: "1",
      me: false,
      text: "Yo — this is the new test chat UI 😤",
      created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    },
    {
      id: "2",
      me: true,
      text: "If this looks clean, we swap it into the real chat page.",
      created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    },
  ]);

  const listRef = useRef(null);

  const ordered = useMemo(() => {
    return messages
      .slice()
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }, [messages]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [ordered.length]);

  function send() {
    const t = text.trim();
    if (!t) return;
    setMessages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        me: true,
        text: t,
        created_at: new Date().toISOString(),
      },
    ]);
    setText("");
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="chat-shell">
      <div className="chat-header">
        <div className="chat-header-row">
          <div>
            <p className="chat-title">Chat UI Test</p>
            <p className="chat-subtitle">This route is isolated (won’t break your app)</p>
          </div>
          <div className="chat-pill">Online</div>
        </div>
      </div>

      <div className="chat-body" ref={listRef}>
        {ordered.map((m) => (
          <div key={m.id} className={`msg-row ${m.me ? "me" : "them"}`}>
            <div className="msg-bubble">
              <div className="msg-text">{m.text}</div>
              <div className="msg-meta">{formatTime(m.created_at)}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="chat-composer-wrap">
        <div className="chat-composer">
          <textarea
            className="chat-input"
            placeholder="Message…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
          />
          <button className="chat-send" onClick={send} disabled={!text.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
