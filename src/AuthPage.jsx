import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

/**
 * ArmPal AuthPage (FULL)
 * - Login / Sign up
 * - Forgot password -> sends email
 * - Password recovery -> shows Reset Password + Confirm Password
 *
 * IMPORTANT:
 * Supabase recovery links come in two main shapes:
 *  A) Implicit flow (hash): #access_token=...&refresh_token=...&type=recovery
 *  B) PKCE flow (query):   ?code=...
 * We support BOTH and force UI into "recovery" when detected.
 */

function parseHashParams() {
  try {
    const hash = window.location.hash || "";
    const raw = hash.startsWith("#") ? hash.slice(1) : hash;
    return new URLSearchParams(raw);
  } catch {
    return new URLSearchParams("");
  }
}

function parseSearchParams() {
  try {
    const search = window.location.search || "";
    const raw = search.startsWith("?") ? search.slice(1) : search;
    return new URLSearchParams(raw);
  } catch {
    return new URLSearchParams("");
  }
}

function detectRecoveryFromUrl() {
  if (typeof window === "undefined") return { isRecovery: false, hasCode: false };
  const hp = parseHashParams();
  const sp = parseSearchParams();

  const typeHash = (hp.get("type") || "").toLowerCase();
  const typeSearch = (sp.get("type") || "").toLowerCase();

  const hasAccessToken = !!hp.get("access_token") || !!sp.get("access_token");
  const hasRefresh = !!hp.get("refresh_token");
  const hasCode = !!sp.get("code") || !!hp.get("code"); // sometimes shoved in hash

  const isRecovery =
    typeHash === "recovery" ||
    typeSearch === "recovery" ||
    hasAccessToken ||
    hasRefresh ||
    hasCode;

  return { isRecovery, hasCode };
}

