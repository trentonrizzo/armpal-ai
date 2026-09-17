import React, { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, X, Keyboard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createVoiceSession } from "./realtimeClient";
import { usePurchase } from "../../context/PurchaseContext";
import { REVENUE_EVENTS, trackRevenueEvent } from "../../lib/revenueAnalytics";

const STATES = {
  idle: "Tap to talk",
  connecting: "Connecting…",
  listening: "Listening…",
  working: "Working…",
  speaking: "ArmPal",
  error: "Try again",
};

export default function VoiceAgentButton() {
  const navigate = useNavigate();
  const { isPro } = usePurchase();
  const sessionRef = useRef(null);
  const tapLock = useRef(0);
  const [state, setState] = useState("idle");
  const [open, setOpen] = useState(false);
  const [userText, setUserText] = useState("");
  const [assistantText, setAssistantText] = useState("");
  const [error, setError] = useState("");
  const [typed, setTyped] = useState("");
  const [showTyped, setShowTyped] = useState(false);

  const closeSession = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setState("idle");
    setOpen(false);
    setShowTyped(false);
    setTyped("");
  }, []);

  useEffect(() => () => {
    sessionRef.current?.stop();
    sessionRef.current = null;
  }, []);

  const startSession = useCallback(() => {
    const now = Date.now();
    if (now - tapLock.current < 700) return;
    tapLock.current = now;
    if (sessionRef.current?.starting || sessionRef.current?.active) return;

    if (!isPro) {
      setError("");
      setUserText("");
      setAssistantText("");
      setOpen(true);
      setState("idle");
      trackRevenueEvent(REVENUE_EVENTS.PAYWALL_VIEWED, { feature: "voice", surface: "mic" });
      return;
    }

    setError("");
    setUserText("");
    setAssistantText("");
    setOpen(true);
    setState("connecting");

    const session = createVoiceSession({
      onState: (s) => setState(s),
      onUserTranscript: (t) => setUserText(t),
      onAssistantTranscript: (t) => setAssistantText(t),
      onError: (msg) => {
        setError(msg);
        setState("error");
      },
      onStopped: () => {
        setState("idle");
      },
    });
    sessionRef.current = session;
    void session.start();
  }, [isPro]);

  function onFabClick() {
    if (state === "idle" || state === "error") {
      startSession();
      return;
    }
    closeSession();
  }

  function sendTyped(e) {
    e?.preventDefault?.();
    const text = typed.trim();
    if (!text) return;
    if (!sessionRef.current || state === "idle" || state === "error") {
      startSession();
      sessionRef.current?.sendText(text);
      setTyped("");
      return;
    }
    sessionRef.current.sendText(text);
    setTyped("");
  }

  const listening = state === "listening";
  const busy = state === "connecting" || state === "working" || state === "speaking";

  return (
    <>
      {open && (
        <div
          style={{
            position: "fixed",
            right: 16,
            bottom: "calc(var(--safe-area-bottom, 0px) + 96px)",
            zIndex: 10050,
            width: "min(320px, calc(100vw - 32px))",
            background: "var(--card)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: "12px 12px 10px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.8 }}>
              {STATES[state] || "ArmPal"}
            </div>
            <button
              type="button"
              onClick={closeSession}
              aria-label="Close voice"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text)",
                padding: 4,
                cursor: "pointer",
              }}
            >
              <X size={16} />
            </button>
          </div>
          {userText ? (
            <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 6 }}>{userText}</div>
          ) : null}
          {!isPro ? (
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35, marginBottom: 10 }}>
                Voice is included with ArmPal Pro.
              </div>
              <button
                type="button"
                onClick={() => {
                  trackRevenueEvent(REVENUE_EVENTS.UPGRADE_INITIATED, { feature: "voice", surface: "mic" });
                  navigate("/pro");
                }}
                style={{
                  width: "100%",
                  border: "none",
                  borderRadius: 10,
                  padding: "8px 10px",
                  background: "var(--accent)",
                  color: "var(--text)",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Upgrade to Pro
              </button>
            </div>
          ) : assistantText ? (
            <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>{assistantText}</div>
          ) : (
            <div style={{ fontSize: 13, opacity: 0.55 }}>
              {error || (state === "listening" ? "Go ahead…" : " ")}
            </div>
          )}
          {isPro && error && state === "error" ? (
            <button
              type="button"
              onClick={startSession}
              style={{
                marginTop: 10,
                width: "100%",
                border: "none",
                borderRadius: 10,
                padding: "8px 10px",
                background: "var(--accent)",
                color: "var(--text)",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          ) : null}
          {isPro ? (showTyped ? (
            <form onSubmit={sendTyped} style={{ marginTop: 10, display: "flex", gap: 6 }}>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Type instead…"
                style={{
                  flex: 1,
                  background: "var(--card-2, var(--bg))",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "8px 10px",
                  fontSize: 14,
                }}
              />
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowTyped(true)}
              style={{
                marginTop: 8,
                background: "transparent",
                border: "none",
                color: "var(--text)",
                opacity: 0.55,
                fontSize: 12,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: 0,
              }}
            >
              <Keyboard size={12} /> Type
            </button>
          )) : null}
        </div>
      )}

      <button
        type="button"
        onClick={onFabClick}
        aria-label={state === "idle" ? "Start ArmPal voice" : "Stop ArmPal voice"}
        style={{
          position: "fixed",
          right: 16,
          bottom: "calc(var(--safe-area-bottom, 0px) + 80px)",
          zIndex: 10060,
          width: 56,
          height: 56,
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.16)",
          background: listening || busy ? "var(--accent)" : "var(--card)",
          color: "var(--text)",
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          transform: listening ? "scale(1.06)" : "scale(1)",
          transition: "transform 0.15s ease, background 0.15s ease",
        }}
      >
        {state === "idle" || state === "error" ? <Mic size={22} /> : <Square size={18} />}
      </button>
    </>
  );
}
