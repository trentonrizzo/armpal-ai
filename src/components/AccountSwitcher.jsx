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

function accountSubtitle(account) {
  if (account.handle) return `@${account.handle}`;
  if (account.username) return `@${account.username}`;
  return account.email || "";
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

export default function AccountSwitcher({ open, onClose, onSwitchComplete }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [switchingId, setSwitchingId] = useState(null);
  const [manageMode, setManageMode] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [visible, setVisible] = useState(false);

  const refreshAccounts = useCallback(async () => {
    await syncCurrentSession();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
    setAccounts(getSavedAccounts());
  }, []);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      setManageMode(false);
      setRemoveTarget(null);
      return;
    }

    setVisible(true);
    void refreshAccounts();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      if (open) void refreshAccounts();
    });

    return () => subscription.unsubscribe();
  }, [open, refreshAccounts]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !showAddAccount && !removeTarget && !switchingId) {
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, showAddAccount, removeTarget, switchingId]);

  async function handleSwitch(account) {
    if (!account?.userId || account.userId === currentUserId || switchingId || manageMode) return;

    setSwitchingId(account.userId);
    try {
      await switchToAccount(account);
      haptic(10);
      await refreshAccounts();
      onClose?.();
      onSwitchComplete?.();
      navigate("/", { replace: true });
    } catch (err) {
      console.warn("[AccountSwitcher] switch failed:", err?.message || err);
      const msg = String(err?.message || "Could not switch accounts.");
      toast.error(msg.includes("Session expired") ? msg : "Could not switch accounts.");
      if (/expired|invalid|refresh|jwt|token|session/i.test(msg)) {
        removeSavedAccount(account.userId);
        await refreshAccounts();
      }
    } finally {
      setSwitchingId(null);
    }
  }

  function confirmRemove() {
    if (!removeTarget?.userId || removeTarget.userId === currentUserId) {
      setRemoveTarget(null);
      return;
    }
    removeSavedAccount(removeTarget.userId);
    setAccounts(getSavedAccounts());
    setRemoveTarget(null);
    haptic(8);
  }

  if (!open) return null;

  return createPortal(
    <>
      <div
        role="presentation"
        onClick={() => {
          if (!showAddAccount && !removeTarget && !switchingId) onClose?.();
        }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10050,
          background: visible ? "rgba(0,0,0,0.72)" : "rgba(0,0,0,0)",
          transition: "background 0.22s ease",
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-switcher-title"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10051,
          background: "var(--card)",
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          border: "1px solid var(--border)",
          borderBottom: "none",
          boxShadow: "0 -12px 40px rgba(0,0,0,0.45)",
          padding: "10px 16px calc(16px + env(safe-area-inset-bottom))",
          maxHeight: "min(78dvh, 620px)",
          display: "flex",
          flexDirection: "column",
          transform: visible ? "translateY(0)" : "translateY(105%)",
          transition: "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            width: 42,
            height: 4,
            borderRadius: 999,
            background: "color-mix(in srgb, var(--text) 22%, transparent)",
            margin: "2px auto 14px",
          }}
        />

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h2 id="account-switcher-title" style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
              Switch Account
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-dim)", lineHeight: 1.45 }}>
              Choose a saved profile or add another one.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onClose?.()}
            aria-label="Close"
            style={{
              border: "none",
              background: "var(--card-2)",
              color: "var(--text-dim)",
              width: 34,
              height: 34,
              borderRadius: 999,
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ overflowY: "auto", marginTop: 14, flex: 1, minHeight: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 14,
                    background: "var(--card-2)",
                    border: isCurrent
                      ? "1px solid var(--accent)"
                      : "1px solid var(--border)",
                    boxShadow: isCurrent
                      ? "0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent), 0 0 16px color-mix(in srgb, var(--accent) 16%, transparent)"
                      : "none",
                    opacity: switchingId && !isSwitching ? 0.65 : 1,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleSwitch(account)}
                    disabled={isCurrent || !!switchingId || manageMode}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      cursor: isCurrent || switchingId || manageMode ? "default" : "pointer",
                      color: "var(--text)",
                      textAlign: "left",
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 999,
                        overflow: "hidden",
                        border: "1px solid var(--border)",
                        background: "var(--card)",
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
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: 15,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            ...(badges.includes("OFFICIAL") ? OFFICIAL_NAME_STYLE : {}),
                          }}
                        >
                          {account.displayName}
                        </div>
                        {isCurrent ? (
                          <span style={{ fontSize: 10, fontWeight: 800, color: "var(--accent)" }}>
                            Current
                          </span>
                        ) : null}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-dim)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {accountSubtitle(account)}
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

                  {manageMode && !isCurrent && accounts.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setRemoveTarget(account)}
                      disabled={!!switchingId}
                      aria-label="Remove saved account"
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        border: "1px solid color-mix(in srgb, var(--accent) 35%, var(--border))",
                        background: "color-mix(in srgb, var(--accent) 12%, var(--card))",
                        color: "var(--accent)",
                        cursor: switchingId ? "not-allowed" : "pointer",
                        flexShrink: 0,
                        fontSize: 15,
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
        </div>

        <button
          type="button"
          onClick={() => setShowAddAccount(true)}
          disabled={!!switchingId}
          style={{
            marginTop: 12,
            width: "100%",
            padding: "13px 14px",
            borderRadius: 14,
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            fontWeight: 900,
            fontSize: 15,
            cursor: switchingId ? "not-allowed" : "pointer",
          }}
        >
          + Add Account
        </button>

        {accounts.length > 1 ? (
          <button
            type="button"
            onClick={() => setManageMode((v) => !v)}
            disabled={!!switchingId}
            style={{
              marginTop: 8,
              width: "100%",
              padding: "11px 14px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: manageMode ? "color-mix(in srgb, var(--accent) 10%, var(--card-2))" : "transparent",
              color: manageMode ? "var(--accent)" : "var(--text-dim)",
              fontWeight: 700,
              fontSize: 13,
              cursor: switchingId ? "not-allowed" : "pointer",
            }}
          >
            {manageMode ? "Done managing" : "Manage accounts"}
          </button>
        ) : null}
      </div>

      {showAddAccount ? (
        <div
          role="presentation"
          onClick={() => setShowAddAccount(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10060,
            background: "rgba(0,0,0,0.82)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 480,
              maxHeight: "min(92dvh, 760px)",
              overflowY: "auto",
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              border: "1px solid var(--border)",
              borderBottom: "none",
              background: "var(--card)",
              paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
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
                aria-label="Close add account"
              >
                ✕
              </button>
            </div>
            <AuthPage
              addAccountMode
              onAddAccountCancel={() => setShowAddAccount(false)}
              onAddAccountSuccess={async () => {
                setShowAddAccount(false);
                await refreshAccounts();
                haptic(10);
                onSwitchComplete?.();
                navigate("/", { replace: true });
              }}
            />
          </div>
        </div>
      ) : null}

      {removeTarget ? (
        <div
          role="presentation"
          onClick={() => setRemoveTarget(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10070,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 340,
              background: "var(--card)",
              borderRadius: 16,
              padding: 18,
              border: "1px solid var(--border)",
              textAlign: "center",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16 }}>Remove this account from this device?</div>
            <div style={{ opacity: 0.72, marginTop: 8, fontSize: 13, lineHeight: 1.45 }}>
              You&apos;ll need the password to add it again.
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setRemoveTarget(null)}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  background: "transparent",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  fontWeight: 700,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemove}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  background: "var(--accent)",
                  border: "none",
                  color: "#fff",
                  fontWeight: 800,
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        @keyframes accountSwitchSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>,
    document.body
  );
}
