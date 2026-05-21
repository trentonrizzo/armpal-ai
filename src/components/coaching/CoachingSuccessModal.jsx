import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../supabaseClient";
import { useToast } from "../ToastProvider";
import { sendFriendRequestToUser } from "../../services/friendRequests";
import { OFFICIAL_NAME_STYLE } from "../../utils/officialStyle";

const OVERLAY = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.78)",
  zIndex: 10003,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "calc(16px + env(safe-area-inset-top)) 16px calc(16px + env(safe-area-inset-bottom))",
  animation: "coachingSuccessOverlayIn 0.22s ease-out",
};

const MODAL = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 18,
  padding: 22,
  maxWidth: 440,
  width: "100%",
  color: "var(--text)",
  boxShadow: "0 24px 64px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)",
  animation: "coachingSuccessModalIn 0.26s cubic-bezier(0.22, 1, 0.36, 1)",
};

const BTN_PRIMARY = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 14,
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  fontSize: 15,
  fontWeight: 800,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
};

const BTN_SECONDARY = {
  ...BTN_PRIMARY,
  background: "transparent",
  color: "var(--text)",
  border: "1px solid var(--border)",
  marginTop: 10,
  fontWeight: 700,
};

const officialPill = {
  padding: "4px 10px",
  borderRadius: 999,
  border: "1px solid #d4af37",
  background: "rgba(212,175,55,0.12)",
  color: "#d4af37",
  fontSize: 12,
  fontWeight: 900,
};

function isArmPalUsername(value) {
  return String(value || "").trim().toUpperCase() === "ARMPAL";
}

export default function CoachingSuccessModal({ open, profile, onClose }) {
  const toast = useToast();
  const [connecting, setConnecting] = useState(false);
  const connectInFlightRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !connecting) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, connecting]);

  if (!open) return null;

  const accountLabel =
    profile?.display_name || profile?.username || profile?.handle || "ArmPal";
  const accountHandle = profile?.handle || profile?.username || "ARMPAL";
  const showOfficialBadge =
    profile?.is_official === true ||
    isArmPalUsername(profile?.username) ||
    isArmPalUsername(profile?.handle);

  async function handleConnect() {
    if (connectInFlightRef.current || connecting || !profile?.id) return;

    connectInFlightRef.current = true;
    setConnecting(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        toast.error("Please sign in to connect.");
        return;
      }

      const result = await sendFriendRequestToUser(userId, profile.id);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      if (result.message) toast.success(result.message);
      onClose?.();
    } catch (err) {
      console.error("[coaching] friend request failed:", err);
      toast.error("Error sending request.");
    } finally {
      connectInFlightRef.current = false;
      setConnecting(false);
    }
  }

  return createPortal(
    <>
      <style>{`
        @keyframes coachingSuccessOverlayIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes coachingSuccessModalIn {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes coachingSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div style={OVERLAY} onClick={() => !connecting && onClose?.()} role="presentation">
        <div
          style={MODAL}
          role="dialog"
          aria-modal="true"
          aria-labelledby="coaching-success-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "color-mix(in srgb, var(--accent) 22%, var(--card-2))",
              border: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              marginBottom: 14,
            }}
            aria-hidden
          >
            ✓
          </div>

          <h2
            id="coaching-success-title"
            style={{ fontSize: 22, fontWeight: 900, margin: "0 0 8px", lineHeight: 1.2 }}
          >
            Connect with ArmPal
          </h2>

          <p style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.55, color: "var(--text-dim)" }}>
            Send a friend request to the official ArmPal account.
          </p>

          <div
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              background: "var(--card-2)",
              border: "1px solid var(--border)",
              marginBottom: 18,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                color: "var(--text-dim)",
                marginBottom: 6,
              }}
            >
              Official ArmPal Account
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 999,
                    objectFit: "cover",
                    border: "1px solid var(--border)",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 999,
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                  }}
                />
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 15,
                      ...(showOfficialBadge ? OFFICIAL_NAME_STYLE : {}),
                    }}
                  >
                    {accountLabel}
                  </div>
                  {showOfficialBadge ? <span style={officialPill}>Official</span> : null}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-dim)",
                    ...(showOfficialBadge ? OFFICIAL_NAME_STYLE : {}),
                  }}
                >
                  @{accountHandle}
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            style={BTN_PRIMARY}
            disabled={connecting || !profile?.id}
            onClick={handleConnect}
          >
            {connecting ? (
              <>
                <span
                  aria-hidden
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    border: "2px solid rgba(255,255,255,0.35)",
                    borderTopColor: "#fff",
                    animation: "coachingSpin 0.7s linear infinite",
                  }}
                />
                Sending…
              </>
            ) : (
              "Connect on ArmPal"
            )}
          </button>

          <button
            type="button"
            style={BTN_SECONDARY}
            disabled={connecting}
            onClick={() => onClose?.()}
          >
            Maybe Later
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
