import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useTheme } from "../context/ThemeContext";
import {
  clearPasswordRecoveryFlow,
  markPasswordRecoveryFlow,
  recoveryTokensPresentInUrl,
} from "../utils/recoveryUrl";

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
  const { setTheme, setAccent } = useTheme();

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      (recoveryTokensPresentInUrl() ||
        window.location.href.includes("type=recovery") ||
        window.location.href.includes("type%3Drecovery"))
    ) {
      markPasswordRecoveryFlow();
      console.log("[RESET FLOW] recovery detected");
    }
  }, []);

  useEffect(() => {
    console.log("[RESET FLOW] reset route loaded");
  }, []);

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
        const hasRecoveryTokensInUrl =
          recoveryTokensPresentInUrl() ||
          url.searchParams.get("type") === "recovery" ||
          href.includes("type=recovery") ||
          href.includes("type%3Drecovery");

        if (url.searchParams.has("code")) {
          const { error } = await supabase.auth.exchangeCodeForSession(href);
          if (error) {
            if (!cancelled) setGate("invalid");
            return;
          }
          if (!cancelled) setGate("ready");
          return;
        }

        const qAt = url.searchParams.get("access_token");
        const qRt = url.searchParams.get("refresh_token");
        const qType = url.searchParams.get("type");
        if (qAt && qRt && qType === "recovery") {
          const { data, error } = await supabase.auth.setSession({
            access_token: qAt,
            refresh_token: qRt,
          });
          if (error || !data?.session) {
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

        if (looksLikeHashAuth) {
          const session = await waitForUrlAuthSession();
          if (cancelled) return;
          if (session) setGate("ready");
          else setGate("invalid");
          return;
        }

        // Dedicated /reset-password with no URL tokens: still show the form (Safari manual test + deep link after strip).
        if (!hasRecoveryTokensInUrl) {
          await readSession();
          await new Promise((r) => setTimeout(r, 200));
          await readSession();
          if (cancelled) return;
          setGate("ready");
          return;
        }

        if (cancelled) return;
        setGate("invalid");
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
    setMsg(null);

    if (!password.trim() || !confirm.trim()) {
      setMsg({ type: "error", text: "Enter and confirm your new password." });
      return;
    }

    if (password.length < 6) {
      setMsg({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }

    if (password !== confirm) {
      setMsg({ type: "error", text: "Passwords do not match." });
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMsg({ type: "error", text: friendlyUpdatePasswordError(error) });
      setLoading(false);
      return;
    }

    try {
      await supabase.auth.signOut();
    } catch {
      /* password was updated */
    }

    clearPasswordRecoveryFlow();
    console.log("[RESET FLOW] update password success");
    setLoading(false);
    setGate("success");
  }

  const wrap = (child) => (
    <div style={styles.page}>
      <div style={styles.cardWrap}>
        <div style={styles.card}>
          <h1 style={styles.brand}>ArmPal</h1>
          {child}
        </div>
      </div>
    </div>
  );

  if (gate === "loading") {
    return wrap(<p style={styles.mutedCenter}>Loading…</p>);
  }

  if (gate === "invalid") {
    return wrap(
      <>
        <p style={styles.bodyText}>This reset link is invalid or has expired.</p>
        <button
          type="button"
          onClick={() => {
            window.location.assign("/");
          }}
          style={styles.primary}
        >
          Back to sign in
        </button>
      </>
    );
  }

  if (gate === "success") {
    return wrap(
      <p style={styles.successText}>
        Password updated successfully. You may now close this tab and return to ArmPal.
      </p>
    );
  }

  return wrap(
    <>
      {msg && <div style={styles.error}>{msg.text}</div>}
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
        {loading ? "Please wait…" : "Update Password"}
      </button>
    </>
  );
}

const styles = {
  page: {
    minHeight: "100dvh",
    width: "100%",
    background: "var(--bg)",
    color: "var(--text)",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
    paddingTop: "max(12px, env(safe-area-inset-top, 0px))",
    paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))",
    paddingLeft: "max(16px, env(safe-area-inset-left, 0px))",
    paddingRight: "max(16px, env(safe-area-inset-right, 0px))",
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
  },
  cardWrap: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    background: "var(--card)",
    padding: 22,
    borderRadius: 16,
    border: "1px solid var(--border)",
  },
  brand: {
    fontSize: 28,
    fontWeight: 900,
    margin: "0 0 18px",
    textAlign: "center",
    letterSpacing: "-0.02em",
  },
  mutedCenter: {
    textAlign: "center",
    margin: 0,
    color: "var(--text-dim)",
    fontSize: 15,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 1.5,
    color: "var(--text-dim)",
    marginBottom: 16,
  },
  successText: {
    fontSize: 16,
    lineHeight: 1.5,
    color: "var(--text)",
    fontWeight: 600,
    margin: 0,
    textAlign: "center",
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
};
