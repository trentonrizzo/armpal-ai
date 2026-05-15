import React, { useEffect, useState, useRef, useCallback } from "react";
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

function logRecovery(tag, extra) {
  try {
    if (extra !== undefined) console.log(`[PasswordRecovery] ${tag}`, extra);
    else console.log(`[PasswordRecovery] ${tag}`);
  } catch {
    /* ignore */
  }
}

function stripRecoveryFromUrl() {
  if (typeof window === "undefined") return;
  try {
    const u = new URL(window.location.href);
    u.search = "";
    u.hash = "";
    window.history.replaceState({}, document.title, u.pathname);
    logRecovery("cleared URL search + hash (tokens removed from address bar)", {
      pathname: u.pathname,
    });
  } catch (e) {
    logRecovery("stripRecoveryFromUrl failed", e?.message || e);
  }
}

/** Fire-and-forget; never blocks redirect. Timeout so hung signOut cannot stall the tab. */
function signOutNonBlocking() {
  logRecovery("signOut started (non-blocking, timeout-protected)");
  const started = Date.now();
  void (async () => {
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("signOut_timeout")), 2800)
        ),
      ]);
      logRecovery("signOut finished", { ms: Date.now() - started });
    } catch (e) {
      logRecovery("signOut failed or timed out (ignored for redirect)", e?.message || e);
    }
  })();
}

function redirectToLoginSuccess() {
  const dest = `${window.location.origin}/login?passwordReset=success`;
  logRecovery("redirecting to login (hard navigation)", { dest });
  try {
    window.location.replace(dest);
  } catch (e) {
    logRecovery("location.replace failed, trying assign", e?.message || e);
    window.location.assign(dest);
  }
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

  /** After successful updateUser: ignore auth listener + avoid duplicate submit. */
  const passwordUpdateCompleteRef = useRef(false);
  const submitInFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (passwordUpdateCompleteRef.current) return;

      setError(null);
      logRecovery("ResetPassword init", {
        href: window.location.href,
        pathname: window.location.pathname,
        search: window.location.search,
        hashLen: (window.location.hash || "").length,
      });

      const search = window.location.search || "";
      const hash = window.location.hash || "";
      const qs = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
      const code = qs.get("code");

      let exchangeErrMsg = null;
      try {
        if (code) {
          logRecovery("calling exchangeCodeForSession(code)");
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exErr) throw exErr;
        }
      } catch (e) {
        exchangeErrMsg = e?.message || String(e);
        logRecovery("exchangeCodeForSession failed", exchangeErrMsg);
      }

      const {
        data: { session },
        error: sessErr,
      } = await supabase.auth.getSession();
      if (cancelled || passwordUpdateCompleteRef.current) return;

      if (sessErr) {
        logRecovery("getSession error", sessErr.message);
      }

      if (session) {
        logRecovery("session present after init", { userId: session.user?.id });
        setSessionReady(true);
      } else if (hasRecoveryTokensInUrl()) {
        logRecovery("no session yet; showing form (URL still has recovery material)");
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

      if (!cancelled && !passwordUpdateCompleteRef.current) setInitDone(true);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (passwordUpdateCompleteRef.current) {
        logRecovery("auth event ignored (password update already completed)", {
          event,
          hasSession: !!session,
        });
        return;
      }

      logRecovery("onAuthStateChange", {
        event,
        hasSession: !!session,
        pathname: typeof window !== "undefined" ? window.location.pathname : "",
      });

      if (event === "PASSWORD_RECOVERY") {
        logRecovery("PASSWORD_RECOVERY event received");
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
          logRecovery("session-related event on recovery URL → sessionReady true", { event });
          setSessionReady(true);
        }
      }
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, [navigate]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (passwordUpdateCompleteRef.current) {
        logRecovery("submit ignored (already completed)");
        return;
      }
      if (submitInFlightRef.current) {
        logRecovery("submit ignored (already in flight)");
        return;
      }

      setError(null);

      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }

      submitInFlightRef.current = true;
      setLoading(true);
      logRecovery("submit started", {
        pathname: window.location.pathname,
        search: window.location.search,
        hashLen: (window.location.hash || "").length,
        loading: true,
      });

      try {
        const {
          data: { session: preSession },
        } = await supabase.auth.getSession();
        logRecovery("pre-updateUser getSession", { sessionExists: !!preSession });

        logRecovery("updateUser started");
        const { error: upErr } = await supabase.auth.updateUser({ password: password.trim() });
        if (upErr) {
          logRecovery("updateUser failed", upErr.message);
          setError(upErr.message);
          return;
        }

        logRecovery("updateUser succeeded — treating reset as COMPLETE");

        // Stop listener + init paths from mutating state; prevents races with signOut / TOKEN_REFRESHED.
        passwordUpdateCompleteRef.current = true;

        clearPasswordRecoveryFlow();
        stripRecoveryFromUrl();

        // Do not await signOut — it triggers global auth churn and remounts; redirect is independent.
        signOutNonBlocking();

        setSuccess(true);
        setLoading(false);
        logRecovery("loading cleared (success path)", { loading: false });

        // Primary exit: full navigation (avoids React Router / remount races after session clears).
        redirectToLoginSuccess();
      } catch (err) {
        logRecovery("submit unexpected error", err?.message || err);
        setError(err?.message || String(err));
        setLoading(false);
      } finally {
        submitInFlightRef.current = false;
        // Success path already set loading false before hard redirect; ensure no stuck spinner if replace is slow.
        setLoading((prev) => {
          if (prev) logRecovery("loading state forced false (finally)", { wasLoading: prev });
          return false;
        });
      }
    },
    [password, confirmPassword]
  );

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
