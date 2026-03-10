import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiMoreVertical } from "react-icons/fi";
import { supabase } from "../../supabaseClient";
import { getIsPro } from "../../utils/usageLimits";
import {
  listConversations,
  createConversation,
  updateConversationTitle,
  deleteConversation,
  getMessages,
  titleFromFirstMessage,
  touchConversation,
} from "../../api/aiConversations";
import AISettingsOverlay from "./AISettingsOverlay";
import EmptyState from "../EmptyState";
import { getDisplayText, normalizeExerciseToFlexible } from "../../utils/displayText";

export default function DashboardAIChat({ onClose }) {
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [renameId, setRenameId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const bottomRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);
  const menuContainerRef = useRef(null);

  /* ==================================================
     HARD SCROLL LOCK — prevents background movement
     ================================================== */

  useEffect(() => {

    const scrollY = window.scrollY;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    requestAnimationFrame(() => setAnimateIn(true));

    return () => {
      const y = document.body.style.top;
      document.body.style.position = "";
      document.body.style.top = "";
      window.scrollTo(0, parseInt(y || "0") * -1);
    };

  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!menuOpenId) return;
    const close = (e) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [menuOpenId]);

  /* ==================================================
     CONVERSATIONS: list, ensure one exists, load messages
     ================================================== */

  const userIdRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const { data, error: authErr } = await supabase.auth.getUser();
      if (authErr || !data?.user?.id) return;
      const uid = data.user.id;
      userIdRef.current = uid;

      const list = await listConversations(uid);
      if (cancelled) return;

      if (list.length === 0) {
        const created = await createConversation(uid, "New chat");
        if (cancelled || !created) return;
        setConversations([created]);
        setActiveConversationId(created.id);
      } else {
        setConversations(list);
        setActiveConversationId(list[0].id);
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!activeConversationId) return;
    let cancelled = false;
    (async () => {
      const rows = await getMessages(activeConversationId);
      if (cancelled) return;
      const mapped = rows.map((row) => {
        let parsed = null;
        try {
          parsed = JSON.parse(row.content);
        } catch {
          parsed = null;
        }
        if (parsed?.type === "create_workout") {
          return { role: row.role, content: parsed, isWorkoutCard: true };
        }
        return { role: row.role, content: row.content };
      });
      setMessages(mapped);
    })();
    return () => { cancelled = true; };
  }, [activeConversationId]);

  /* ==================================================
     SAVE WORKOUT (UNCHANGED)
     ================================================== */

  async function saveWorkout(workout) {

    try {

      const { data, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw new Error(authErr.message);

      const userId = data?.user?.id;
      if (!userId) throw new Error("User not logged in");

      // Build exercises upfront so the JSONB column is never empty
      const normalized = Array.isArray(workout.exercises)
        ? workout.exercises.map(normalizeExerciseToFlexible).filter(Boolean)
        : [];
      const flexExercises = normalized.map((ex, i) => ({
        id: `temp-${i}`,
        name: ex.name,
        input: ex.input,
      }));

      const { data: workoutInsert, error: workoutError } = await supabase
        .from("workouts")
        .insert({
          user_id: userId,
          name: workout.title,
          scheduled_for: workout.scheduled_date ?? workout.scheduled_for ?? null,
          exercises: flexExercises,
        })
        .select()
        .single();

      if (workoutError) throw workoutError;

      const workoutId = workoutInsert.id;

      // Also insert into exercises table; upgrade JSONB with real IDs if possible
      if (normalized.length > 0) {
        const exerciseRows = normalized.map((ex, index) => ({
          user_id: userId,
          workout_id: workoutId,
          name: ex.name,
          sets: null,
          reps: null,
          weight: "",
          display_text: ex.input || null,
          position: index,
        }));

        try {
          const { data: insertedRows } = await supabase
            .from("exercises")
            .insert(exerciseRows)
            .select("id, name, display_text");
          if (insertedRows?.length) {
            const withRealIds = insertedRows.map((r) => ({
              id: r.id,
              name: r.name,
              input: r.display_text ?? "",
            }));
            await supabase.from("workouts").update({ exercises: withRealIds }).eq("id", workoutId);
          }
        } catch (exErr) {
          console.error("Exercise table insert failed (workout still has exercises):", exErr);
        }
      }

      alert("Workout saved successfully! 💪");

    } catch (err) {

      console.error("SAVE WORKOUT ERROR:", err);
      alert(err.message || "Failed to save workout");

    }
  }

  /* ==================================================
     SEND MESSAGE (UNCHANGED — ensures chosen AI mode works)
     ================================================== */

  async function sendMessage() {
    if (!input.trim() || loading || !activeConversationId) return;

    const userMessage = input;

    const { data, error: authErr } = await supabase.auth.getUser();
    if (authErr) {
      setError("Please sign in to use AI chat.");
      return;
    }
    const userId = data?.user?.id;
    if (!userId) {
      setError("Not logged in.");
      return;
    }

    const isPro = await getIsPro(userId);
    if (!isPro) {
      setError("🔒 ArmPal AI is Pro only. Upgrade to unlock.");
      return;
    }

    setInput("");
    setError(null);
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    const wasEmpty = messages.length === 0;

    try {
      await supabase.from("ai_messages").insert({
        user_id: userId,
        conversation_id: activeConversationId,
        role: "user",
        content: userMessage
      });
      await touchConversation(activeConversationId);

      if (wasEmpty) {
        const title = titleFromFirstMessage(userMessage);
        await updateConversationTitle(activeConversationId, title);
        setConversations(prev =>
          prev.map(c =>
            c.id === activeConversationId ? { ...c, title } : c
          )
        );
      }

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, userId })
      });

