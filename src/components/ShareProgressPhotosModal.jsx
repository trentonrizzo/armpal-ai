// src/components/ShareProgressPhotosModal.jsx
//
// Native-feeling bottom sheet for sharing selected Progress Photos through the
// EXISTING chat-image system (chat-images bucket + messages table). The actual
// upload + message insert lives in src/lib/sendChatImage.js, which mirrors
// ChatPage.sendImage exactly (no parallel media system).

import React, { useEffect, useState } from "react";
import { FaTimes, FaCheck, FaPaperPlane } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import { useToast } from "./ToastProvider";
import { sendImageToFriend } from "../lib/sendChatImage";

const ANIM_STYLE_ID = "share-progress-photos-modal-anim";

function ensureAnimStyle() {
  if (typeof document === "undefined") return;
  if (document.getElementById(ANIM_STYLE_ID)) return;
  const tag = document.createElement("style");
  tag.id = ANIM_STYLE_ID;
  tag.textContent = `
    @keyframes sppmFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes sppmSlideUp {
      from { transform: translateY(24px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;
  document.head.appendChild(tag);
}

export default function ShareProgressPhotosModal({ open, photos, onClose, onSent }) {
  const toast = useToast();
  const [me, setMe] = useState(null);
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    ensureAnimStyle();
  }, []);

  // Reset + load on open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSelectedFriends(new Set());
    setError("");
    setLoading(true);

    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (cancelled) return;
        const uid = u?.user?.id || null;
        setMe(u?.user || null);
        if (!uid) {
          setFriends([]);
          return;
        }

        const { data: frRows, error: frErr } = await supabase
          .from("friends")
          .select("user_id,friend_id,status,created_at")
          .eq("status", "accepted")
          .or(`user_id.eq.${uid},friend_id.eq.${uid}`);
        if (frErr) throw frErr;

        const otherIds = Array.from(
          new Set(
            (frRows || [])
              .map((r) => (r.user_id === uid ? r.friend_id : r.user_id))
              .filter(Boolean)
          )
        );

        if (otherIds.length === 0) {
          if (!cancelled) setFriends([]);
          return;
        }

        const { data: profs, error: pErr } = await supabase
          .from("profiles")
          .select("id,username,display_name,avatar_url")
          .in("id", otherIds);
        if (pErr) throw pErr;

        if (cancelled) return;
        const list = (profs || []).map((p) => ({
          id: p.id,
          name: p.display_name || p.username || "Friend",
          avatar_url: p.avatar_url || "",
        }));
        list.sort((a, b) => a.name.localeCompare(b.name));
        setFriends(list);
      } catch (err) {
        if (!cancelled) setError(err?.message || "Could not load friends.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function toggleFriend(id) {
    setSelectedFriends((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function send() {
    if (sending) return;
    if (!me?.id) {
      toast.error("Not signed in.");
      return;
    }
    if (!photos?.length) {
      toast.error("No photos selected.");
      return;
    }
    if (selectedFriends.size === 0) {
      toast.error("Pick at least one friend.");
      return;
    }

    setSending(true);
    setError("");

    const friendIds = Array.from(selectedFriends);
    let sentCount = 0;
    let failedCount = 0;
    let firstError = "";

    for (const friendId of friendIds) {
      for (const photo of photos) {
        const file = photo?.blob instanceof Blob ? photo.blob : null;
        if (!file) {
          failedCount += 1;
          firstError = firstError || "Photo unavailable.";
          continue;
        }
        const fileName = photo?.id
          ? `${photo.id}.${(file.type || "image/jpeg").split("/")[1] || "jpg"}`
          : undefined;
        const res = await sendImageToFriend({
          senderId: me.id,
          friendId,
          file,
          fileName,
        });
        if (res.ok) sentCount += 1;
        else {
          failedCount += 1;
          firstError = firstError || res.error || "Send failed.";
        }
      }
    }

    setSending(false);

    if (sentCount > 0 && failedCount === 0) {
      toast.success(
        sentCount === 1 ? "Photo sent." : `Sent ${sentCount} photos.`
      );
      onSent?.();
      onClose?.();
    } else if (sentCount > 0 && failedCount > 0) {
      toast.error(
        `Sent ${sentCount}, ${failedCount} failed${
          firstError ? `: ${firstError}` : "."
        }`
      );
      onSent?.();
    } else {
      toast.error(firstError || "Could not send.");
    }
  }

  if (!open) return null;

  const photoCount = photos?.length || 0;
  const friendCount = selectedFriends.size;
  const canSend =
    !sending && friendCount > 0 && photoCount > 0 && friends.length > 0;

  const sendLabel = sending
    ? "Sending…"
    : friendCount === 0
    ? "Send"
    : friendCount === 1
    ? "Send to 1 friend"
    : `Send to ${friendCount} friends`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Send photos to friends"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        zIndex: 10001,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        animation: "sppmFadeIn 160ms ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          // Cap the sheet so it never eats the whole screen, and let the inner
          // scroll region absorb tall friend lists.
          maxHeight: "min(85dvh, 720px)",
          height: "auto",
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          color: "var(--text)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.35)",
          animation: "sppmSlideUp 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {/* Drag handle */}
        <div
          aria-hidden="true"
          style={{
            display: "flex",
            justifyContent: "center",
            paddingTop: 8,
            paddingBottom: 4,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 40,
              height: 4,
              borderRadius: 999,
              background: "var(--border)",
              opacity: 0.7,
            }}
          />
        </div>

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "8px 16px 12px",
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.2 }}>
              Send to friends
            </div>
            <div style={{ fontSize: 12, opacity: 0.65, marginTop: 3 }}>
              {photoCount} photo{photoCount === 1 ? "" : "s"} selected
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={closeBtn}
          >
            <FaTimes />
          </button>
        </div>

        {/* Friends list — the ONLY scrolling region */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
            borderTop: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
            background: "var(--card-2)",
          }}
        >
          {loading ? (
            <div style={{ padding: 20, fontSize: 13, opacity: 0.7 }}>
              Loading friends…
            </div>
          ) : error ? (
            <div style={{ padding: 20, fontSize: 13, color: "var(--accent)" }}>
              {error}
            </div>
          ) : friends.length === 0 ? (
            <div
              style={{
                padding: 24,
                fontSize: 13,
                opacity: 0.7,
                textAlign: "center",
              }}
            >
              You don't have any friends yet. Add a friend first to send photos.
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {friends.map((f, idx) => {
                const isSel = selectedFriends.has(f.id);
                const isLast = idx === friends.length - 1;
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => toggleFriend(f.id)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 16px",
                        background: isSel
                          ? "color-mix(in srgb, var(--accent) 14%, transparent)"
                          : "transparent",
                        border: "none",
                        borderBottom: isLast
                          ? "none"
                          : "1px solid var(--border)",
                        textAlign: "left",
                        color: "var(--text)",
                        cursor: "pointer",
                        minHeight: 60,
                      }}
                    >
                      {f.avatar_url ? (
                        <img
                          src={f.avatar_url}
                          alt=""
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 999,
                            objectFit: "cover",
                            background: "var(--card)",
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 999,
                            background: "var(--card)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 800,
                            fontSize: 15,
                            border: "1px solid var(--border)",
                            flexShrink: 0,
                          }}
                        >
                          {f.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 15,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {f.name}
                        </div>
                      </div>
                      <div
                        aria-hidden="true"
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 999,
                          background: isSel
                            ? "var(--accent)"
                            : "transparent",
                          border: isSel
                            ? "2px solid var(--accent)"
                            : "2px solid var(--border)",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 900,
                          flexShrink: 0,
                          transition:
                            "background 120ms ease, border-color 120ms ease",
                        }}
                      >
                        {isSel ? <FaCheck /> : ""}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Sticky action bar — always visible, respects iOS home indicator */}
        <div
          style={{
            flexShrink: 0,
            padding: "12px 16px",
            paddingBottom: "calc(12px + var(--safe-area-bottom))",
            background: "var(--card)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 14,
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              fontWeight: 800,
              fontSize: 16,
              cursor: canSend ? "pointer" : "default",
              opacity: canSend ? 1 : 0.5,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: canSend
                ? "0 6px 18px rgba(225,0,0,0.35)"
                : "none",
              transition: "opacity 120ms ease, box-shadow 120ms ease",
            }}
          >
            <FaPaperPlane />
            <span>{sendLabel}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 12,
              border: "none",
              background: "transparent",
              color: "var(--text)",
              fontWeight: 600,
              fontSize: 14,
              cursor: sending ? "default" : "pointer",
              opacity: sending ? 0.5 : 0.85,
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

const closeBtn = {
  width: 36,
  height: 36,
  borderRadius: 999,
  border: "1px solid var(--border)",
  background: "var(--card-2)",
  color: "var(--text)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
};
