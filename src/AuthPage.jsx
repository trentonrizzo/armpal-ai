import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

/**
 * AuthPage
 * - Normal login UI
 * - Password recovery UI that reliably triggers on iOS/Safari
 *   by using BOTH:
 *     1) URL detection (hash/search/access_token/code)
 *     2) Supabase auth event: PASSWORD_RECOVERY (most reliable)
 */

function parseParamsFromHash(hashStr) {
  const h = (hashStr || "").replace(/^#/, "");
  const params = new URLSearchParams(h);
  return params;
}

function parseParamsFromSearch(searchStr) {
  const s = (searchStr || "").replace(/^\?/, "");
  const params = new URLSearchParams(s);
  return params;
}

function urlLooksLikeRecovery() {
  if (typeof window === "undefined") return false;

  const hash = window.location.hash || "";
  const search = window.location.search || "";

  const hp = parseParamsFromHash(hash);
  const sp = parseParamsFromSearch(search);

  // Supabase commonly returns these in the hash for recovery:
  // #access_token=...&refresh_token=...&type=recovery
  const typeHash = (hp.get("type") || "").toLowerCase();
  const typeSearch = (sp.get("type") || "").toLowerCase();

  const hasAccessToken =
    !!hp.get("access_token") || !!sp.get("access_token") || !!hp.get("refresh_token");
  const hasCode = !!sp.get("code") || !!hp.get("code");

  if (typeHash === "recovery" || typeSearch === "recovery") return true;
  if (hasAccessToken || hasCode) return true;

  return false;
}

export default function AuthPage() {
  const [mode, setMode] = useState("login"); // "login" | "recovery"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // {type:"error"|"success", text:string}

  const isRecovery = mode === "recovery";

  const origin = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  useEffect(() => {
    // 1) Detect recovery from URL immediately
    if (urlLooksLikeRecovery()) {
      setMode("recovery");
    }

    // 2) Most reliable: Supabase emits PASSWORD_RECOVERY when link is opened correctly
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("recovery");
        setMsg(null);
      }
    });

    // 3) If session appears shortly after load, keep recovery mode if URL hints it
    supabase.auth.getSession().then(({ data }) => {
      const session = data?.session;
      if (session && urlLooksLikeRecovery()) {
        setMode("recovery");
      }
    });

    return () => {
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  async function handleLogin() {
    setMsg(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      // App-level auth gating will take over after successful login
    } catch (e) {
      setMsg({ type: "error", text: e?.message || "Login failed" });
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
      // Force redirect to /auth so recovery UI can render
      const redirectTo = `${origin}/auth`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) throw error;

      setMsg({
        type: "success",
        text: "Reset email sent. Open the link, then you’ll see the Reset Password screen.",
      });
    } catch (e) {
      setMsg({ type: "error", text: e?.message || "Could not send reset email" });
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
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setMsg({ type: "success", text: "Password updated. Sending you to login…" });

      // End recovery session so they re-login clean
      await supabase.auth.signOut();

      setTimeout(() => {
        window.location.href = "/auth";
      }, 900);
    } catch (e) {
      setMsg({ type: "error", text: e?.message || "Could not update password" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.brandRow}>
          <div style={styles.brandDot} />
          <h1 style={styles.logo}>ArmPal</h1>
        </div>

        <p style={styles.subtitle}>
          {isRecovery ? "Reset your password" : "Welcome back"}
        </p>

        {msg && (
          <div style={msg.type === "error" ? styles.error : styles.success}>
            {msg.text}
          </div>
        )}

        {isRecovery ? (
          <>
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
              {loading ? "Updating…" : "Update Password"}
            </button>

            <button
              onClick={() => {
                // If they opened /auth without a valid recovery session,
                // let them go back to login UI.
                setMode("login");
                setPassword("");
                setConfirm("");
                setMsg(null);
              }}
              disabled={loading}
              style={styles.ghostBtn}
            >
              Back to login
            </button>
          </>
        ) : (
          <>
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
              autoComplete="current-password"
            />

            <button
              onClick={handleLogin}
              disabled={loading}
              style={styles.primaryBtn}
            >
              {loading ? "Logging in…" : "Log In"}
            </button>

            <button
              onClick={sendResetEmail}
              disabled={loading}
              style={styles.ghostBtn}
            >
              Forgot password? Send reset email
            </button>

            <div style={styles.hint}>
              (If you opened a reset link and still don’t see the reset screen,
              refresh once — this page also listens for Supabase’s PASSWORD_RECOVERY event.)
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
    maxWidth: 420,
    background: "#0b0b0c",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 10px 40px rgba(0,0,0,0.55)",
  },
  brandRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 6 },
  brandDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "#ff2f2f",
    boxShadow: "0 0 18px rgba(255,47,47,0.55)",
  },
  logo: { fontSize: 32, fontWeight: 900, margin: 0, letterSpacing: 0.2 },
  subtitle: { opacity: 0.75, marginTop: 0, marginBottom: 14 },

  input: {
    width: "100%",
    padding: 12,
    marginBottom: 10,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "#101012",
    color: "white",
    outline: "none",
  },
  primaryBtn: {
    width: "100%",
    padding: 14,
    borderRadius: 14,
    border: "none",
    background: "#ff2f2f",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    marginTop: 4,
  },
  ghostBtn: {
    width: "100%",
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "#0f0f10",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
    marginTop: 10,
  },
  error: {
    background: "rgba(255,47,47,0.15)",
    border: "1px solid rgba(255,47,47,0.25)",
    padding: 10,
    borderRadius: 12,
    marginBottom: 10,
    fontSize: 13,
  },
  success: {
    background: "rgba(0,200,100,0.15)",
    border: "1px solid rgba(0,200,100,0.20)",
    padding: 10,
    borderRadius: 12,
    marginBottom: 10,
    fontSize: 13,
  },
  hint: {
    marginTop: 12,
    opacity: 0.6,
    fontSize: 12,
    lineHeight: 1.35,
  },
};