const text = await res.text();
let json = null;

try {
  json = text ? JSON.parse(text) : null;
} catch {
  json = null;
}

/* 🔥 NEW ERROR HANDLING (PRO + LIMIT) */

if (!res.ok) {

  if (json?.error === "PRO_REQUIRED") {
    setError("🔒 ArmPal AI is Pro only. Upgrade to unlock.");
    return;
  }

  if (json?.error === "DAILY_LIMIT_REACHED") {
    setError("You've reached today's AI chat limit (25). Try again tomorrow.");
    return;
  }

}


      if (!res.ok) {
        throw new Error(
          json?.error ||
          json?.message ||
          `AI request failed (${res.status})`
        );
      }

      const reply = json?.reply;
      if (!reply) throw new Error("AI returned no reply");

      // Prefer create_workout from API so we never show raw JSON in chat
      let workoutPayload = json?.create_workout ?? null;
      if (!workoutPayload && typeof reply === "string") {
        try {
          const parsed = JSON.parse(reply);
          if (parsed?.type === "create_workout") workoutPayload = parsed;
        } catch {
          // not JSON — will show as text
        }
      }

      if (workoutPayload?.type === "create_workout") {
        setMessages(prev => [
          ...prev,
          {
            role: "assistant",
            content: workoutPayload,
            isWorkoutCard: true,
          },
        ]);
        await supabase.from("ai_messages").insert({
          user_id: userId,
          conversation_id: activeConversationId,
          role: "assistant",
          content: JSON.stringify(workoutPayload),
        });
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: reply }]);
        await supabase.from("ai_messages").insert({
          user_id: userId,
          conversation_id: activeConversationId,
          role: "assistant",
          content: reply,
        });
      }

    } catch (err) {

      console.error("AI CHAT ERROR:", err);
      setError(err.message || "AI failed");

    } finally {

      setLoading(false);

    }
  }

  async function handleNewChat() {
    const uid = userIdRef.current;
    if (!uid) return;
    const created = await createConversation(uid, "New chat");
    if (!created) return;
    setConversations(prev => [created, ...prev]);
    setActiveConversationId(created.id);
    setMessages([]);
    setError(null);
  }

  async function handleRenameSubmit() {
    if (!renameId || !renameValue.trim()) {
      setRenameId(null);
      return;
    }
    await updateConversationTitle(renameId, renameValue.trim());
    setConversations(prev =>
      prev.map(c => (c.id === renameId ? { ...c, title: renameValue.trim() } : c))
    );
    setRenameId(null);
    setRenameValue("");
  }

  async function handleDelete(id) {
    await deleteConversation(id);
    const rest = conversations.filter(c => c.id !== id);
    setConversations(rest);
    if (activeConversationId === id) {
      const next = rest[0] ?? null;
      setActiveConversationId(next?.id ?? null);
      setMessages([]);
    }
    setDeleteConfirmId(null);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(14px)",
        zIndex: 9999,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "env(safe-area-inset-top) 12px env(safe-area-inset-bottom)",
        overscrollBehavior: "contain"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          height: "min(88vh, 720px)",
          background: "var(--card)",
          borderRadius: 20,
          border: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
          boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
          transform: animateIn ? "translateY(0px) scale(1)" : "translateY(40px) scale(0.96)",
          opacity: animateIn ? 1 : 0,
          transition: "all 0.35s cubic-bezier(.22,1,.36,1)"
        }}
        className="chatLayout"
      >
        <style>{`
          .chatDrawer {
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 80vw;
            max-width: 320px;
            background: var(--card-2);
            border-right: 1px solid var(--border);
            z-index: 50;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transition: transform 0.25s ease;
            transform: translateX(-100%);
          }
          .chatDrawer.open {
            transform: translateX(0);
          }
          .chatDrawerItem {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px;
            gap: 10px;
            border-radius: 12px;
            margin-bottom: 4px;
            border: 1px solid var(--border);
            background: var(--card);
            color: var(--text);
          }
          .chatDrawerItem:hover {
            background: var(--card-2);
          }
          .chatDrawerItem.active {
            background: var(--accent);
          }
          .chatDrawerItemTitle {
            flex: 1;
            min-width: 0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-size: 14px;
            cursor: pointer;
          }
        `}</style>

        {/* Sliding drawer — hidden by default */}
        <div className={`chatDrawer ${drawerOpen ? "open" : ""}`}>
          <button
            type="button"
            onClick={handleNewChat}
            style={{
              margin: 12,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px dashed var(--border)",
              background: "transparent",
              color: "var(--text)",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer"
            }}
          >
            + New Chat
          </button>
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "0 8px 8px" }}>
            {conversations.map((c) => (
              <div
                key={c.id}
                className={`chatDrawerItem ${activeConversationId === c.id ? "active" : ""}`}
                style={{ position: "relative" }}
              >
                {renameId === c.id ? (
                  <div style={{ display: "flex", gap: 8, width: "100%", alignItems: "center" }}>
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameSubmit();
                        if (e.key === "Escape") setRenameId(null);
                      }}
                      style={{
                        flex: 1,
                        padding: "6px 8px",
                        fontSize: 13,
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        color: "var(--text)"
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleRenameSubmit}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: "none",
                        background: "var(--accent)",
                        color: "var(--text)",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <>
                    <div
                      className="chatDrawerItemTitle"
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (longPressTriggeredRef.current) {
                          longPressTriggeredRef.current = false;
                          return;
                        }
                        setActiveConversationId(c.id);
                        setMenuOpenId(null);
                        setDrawerOpen(false);
                      }}
                      onTouchStart={() => {
                        longPressTimerRef.current = setTimeout(() => {
                          longPressTimerRef.current = null;
                          longPressTriggeredRef.current = true;
                          setMenuOpenId(c.id);
                        }, 400);
                      }}
                      onTouchEnd={() => {
                        if (longPressTimerRef.current) {
                          clearTimeout(longPressTimerRef.current);
                          longPressTimerRef.current = null;
                        }
                      }}
                      onTouchCancel={() => {
                        if (longPressTimerRef.current) {
                          clearTimeout(longPressTimerRef.current);
                          longPressTimerRef.current = null;
                        }
                      }}
                      onKeyDown={(e) => e.key === "Enter" && setActiveConversationId(c.id)}
                    >
                      {c.title || "New chat"}
                    </div>
                    <button
                      type="button"
                      aria-label="Menu"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId((prev) => (prev === c.id ? null : c.id));
                      }}
                      onTouchEnd={(e) => e.stopPropagation()}
                      style={{
                        padding: 4,
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        color: "var(--text)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0
                      }}
                    >
                      <FiMoreVertical size={18} />
                    </button>
                    {menuOpenId === c.id && (
                      <div
                        ref={menuContainerRef}
                        style={{
                          position: "absolute",
                          right: 0,
                          top: "100%",
                          marginTop: 4,
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                          boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
                          zIndex: 100,
                          minWidth: 120
                        }}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenameId(c.id);
                            setRenameValue(c.title || "New chat");
                            setMenuOpenId(null);
                          }}
                          style={{
                            display: "block",
                            width: "100%",
                            padding: "10px 12px",
                            textAlign: "left",
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            fontSize: 13,
                            color: "var(--text)",
                            borderTopLeftRadius: 12,
                            borderTopRightRadius: 12
                          }}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(c.id);
                            setMenuOpenId(null);
                          }}
                          style={{
                            display: "block",
                            width: "100%",
                            padding: "10px 12px",
                            textAlign: "left",
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            fontSize: 13,
                            color: "var(--accent)",
                            borderBottomLeftRadius: 12,
                            borderBottomRightRadius: 12
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {drawerOpen && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => setDrawerOpen(false)}
            onKeyDown={(e) => e.key === "Escape" && setDrawerOpen(false)}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.3)",
              zIndex: 40
            }}
            aria-label="Close drawer"
          />
        )}

        {/* Chat container: header + content (full width) */}
        <div className="chatContainer" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, width: "100%", overflow: "hidden" }}>
          {/* Chat header — hamburger + title + settings/close */}
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexShrink: 0
            }}
          >
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              style={{
                padding: "6px 10px",
                border: "none",
                background: "transparent",
                color: "var(--text)",
                fontSize: 20,
                cursor: "pointer",
                lineHeight: 1
              }}
              aria-label="Open menu"
            >
              ☰
            </button>
            <strong style={{ flex: 1 }}>ArmPal AI</strong>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowSettings(true)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 18,
                  cursor: "pointer",
                  color: "var(--text)"
                }}
                aria-label="AI Settings"
              >
                ⚙️
              </button>
              <button
                onClick={onClose}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 18,
                  cursor: "pointer",
                  color: "var(--text)"
                }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Chat content — full width */}
          <div className="chatContent" style={{ flex: 1, width: "100%", minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {error && (
          <div
            style={{
              padding: "10px 12px",
              borderBottom: "1px solid var(--border)",
              background: "rgba(255,0,0,0.10)",
              color: "var(--text)",
              fontSize: 13
            }}
          >
            <strong style={{ color: "var(--accent)" }}>AI Error:</strong> {error}
            {error.includes("Pro only") && (
              <button
                type="button"
                onClick={() => {
                  onClose?.();
                  navigate("/pro");
                }}
                style={{
                  display: "block",
                  marginTop: 10,
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: "var(--accent)",
                  color: "var(--text)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Upgrade to Pro
              </button>
            )}
          </div>
        )}

        {/* CHAT */}

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10
          }}
        >

          {messages.length === 0 && !loading ? (
            <EmptyState icon="🤖" message="Ask ArmPal anything — form, nutrition, or motivation." />
          ) : null}

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
                overflowWrap: "break-word",
                color: m.role === "user" ? "#fff" : "var(--text)"
              }}
            >

              {m.isWorkoutCard ? (

                <div>
                  <strong>{m.content?.title ?? "Workout"}</strong>
                  {(Array.isArray(m.content?.exercises) ? m.content.exercises : []).map((ex, idx) => (
                    <div key={idx} style={{ marginTop: 6 }}>
                      <div><strong>{getDisplayText(ex)}</strong></div>
                    </div>
                  ))}
                  <button
                    onClick={() => saveWorkout(m.content)}
                    style={{
                      marginTop: 10,
                      background: "var(--accent)",
                      border: "none",
                      borderRadius: 8,
                      padding: "6px 12px",
                      color: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    Save Workout
                  </button>
                </div>

              ) : m.content}

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
            flexShrink: 0
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
              outline: "none"
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
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? "…" : "Send"}
          </button>

        </div>

        {showSettings && (
          <AISettingsOverlay onClose={() => setShowSettings(false)} />
        )}

          </div>
        </div>
      </div>

      {/* Delete conversation confirm */}
      {deleteConfirmId && (
        <div
          className="modal-overlay"
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10
          }}
          onClick={() => setDeleteConfirmId(null)}
        >
          <div
            className="modal-content"
            style={{
              background: "var(--card)",
              padding: 20,
              borderRadius: 12,
              border: "1px solid var(--border)",
              maxWidth: 280
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ margin: "0 0 16px" }}>Delete chat?</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text)",
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: "var(--accent)",
                  color: "var(--text)",
                  cursor: "pointer"
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