export default function AuthPage() {
  const [view, setView] = useState("login"); // login | signup | forgot | recovery
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [msg, setMsg] = useState(null); // {type:'error'|'success'|'info', text:string}
  const [recoveryReady, setRecoveryReady] = useState(false);

  const mountedRef = useRef(false);

  const origin = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  // ---------- Recovery bootstrap ----------
  useEffect(() => {
    mountedRef.current = true;

    const boot = async () => {
      try {
        const { isRecovery, hasCode } = detectRecoveryFromUrl();
        if (isRecovery) {
          setView("recovery");
          setMsg({ type: "info", text: "Loading password reset…" });

          // If PKCE code flow, exchange it for a session
          // (Supabase will then allow updateUser({password}))
          if (hasCode && supabase?.auth?.exchangeCodeForSession) {
            const sp = parseSearchParams();
            const code = sp.get("code") || "";
            if (code) {
              const { error } = await supabase.auth.exchangeCodeForSession(code);
              if (error) throw error;

              // Clean URL (remove code so reload doesn’t re-run exchange)
              try {
                const url = new URL(window.location.href);
                url.searchParams.delete("code");
                url.searchParams.delete("type");
                window.history.replaceState({}, "", url.toString());
              } catch {}
            }
          }

          // Give Supabase a moment to materialize session from hash token flow
          const { data } = await supabase.auth.getSession();
          if (!data?.session) {
            setRecoveryReady(false);
            setMsg({
              type: "error",
              text:
                "Reset link is missing a valid session. Request a new reset email and open the newest link.",
            });
          } else {
            setRecoveryReady(true);
            setMsg(null);
          }
        }
      } catch (e) {
        setRecoveryReady(false);
        setView("login");
        setMsg({ type: "error", text: e?.message || "Recovery link error." });
      }
    };

    boot();

    // ALSO listen for PASSWORD_RECOVERY event (when Supabase emits it)
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (!mountedRef.current) return;
      if (event === "PASSWORD_RECOVERY") {
        setView("recovery");
        setRecoveryReady(true);
        setMsg(null);
      }
    });

    return () => {
      mountedRef.current = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // ---------- Actions ----------
  async function doLogin() {
    setMsg(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: (email || "").trim(),
        password,
      });
      if (error) throw error;
      // Your app-level auth gating will take over after login
    } catch (e) {
      setMsg({ type: "error", text: e?.message || "Login failed." });
    } finally {
      setBusy(false);
    }
  }

  async function doSignup() {
    setMsg(null);
    setBusy(true);
    try {
      if (!email) throw new Error("Enter your email.");
      if (!password || password.length < 6) throw new Error("Password must be at least 6 characters.");
      if (password !== password2) throw new Error("Passwords do not match.");

      // Optional: redirect for email confirmation (if enabled in Supabase)
      const { error } = await supabase.auth.signUp({
        email: (email || "").trim(),
        password,
        options: {
          emailRedirectTo: origin,
        },
      });
      if (error) throw error;

      setMsg({
        type: "success",
        text: "Account created. If email confirmation is enabled, check your inbox.",
      });
    } catch (e) {
      setMsg({ type: "error", text: e?.message || "Sign up failed." });
    } finally {
      setBusy(false);
    }
  }

  async function sendResetEmail() {
    setMsg(null);
    setBusy(true);
    try {
      if (!email) throw new Error("Enter your email first.");

      // ✅ IMPORTANT:
      // Use origin so the app always loads, even if /auth isn't a real route.
      // Supabase will append tokens / code to the URL.
      const { error } = await supabase.auth.resetPasswordForEmail((email || "").trim(), {
        redirectTo: origin,
      });
      if (error) throw error;

      setMsg({
        type: "success",
        text: "Reset email sent. Open the newest email link to reset your password.",
      });
    } catch (e) {
      setMsg({ type: "error", text: e?.message || "Could not send reset email." });
    } finally {
      setBusy(false);
    }
  }

  async function updatePassword() {
    setMsg(null);
    setBusy(true);
    try {
      if (!recoveryReady) throw new Error("Recovery session not ready. Request a new reset email.");
      if (!password || password.length < 6) throw new Error("Password must be at least 6 characters.");
      if (password !== password2) throw new Error("Passwords do not match.");

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setMsg({ type: "success", text: "Password updated. Returning to login…" });

      // End recovery session so they log in clean
      await supabase.auth.signOut();

      setTimeout(() => {
        window.location.href = "/";
      }, 700);
    } catch (e) {
      setMsg({ type: "error", text: e?.message || "Could not update password." });
    } finally {
      setBusy(false);
    }
  }

  // ---------- UI helpers ----------
  const isLogin = view === "login";
  const isSignup = view === "signup";
  const isForgot = view === "forgot";
  const isRecovery = view === "recovery";

  return (
    <div style={S.page}>
      <div style={S.shell}>
        <div style={S.brandRow}>
          <div style={S.dot} />
          <div style={{ flex: 1 }}>
            <div style={S.brand}>ArmPal</div>
            <div style={S.tagline}>
              {isRecovery ? "Reset your password" : "Train. Track. Dominate."}
            </div>
          </div>
        </div>

        {/* Tabs */}
        {!isRecovery && (
          <div style={S.tabs}>
            <button
              onClick={() => {
                setView("login");
                setMsg(null);
              }}
              style={{ ...S.tab, ...(isLogin ? S.tabActive : {}) }}
            >
              Log in
            </button>
            <button
              onClick={() => {
                setView("signup");
                setMsg(null);
              }}
              style={{ ...S.tab, ...(isSignup ? S.tabActive : {}) }}
            >
              Sign up
            </button>
          </div>
        )}

        {msg && (
          <div
            style={{
              ...S.msg,
              ...(msg.type === "error"
                ? S.msgError
                : msg.type === "success"
                ? S.msgSuccess
                : S.msgInfo),
            }}
          >
            {msg.text}
          </div>
        )}

        {/* Recovery */}
        {isRecovery ? (
          <>
            <div style={S.h1}>Reset Password</div>
            <div style={S.p}>
              Enter a new password below. After saving, you’ll return to login.
            </div>

            <label style={S.label}>New password</label>
            <input
              style={S.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              autoComplete="new-password"
            />

            <label style={S.label}>Confirm password</label>
            <input
              style={S.input}
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="Confirm password"
              autoComplete="new-password"
            />

            <button onClick={updatePassword} disabled={busy} style={S.primary}>
              {busy ? "Saving…" : "Save new password"}
            </button>

            <button
              onClick={() => {
                window.location.href = "/";
              }}
              disabled={busy}
              style={S.ghost}
            >
              Back to login
            </button>
          </>
        ) : (
          <>
            {/* Login / Signup / Forgot */}
            <label style={S.label}>Email</label>
            <input
              style={S.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              autoComplete="email"
            />

            <label style={S.label}>Password</label>
            <input
              style={S.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete={isSignup ? "new-password" : "current-password"}
            />

            {isSignup && (
              <>
                <label style={S.label}>Confirm password</label>
                <input
                  style={S.input}
                  type="password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  placeholder="Confirm password"
                  autoComplete="new-password"
                />
              </>
            )}

            {isForgot ? (
              <>
                <button onClick={sendResetEmail} disabled={busy} style={S.primary}>
                  {busy ? "Sending…" : "Send reset email"}
                </button>

                <button
                  onClick={() => {
                    setView("login");
                    setMsg(null);
                  }}
                  disabled={busy}
                  style={S.ghost}
                >
                  Back
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={isSignup ? doSignup : doLogin}
                  disabled={busy}
                  style={S.primary}
                >
                  {busy ? "Working…" : isSignup ? "Create account" : "Log in"}
                </button>

                <button
                  onClick={() => {
                    setView("forgot");
                    setMsg(null);
                  }}
                  disabled={busy}
                  style={S.linkBtn}
                >
                  Forgot password?
                </button>
              </>
            )}
          </>
        )}

        <div style={S.footerHint}>
          ArmPal • black/white/red • clean & sexy • no clutter
        </div>
      </div>
    </div>
  );
}

// ---------- Styles (inline so nothing else can break) ----------
const S = {
  page: {
    minHeight: "100vh",
    background: "#000",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  shell: {
    width: "100%",
    maxWidth: 440,
    background: "#0b0b0c",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 20,
    padding: 18,
    boxShadow: "0 16px 55px rgba(0,0,0,0.65)",
  },
  brandRow: { display: "flex", gap: 10, alignItems: "center", marginBottom: 12 },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "#ff2f2f",
    boxShadow: "0 0 18px rgba(255,47,47,0.55)",
  },
  brand: { fontSize: 30, fontWeight: 900, lineHeight: 1 },
  tagline: { fontSize: 12, opacity: 0.65, marginTop: 4 },

  tabs: {
    display: "flex",
    gap: 8,
    background: "#0f0f10",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 16,
    padding: 6,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 12,
    border: "none",
    background: "transparent",
    color: "rgba(255,255,255,0.75)",
    fontWeight: 900,
    cursor: "pointer",
  },
  tabActive: {
    background: "rgba(255,47,47,0.12)",
    color: "#fff",
    boxShadow: "0 10px 24px rgba(255,47,47,0.10)",
  },

  msg: {
    padding: 12,
    borderRadius: 14,
    fontSize: 13,
    marginBottom: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "#101012",
  },
  msgError: {
    border: "1px solid rgba(255,47,47,0.30)",
    background: "rgba(255,47,47,0.12)",
  },
  msgSuccess: {
    border: "1px solid rgba(0,200,110,0.25)",
    background: "rgba(0,200,110,0.12)",
  },
  msgInfo: {
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
  },

  h1: { fontSize: 18, fontWeight: 900, marginBottom: 6 },
  p: { fontSize: 13, opacity: 0.7, marginBottom: 12, lineHeight: 1.35 },

  label: { fontSize: 12, opacity: 0.7, marginBottom: 6, display: "block" },
  input: {
    width: "100%",
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "#101012",
    color: "#fff",
    outline: "none",
    marginBottom: 10,
  },

  primary: {
    width: "100%",
    padding: 14,
    borderRadius: 14,
    border: "none",
    background: "#ff2f2f",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 16px 28px rgba(255,47,47,0.16)",
    marginTop: 4,
  },
  ghost: {
    width: "100%",
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "#0f0f10",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    marginTop: 10,
  },
  linkBtn: {
    width: "100%",
    padding: 10,
    borderRadius: 14,
    border: "none",
    background: "transparent",
    color: "rgba(255,255,255,0.75)",
    fontWeight: 800,
    cursor: "pointer",
    marginTop: 8,
  },

  footerHint: {
    marginTop: 14,
    fontSize: 11,
    opacity: 0.45,
    textAlign: "center",
  },
};
