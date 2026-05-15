import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { clearPasswordRecoveryFlow, isPasswordRecoveryUrl } from "../utils/recoveryUrl";

function hasRecoveryTokensInUrl() {
  if (typeof window === "undefined") return false;
  const s = window.location.search || "";
  const h = window.location.hash || "";
  return (
    s.includes("code=") ||
    h.includes("access_token=") ||
    h.includes("refresh_token=") ||
    s.includes("type=recovery") ||
    h.includes("type=recovery")
  );
}

function isResetPasswordPathname() {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname || "";
  return path === "/reset-password" || path === "/reset-password.html" || path.endsWith("/reset-password.html");
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [initDone, setInitDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setError(null);
      console.log("[PasswordRecovery] ResetPassword init", { href: window.location.href });

      const search = window.location.search || "";
      const hash = window.location.hash || "";
      const qs = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
      const code = qs.get("code");

      let exchangeErrMsg = null;
      try {
        if (code) {
          console.log("[PasswordRecovery] calling exchangeCodeForSession(code)");
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exErr) throw exErr;
        }
      } catch (e) {
        exchangeErrMsg = e?.message || String(e);
        console.warn("[PasswordRecovery] exchangeCodeForSession failed", exchangeErrMsg);
      }

      const {
        data: { session },
        error: sessErr,
      } = await supabase.auth.getSession();
      if (cancelled) return;

      if (sessErr) {
        console.warn("[PasswordRecovery] getSession error", sessErr.message);
      }

      if (session) {
        console.log("[PasswordRecovery] session present after init");
        setSessionReady(true);
      } else if (hasRecoveryTokensInUrl()) {
        console.log(
          "[PasswordRecovery] no session yet; showing form (Supabase may hydrate session from URL)"
        );
        setSessionReady(true);
        if (exchangeErrMsg) setError(exchangeErrMsg);
      } else {
        setSessionReady(false);
        setError(
          exchangeErrMsg ||
            sessErr?.message ||
            "This reset link is invalid or has expired. Request a new reset email."
        );
      }

      if (!cancelled) setInitDone(true);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        console.log("[PasswordRecovery] PASSWORD_RECOVERY event received");
        setSessionReady(true);
        const path = window.location.pathname || "";
        if (path !== "/reset-password" && !path.endsWith("/reset-password.html")) {
          navigate(`/reset-password${window.location.search || ""}${window.location.hash || ""}`, {
            replace: true,
          });
        }
      }
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")) {
        if (isPasswordRecoveryUrl() || hasRecoveryTokensInUrl() || isResetPasswordPathname()) {
          setSessionReady(true);
        }
      }
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    console.log("[PasswordRecovery] submitting new password");

    const { error: upErr } = await supabase.auth.updateUser({ password: password.trim() });
    if (upErr) {
      console.warn("[PasswordRecovery] updateUser failed", upErr.message);
      setError(upErr.message);
      setLoading(false);
      return;
    }

    console.log("[PasswordRecovery] password updated successfully");
    setSuccess(true);

    try {
      await supabase.auth.signOut();
    } catch (soErr) {
      console.warn("[PasswordRecovery] signOut after reset", soErr?.message || soErr);
    }

    clearPasswordRecoveryFlow();

    try {
      window.history.replaceState({}, document.title, "/login");
    } catch {
      /* ignore */
    }

    setLoading(false);

    setTimeout(() => {
      try {
        navigate("/login?passwordReset=success", { replace: true });
      } catch {
        window.location.href = `${window.location.origin}/login?passwordReset=success`;
      }
    }, 900);
  }

  const showForm = initDone && sessionReady && !success;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.logo}>ArmPal</h1>
        <p style={styles.sub}>Set a new password for your account.</p>

        {error && <div style={styles.error}>{error}</div>}
        {success && (
          <div style={styles.success}>
            Password updated. Redirecting to sign in…
          </div>
        )}

        {!initDone && <p style={styles.muted}>Preparing secure reset…</p>}

        {showForm && (
          <form onSubmit={handleSubmit}>
            <label style={styles.label} htmlFor="ap-new-pw">
              New Password
            </label>
            <input
              id="ap-new-pw"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              style={styles.input}
            />
            <label style={styles.label} htmlFor="ap-confirm-pw">
              Confirm Password
            </label>
            <input
              id="ap-confirm-pw"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(ev) => setConfirmPassword(ev.target.value)}
              style={styles.input}
            />
            <button type="submit" style={styles.primary} disabled={loading}>
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#000",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    color: "white",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    background: "#0b0b0c",
    padding: 20,
    borderRadius: 16,
  },
  logo: { fontSize: 32, fontWeight: 900, marginBottom: 6 },
  sub: { color: "#aaa", marginTop: 0, marginBottom: 16, fontSize: 14 },
  muted: { color: "#888", margin: 0 },
  label: { display: "block", fontSize: 13, color: "#aaa", marginBottom: 6 },
  input: {
    width: "100%",
    padding: 12,
    marginBottom: 10,
    borderRadius: 12,
    background: "#111",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "white",
  },
  primary: {
    width: "100%",
    padding: 14,
    background: "#ff2f2f",
    border: "none",
    borderRadius: 14,
    color: "white",
    fontWeight: 900,
    marginTop: 6,
  },
  error: {
    background: "rgba(255,47,47,0.15)",
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  success: {
    background: "rgba(0,200,100,0.15)",
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
};
