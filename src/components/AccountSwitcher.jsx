import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import AuthPage from "../AuthPage";
import { useToast } from "./ToastProvider";
import {
  getSavedAccounts,
  removeSavedAccount,
  switchToAccount,
  syncCurrentSession,
} from "../lib/accountManager";
import { OFFICIAL_NAME_STYLE } from "../utils/officialStyle";

function haptic(ms = 10) {
  try {
    navigator?.vibrate?.(ms);
  } catch {
    /* ignore */
  }
}

function getAccountBadges(account) {
  const badges = [];
  const identity = `${account.username || ""} ${account.handle || ""} ${account.email || ""}`.toLowerCase();
  if (account.isOfficial || identity.includes("armpal")) badges.push("OFFICIAL");
  if (account.isCoaching) badges.push("COACH");
  if (String(account.role || "").toLowerCase() === "admin") badges.push("ADMIN");
  return badges;
}

const badgeStyle = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.4,
  padding: "2px 6px",
  borderRadius: 999,
  border: "1px solid #d4af37",
  color: "#d4af37",
  background: "rgba(212,175,55,0.1)",
};

export default function AccountSwitcher({ onSwitchComplete }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [switchingId, setSwitchingId] = useState(null);
  const [showAddAccount, setShowAddAccount] = useState(false);

  const refreshAccounts = useCallback(async () => {
    await syncCurrentSession();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
    setAccounts(getSavedAccounts());
  }, []);

  useEffect(() => {
    void refreshAccounts();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refreshAccounts();
    });

    return () => subscription.unsubscribe();
  }, [refreshAccounts]);

  async function handleSwitch(account) {
    if (!account?.userId || account.userId === currentUserId || switchingId) return;

    setSwitchingId(account.userId);
    try {
      await switchToAccount(account);
      haptic(10);
      await refreshAccounts();
      onSwitchComplete?.();
      navigate("/", { replace: true });
    } catch (err) {
      console.warn("[AccountSwitcher] switch failed:", err?.message || err);
      const msg = String(err?.message || "");
      if (/invalid|expired|refresh|jwt|token/i.test(msg)) {
        removeSavedAccount(account.userId);
        await refreshAccounts();
        toast.error("Saved session expired. Add this account again.");
      } else {
        toast.error("Could not switch accounts.");
      }
    } finally {
      setSwitchingId(null);
    }
  }

  function handleRemove(userId) {
    if (!userId || userId === currentUserId) return;
    removeSavedAccount(userId);
    setAccounts(getSavedAccounts());
    haptic(8);
  }

  const canRemove = accounts.length > 1;

  return (
    <>
      <div style={{ marginTop: 10 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 0.5,
            textTransform: "uppercase",
            opacity: 0.55,
            marginBottom: 10,
          }}
        >
          Account Management
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {accounts.map((account) => {
            const isCurrent = account.userId === currentUserId;
            const isSwitching = switchingId === account.userId;
            const badges = getAccountBadges(account);

            return (
              <div
                key={account.userId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: 12,
                  borderRadius: 14,
                  background: "var(--card)",
                  border: isCurrent
                    ? "1px solid var(--accent)"
                    : "1px solid var(--border)",
                  boxShadow: isCurrent
                    ? "0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent), 0 0 18px color-mix(in srgb, var(--accent) 18%, transparent)"
                    : "none",
                  opacity: switchingId && !isSwitching ? 0.72 : 1,
                  transition: "opacity 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
                }}
              >
                <button
                  type="button"
                  onClick={() => !isCurrent && handleSwitch(account)}
                  disabled={isCurrent || !!switchingId}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    cursor: isCurrent || switchingId ? "default" : "pointer",
                    color: "var(--text)",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 999,
                      overflow: "hidden",
                      border: "1px solid var(--border)",
                      background: "var(--card-2)",
                      flexShrink: 0,
                    }}
                  >
                    {account.avatarUrl ? (
                      <img
                        src={account.avatarUrl}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : null}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: 14,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          ...(badges.includes("OFFICIAL") ? OFFICIAL_NAME_STYLE : {}),
                        }}
                      >
                        {account.displayName}
                      </div>
                      {isCurrent ? (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            color: "var(--accent)",
                            letterSpacing: 0.3,
                          }}
                        >
                          Current
                        </span>
                      ) : null}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.65,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {account.email || account.handle || account.username || account.userId}
                    </div>
                    {badges.length > 0 ? (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                        {badges.map((badge) => (
                          <span key={badge} style={badgeStyle}>
                            {badge}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {isSwitching ? (
                    <span
                      aria-hidden
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        border: "2px solid color-mix(in srgb, var(--accent) 30%, transparent)",
                        borderTopColor: "var(--accent)",
                        animation: "accountSwitchSpin 0.7s linear infinite",
                        flexShrink: 0,
                      }}
                    />
                  ) : null}
                </button>

                {canRemove && !isCurrent ? (
                  <button
                    type="button"
                    onClick={() => handleRemove(account.userId)}
                    disabled={!!switchingId}
                    aria-label="Remove saved account"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: "var(--card-2)",
                      color: "var(--text-dim)",
                      cursor: switchingId ? "not-allowed" : "pointer",
                      flexShrink: 0,
                      fontSize: 16,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setShowAddAccount(true)}
          disabled={!!switchingId}
          style={{
            marginTop: 12,
            width: "100%",
            padding: "11px 12px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--card)",
            color: "var(--text)",
            fontWeight: 800,
            fontSize: 14,
            cursor: switchingId ? "not-allowed" : "pointer",
          }}
        >
          Add Account
        </button>
      </div>

      <style>{`
        @keyframes accountSwitchSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {showAddAccount
        ? createPortal(
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 10020,
                background: "rgba(0,0,0,0.82)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding:
                  "calc(16px + env(safe-area-inset-top)) 16px calc(16px + env(safe-area-inset-bottom))",
              }}
              onClick={() => setShowAddAccount(false)}
              role="presentation"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "100%",
                  maxWidth: 420,
                  maxHeight: "min(92dvh, 760px)",
                  overflowY: "auto",
                  borderRadius: 18,
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px 0",
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: 16 }}>Add Account</div>
                  <button
                    type="button"
                    onClick={() => setShowAddAccount(false)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--text-dim)",
                      fontSize: 20,
                      cursor: "pointer",
                      padding: 4,
                    }}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
                <AuthPage
                  addAccountMode
                  onAddAccountCancel={() => setShowAddAccount(false)}
                  onAddAccountSuccess={() => {
                    setShowAddAccount(false);
                    void refreshAccounts();
                    haptic(10);
                    onSwitchComplete?.();
                    navigate("/", { replace: true });
                  }}
                />
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
