// src/AuthPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

/**
 * ArmPal AuthPage (SAFE: does NOT touch App.jsx)
 *
 * ✅ Login + Signup UI
 * ✅ "Send reset email"
 * ✅ REAL reset-password screen that actually appears on iOS/Safari
 *
 * The missing piece you were fighting:
 * - Supabase reset links often arrive as /auth?code=XXXX&type=recovery (PKCE)
 * - You MUST exchange the code for a session:
 *     supabase.auth.exchangeCodeForSession(code)
 * - Then show the reset UI.
 */

function parseHashParams(hashStr) {
  const h = (hashStr || "").replace(/^#/, "");
  return new URLSearchParams(h);
}

function parseSearchParams(searchStr) {
  const s = (searchStr || "").replace(/^\?/, "");
  return new URLSearchParams(s);
}

function stripAuthParamsFromUrl() {
  try {
    const url = new URL(window.location.href);
    // Remove common auth params
    [
      "code",
      "type",
      "access_token",
      "refresh_token",
      "expires_in",
      "expires_at",
      "token_type",
      "error",
      "error_code",
      "error_description",
    ].forEach((k) => url.searchParams.delete(k));

    // Also clear hash if it contains tokens
    url.hash = "";

    window.history.replaceState({}, "", url.pathname + url.search);
  } catch {
    // ignore
  }
}

function urlLooksLikeRecovery() {
  if (typeof window === "undefined") return false;

  const hash = window.location.hash || "";
  const search = window.location.search || "";

  const hp = parseHashParams(hash);
  const sp = parseSearchParams(search);

  const typeHash = (hp.get("type") || "").toLowerCase();
  const typeSearch = (sp.get("type") || "").toLowerCase();

  const hasCode = !!sp.get("code") || !!hp.get("code");
  const hasAccessToken = !!hp.get("access_token") || !!sp.get("access_token");
  const hasRefreshToken = !!hp.get("refresh_token") || !!sp.get("refresh_token");

  if (typeHash === "recovery" || typeSearch === "recovery") return true;
  if (hasCode) return true;
  if (hasAccessToken && hasRefreshToken) return true;

  return false;
}

export default function AuthPage() {
  const [mode, setMode] = useState("login"); // login | signup | resetRequest | resetSet
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // {type:"error"|"success", text:string}

  const [hasSession, setHasSession] = useState(false);

  // Prevent double-exchange on iOS reloads
  const exchangeRanRef = useRef(false);

  const origin = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  async function refreshSessionFlag() {
    const { data } = await supabase.auth.getSession();
    setHasSession(!!data?.session);
    return data?.session || null;
  }

  async function tryConsumeRecoveryLink() {
    if (exchangeRanRef.current) return;
    exchangeRanRef.current = true;

    const looksRecovery = urlLooksLikeRecovery();
    if (!looksRecovery) return;

    // Immediately force UI into reset mode so you SEE the screen
    setMode("resetSet");
    setMsg(null);

    const sp = parseSearchParams(window.location.search || "");
    const hp = parseHashParams(window.location.hash || "");

    const code = sp.get("code") || hp.get("code");
    const type = (sp.get("type") || hp.get("type") || "").toLowerCase();

    try {
      // PKCE: /auth?code=...&type=recovery  → exchange the code for a session
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        await refreshSessionFlag();
        stripAuthParamsFromUrl();
        setMode("resetSet");
        setMsg({ type: "success", text: "Recovery link accepted. Set your new password." });
        return;
      }

      // Implicit flow fallback: #access_token=...&refresh_token=...&type=recovery
      const access_token = hp.get("access_token") || sp.get("access_token");
      const refresh_token = hp.get("refresh_token") || sp.get("refresh_token");

      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) throw error;
        await refreshSessionFlag();
        stripAuthParamsFromUrl();
        setMode("resetSet");
        setMsg({ type: "success", text: "Recovery link accepted. Set your new password." });
        return;
      }

      // If it looks like recovery but no tokens/code, still stay on reset screen
      if (type === "recovery") {
        await refreshSessionFlag();
        setMode("resetSet");
      }
    } catch (e) {
      setMode("resetSet");
      setMsg({
        type: "error",
        text:
          e?.message ||
          "Could not consume recovery link. Try opening the newest reset email link again.",
      });
    }
  }

  useEffect(() => {
    // On mount:
    // 1) try consume recovery link (PKCE exchange) so reset screen actually shows
    // 2) listen for PASSWORD_RECOVERY event as extra safety
    // 3) keep session flag updated
    (async () => {
      await refreshSessionFlag();
      await tryConsumeRecoveryLink();
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event) => {
      // This sometimes fires on Safari only AFTER exchange, but we support it anyway.
      if (event === "PASSWORD_RECOVERY") {
        setMode("resetSet");
        setMsg({ type: "success", text: "Recovery mode detected. Set your new password." });
        await refreshSessionFlag();
        stripAuthParamsFromUrl();
      }
      if (event === "SIGNED_IN") {
        await refreshSessionFlag();
      }
      if (event === "SIGNED_OUT") {
        setHasSession(false);
      }
    });

    return () => {
      sub?.subscription?.unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin() {
    setMsg(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // App's auth gating will handle redirect after login.
    } catch (e) {
      setMsg({ type: "error", text: e?.message || "Login failed." });
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup() {
    setMsg(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      setMsg({
        type: "success",
        text: "Account created. If email confirmation is enabled, check your inbox.",
      });
      setMode("login");
    } catch (e) {
      setMsg({ type: "error", text: e?.message || "Signup failed." });
    } finally {
      setLoading(false);
    }
  }

  async function sendResetEmail() {
    setMsg(null);
    if (!email) {
      setMsg({ type: "error", text: "Enter your email first." });
      return;
    }

    setLoading(true);
    try {
      // IMPORTANT: force reset link back to /auth so our reset screen can render
      const redirectTo = `${origin}/auth`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;

      setMsg({
        type: "success",
        text: "Reset email sent. Open the NEWEST email link to reset your password.",
      });
    } catch (e) {
      setMsg({ type: "error", text: e?.message || "Could not send reset email." });
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordUpdate() {
    setMsg(null);

    if (!password || password.length < 6) {
      setMsg({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }
    if (password !== confirm) {
      setMsg({ type: "error", text: "Passwords do not match." });
      return;
    }

    setLoading(true);
    try {
      // Must have a session from recovery link exchange
      const session = await refreshSessionFlag();
      if (!session) {
        setMsg({
          type: "error",
          text:
            "No recovery session found. Open the newest reset email link again (it must load /auth with a code).",
        });
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setMsg({ type: "success", text: "Password updated. Returning you to login…" });

      // End recovery session and return to login clean
      await supabase.auth.signOut();
      setHasSession(false);

      setTimeout(() => {
        window.location.href = "/auth";
      }, 800);
    } catch (e) {
      setMsg({ type: "error", text: e?.message || "Could not update password." });
    } finally {
      setLoading(false);
    }
  }

  const isLogin = mode === "login";
  const isSignup = mode === "signup";
  const isResetRequest = mode === "resetRequest";
  const isResetSet = mode === "resetSet";

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.brandRow}>
          <div style={styles.brandDot} />
          <div>
            <div style={styles.logo}>ArmPal</div>
            <div style={styles.tagline}>Train. Track. Dominate.</div>
          </div>
        </div>

        <div style={styles.tabs}>
          <button
            style={{
              ...styles.tabBtn,
              ...(isLogin ? styles.tabBtnActive : null),
            }}
            onClick={() => {
              setMode("login");
              setMsg(null);
              setConfirm("");
            }}
            disabled={loading}
          >
            Log in
          </button>
          <button
            style={{
              ...styles.tabBtn,
              ...(isSignup ? styles.tabBtnActive : null),
            }}
            onClick={() => {
              setMode("signup");
              setMsg(null);
              setConfirm("");
            }}
            disabled={loading}
          >
            Sign up
          </button>
        </div>

        {msg && (
          <div style={msg.type === "error" ? styles.errorBox : styles.successBox}>
            {msg.text}
          </div>
        )}

        {/* RESET SET SCREEN (THIS IS WHAT YOU WANT TO SEE) */}
        {isResetSet ? (
          <>
            <div style={styles.sectionTitle}>Reset Password</div>
            <div style={styles.sectionSub}>
              Enter a new password, confirm it, then save.
            </div>

            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              autoComplete="new-password"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={styles.input}
              autoComplete="new-password"
            />

            <button
              onClick={handlePasswordUpdate}
              disabled={loading}
              style={styles.primaryBtn}
            >
              {loading ? "Saving…" : "Save new password"}
            </button>

            <button
              onClick={() => {
                setMode("login");
                setPassword("");
                setConfirm("");
                setMsg(null);
              }}
              disabled={loading}
              style={styles.secondaryBtn}
            >
              Back to login
            </button>

            <div style={styles.hint}>
              If you landed here without the recovery session, open the **newest**
              reset email link again (it should load <b>/auth?code=...</b>).
            </div>
          </>
        ) : isResetRequest ? (
          <>
            <div style={styles.sectionTitle}>Forgot password?</div>
            <div style={styles.sectionSub}>
              Enter your email and we’ll send a reset link.
            </div>

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              autoComplete="email"
            />

            <button
              onClick={sendResetEmail}
              disabled={loading}
              style={styles.primaryBtn}
            >
              {loading ? "Sending…" : "Send reset email"}
            </button>

            <button
              onClick={() => {
                setMode("login");
                setMsg(null);
              }}
              disabled={loading}
              style={styles.secondaryBtn}
            >
              Back
            </button>
          </>
        ) : (
          <>
            {/* LOGIN / SIGNUP */}
            <div style={styles.sectionTitle}>
              {isSignup ? "Create account" : "Welcome back"}
            </div>

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              autoComplete="email"
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              autoComplete={isSignup ? "new-password" : "current-password"}
            />

            <button
              onClick={isSignup ? handleSignup : handleLogin}
              disabled={loading}
              style={styles.primaryBtn}
            >
              {loading ? "Please wait…" : isSignup ? "Sign up" : "Log in"}
            </button>

            <button
              onClick={() => {
                setMode("resetRequest");
                setMsg(null);
              }}
              disabled={loading}
              style={styles.linkBtn}
            >
              Forgot password?
            </button>

            <div style={styles.footerNote}>
              ArmPal • black/white/red • clean & sexy • no clutter
            </div>

            {/* Debug hint only if needed */}
            <div style={styles.microHint}>
              {hasSession
                ? "Session detected."
                : "No session (normal unless you opened a recovery link)."}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#000",
    color: "white",
    padding: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: "100%",
    maxWidth: 440,
    background: "#0b0b0c",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 20,
    padding: 18,
    boxShadow: "0 12px 60px rgba(0,0,0,0.65)",
  },
  brandRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 12 },
  brandDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "#ff2f2f",
    boxShadow: "0 0 22px rgba(255,47,47,0.55)",
  },
  logo: { fontSize: 34, fontWeight: 950, letterSpacing: 0.2, lineHeight: 1 },
  tagline: { opacity: 0.65, fontWeight: 700, marginTop: 4 },

  tabs: {
    display: "flex",
    gap: 10,
    background: "#0f0f10",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 16,
    padding: 6,
    marginTop: 14,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    border: "none",
    background: "transparent",
    color: "rgba(255,255,255,0.8)",
    fontWeight: 900,
    cursor: "pointer",
  },
  tabBtnActive: {
    background: "rgba(255,47,47,0.14)",
    color: "white",
    boxShadow: "0 0 24px rgba(255,47,47,0.18)",
  },

  sectionTitle: { fontSize: 16, fontWeight: 950, marginBottom: 8, opacity: 0.95 },
  sectionSub: { fontSize: 13, opacity: 0.65, marginBottom: 12, lineHeight: 1.3 },

  input: {
    width: "100%",
    padding: 14,
    marginBottom: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "#101012",
    color: "white",
    outline: "none",
    fontSize: 15,
  },

  primaryBtn: {
    width: "100%",
    padding: 16,
    borderRadius: 16,
    border: "none",
    background: "#ff2f2f",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 10px 40px rgba(255,47,47,0.18)",
  },
  secondaryBtn: {
    width: "100%",
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "#0f0f10",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    marginTop: 10,
  },
  linkBtn: {
    width: "100%",
    padding: 12,
    borderRadius: 16,
    border: "none",
    background: "transparent",
    color: "rgba(255,255,255,0.75)",
    fontWeight: 900,
    cursor: "pointer",
    marginTop: 10,
  },

  errorBox: {
    background: "rgba(255,47,47,0.14)",
    border: "1px solid rgba(255,47,47,0.25)",
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
    fontSize: 13,
    lineHeight: 1.35,
  },
  successBox: {
    background: "rgba(0,200,100,0.14)",
    border: "1px solid rgba(0,200,100,0.22)",
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
    fontSize: 13,
    lineHeight: 1.35,
  },

  hint: {
    marginTop: 12,
    opacity: 0.6,
    fontSize: 12,
    lineHeight: 1.35,
  },
  footerNote: {
    marginTop: 14,
    opacity: 0.45,
    fontSize: 12,
    textAlign: "center",
    fontWeight: 800,
  },
  microHint: {
    marginTop: 10,
    opacity: 0.35,
    fontSize: 11,
    textAlign: "center",
  },
};
