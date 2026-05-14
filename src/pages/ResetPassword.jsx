import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

const MODE_KEY = "armpal_mode";
const ACCENT_KEY = "armpal_theme";

function friendlyUpdatePasswordError(error) {
  const raw = (error && (error.message || String(error))) || "";
  const m = String(raw).toLowerCase();
  if (!m) return "We couldn’t update your password. Please try again.";
  if (m.includes("session") || m.includes("expired") || m.includes("jwt") || m.includes("invalid")) {
    return "This reset link has expired or is no longer valid. Request a new one from ArmPal.";
  }
  if (m.includes("same") && m.includes("password")) {
    return "Choose a new password that differs from your current one.";
  }
  if (m.includes("weak") || m.includes("least") || m.includes("short")) {
    return "Use a longer password (at least 6 characters).";
  }
  return "We couldn’t update your password. Request a new reset link and try again.";
}

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [gate, setGate] = useState("loading"); // loading | invalid | ready | success
  const navigate = useNavigate();
  const { theme, setTheme, setAccent, toggleTheme } = useTheme();

  useEffect(() => {
    try {
      const mode = localStorage.getItem(MODE_KEY);
      const acc = localStorage.getItem(ACCENT_KEY);
      if (mode === "light" || mode === "dark") setTheme(mode);
      if (acc === "red" || acc === "blue" || acc === "purple" || acc === "green") setAccent(acc);
    } catch {
      /* ignore */
    }
  }, [setTheme, setAccent]);

  const styles = useMemo(() => buildStyles(theme), [theme]);

  useEffect(() => {
    let cancelled = false;

    async function readSession() {
      return (await supabase.auth.getSession()).data?.session ?? null;
    }

    function waitForUrlAuthSession(timeoutMs = 10000) {
      return new Promise((resolve) => {
        let settled = false;
        let timer = null;
        let subscription = null;

        const cleanup = () => {
          if (timer) clearTimeout(timer);
          try {
            subscription?.unsubscribe();
          } catch {
            /* ignore */
          }
        };

        const done = (session) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(session ?? null);
        };

        const { data } = supabase.auth.onAuthStateChange((event, sess) => {
          if (event === "PASSWORD_RECOVERY") {
            done(sess);
            return;
          }
          if (event === "SIGNED_IN" && sess) {
            done(sess);
            return;
          }
          if (event === "INITIAL_SESSION" && sess) {
            done(sess);
          }
        });
        subscription = data?.subscription;

        timer = setTimeout(() => done(null), timeoutMs);

        void readSession().then((s) => {
          if (s) done(s);
        });
      });
    }

    async function init() {
      try {
        const href = window.location.href;
        const url = new URL(href);

        if (url.searchParams.has("code")) {
          const { error } = await supabase.auth.exchangeCodeForSession(href);
          if (error) {
            if (!cancelled) setGate("invalid");
            return;
          }
          if (!cancelled) setGate("ready");
          return;
        }

        const hash = url.hash || "";
        const looksLikeHashAuth =
          hash.includes("type=recovery") ||
          hash.includes("access_token=") ||
          hash.includes("refresh_token=");

        let session = null;
        if (looksLikeHashAuth) {
          session = await waitForUrlAuthSession();
        } else {
          session = await readSession();
          if (!session) {
            await new Promise((r) => setTimeout(r, 120));
            session = await readSession();
          }
          if (!session) {
            await new Promise((r) => setTimeout(r, 280));
            session = await readSession();
          }
        }

        if (cancelled) return;
        if (session) setGate("ready");
        else setGate("invalid");
      } catch {
        if (!cancelled) setGate("invalid");
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleReset() {
    if (password.length < 6) {
      setMsg({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }

    if (password !== confirm) {
      setMsg({ type: "error", text: "Passwords do not match." });
      return;
    }

    setLoading(true);
    setMsg(null);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMsg({ type: "error", text: friendlyUpdatePasswordError(error) });
      setLoading(false);
      return;
    }

    try {
      await supabase.auth.signOut();
    } catch {
      /* still show success — password was updated */
    }

    setLoading(false);
    setGate("success");
  }

  const shell = (children) => (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <span style={styles.brand}>ArmPal</span>
        <button type="button" style={styles.themeBtn} onClick={toggleTheme} aria-label="Toggle light or dark mode">
          {theme === "dark" ? "Light" : "Dark"}
        </button>
      </div>
      <div style={styles.cardWrap}>{children}</div>
    </div>
  );

  if (gate === "loading") {
    return shell(
      <div style={styles.card}>
        <p style={styles.mutedCenter}>Verifying your reset link…</p>
      </div>
    );
  }

  if (gate === "invalid") {
    return shell(
      <div style={styles.card}>
        <h1 style={styles.title}>Link not valid</h1>
        <p style={styles.bodyText}>
          This password reset link is invalid or has expired. Request a new one from the ArmPal login screen or from
          Settings in the app.
        </p>
        <button type="button" onClick={() => navigate("/")} style={styles.primary}>
          Go to sign in
        </button>
      </div>
    );
  }

  if (gate === "success") {
    return shell(
      <div style={styles.card}>
        <h1 style={styles.title}>All set</h1>
        <p style={styles.successBanner}>
          Password updated successfully. You may now return to ArmPal.
        </p>
        <p style={styles.bodyText}>
          Close this tab and open the ArmPal app to sign in with your new password, or continue below if you use ArmPal
          on the web.
        </p>
        <button type="button" onClick={() => navigate("/")} style={styles.primary}>
          Go to sign in
        </button>
      </div>
    );
  }

  return shell(
    <div style={styles.card}>
      <h1 style={styles.title}>Reset password</h1>
      <p style={styles.subtitle}>Choose a new password for your ArmPal account.</p>

      {msg && <div style={msg.type === "error" ? styles.error : styles.success}>{msg.text}</div>}

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
        type="button"
        onClick={handleReset}
        style={{
          ...styles.primary,
          ...(loading ? { opacity: 0.65, cursor: "not-allowed" } : {}),
        }}
        disabled={loading}
      >
        {loading ? "Updating…" : "Update password"}
      </button>
    </div>
  );
}

function buildStyles(theme) {
  const isLight = theme === "light";
  const cardBg = "var(--card)";
  const cardBorder = "1px solid var(--border)";
  const subtle = "var(--text-dim)";

  return {
    page: {
      minHeight: "100dvh",
      width: "100%",
      background: "var(--bg)",
      color: "var(--text)",
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      boxSizing: "border-box",
      paddingTop: "max(12px, env(safe-area-inset-top, 0px))",
      paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))",
      paddingLeft: "max(16px, env(safe-area-inset-left, 0px))",
      paddingRight: "max(16px, env(safe-area-inset-right, 0px))",
      overflowY: "auto",
      WebkitOverflowScrolling: "touch",
    },
    topBar: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      maxWidth: 440,
      width: "100%",
      margin: "0 auto 14px",
      flexShrink: 0,
    },
    brand: {
      fontSize: 28,
      fontWeight: 900,
      letterSpacing: "-0.02em",
      color: "var(--text)",
    },
    themeBtn: {
      padding: "8px 14px",
      borderRadius: 999,
      border: "1px solid var(--border)",
      background: "var(--card-2)",
      color: "var(--text)",
      fontWeight: 700,
      fontSize: 13,
      cursor: "pointer",
    },
    cardWrap: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      minHeight: 0,
    },
    card: {
      width: "100%",
      maxWidth: 420,
      background: cardBg,
      padding: 22,
      borderRadius: 16,
      border: cardBorder,
      boxShadow: isLight ? "0 8px 32px rgba(0,0,0,0.06)" : "0 8px 40px rgba(0,0,0,0.35)",
    },
    title: {
      fontSize: 24,
      fontWeight: 900,
      marginBottom: 8,
      color: "var(--text)",
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 1.45,
      color: subtle,
      marginBottom: 16,
    },
    bodyText: {
      fontSize: 15,
      lineHeight: 1.5,
      color: subtle,
      marginBottom: 18,
    },
    mutedCenter: {
      textAlign: "center",
      margin: 0,
      color: subtle,
      fontSize: 15,
    },
    successBanner: {
      background: "color-mix(in srgb, var(--accent) 14%, transparent)",
      border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)",
      color: "var(--text)",
      padding: "14px 14px",
      borderRadius: 12,
      fontSize: 15,
      fontWeight: 700,
      lineHeight: 1.45,
      marginBottom: 14,
    },
    input: {
      width: "100%",
      padding: "13px 14px",
      marginBottom: 10,
      borderRadius: 12,
      background: "var(--card-2)",
      border: "1px solid var(--border)",
      color: "var(--text)",
      fontSize: 16,
      boxSizing: "border-box",
    },
    primary: {
      width: "100%",
      padding: "14px 16px",
      background: "var(--accent)",
      border: "none",
      borderRadius: 14,
      color: "#fff",
      fontWeight: 900,
      fontSize: 16,
      marginTop: 8,
      cursor: "pointer",
    },
    error: {
      background: "color-mix(in srgb, #e00000 12%, transparent)",
      border: "1px solid color-mix(in srgb, #e00000 28%, transparent)",
      color: "var(--text)",
      padding: "12px 14px",
      borderRadius: 12,
      marginBottom: 12,
      fontSize: 14,
      lineHeight: 1.45,
    },
    success: {
      background: "color-mix(in srgb, var(--accent) 12%, transparent)",
      border: "1px solid color-mix(in srgb, var(--accent) 28%, transparent)",
      color: "var(--text)",
      padding: "12px 14px",
      borderRadius: 12,
      marginBottom: 12,
      fontSize: 14,
      lineHeight: 1.45,
    },
  };
}
