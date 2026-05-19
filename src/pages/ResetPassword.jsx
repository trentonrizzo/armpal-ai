import React, { useEffect, useLayoutEffect, useState, useRef, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { clearPasswordRecoveryFlow } from "../utils/recoveryUrl";

const UPDATE_USER_MS = 10000;

const INVALID_LINK_MSG = "This reset link is invalid or has expired.";

/**
 * Exactly one exchangeCodeForSession per auth code per JS context (e.g. Strict Mode
 * remount resets refs, so we dedupe the network call here).
 */
const exchangeCodeResultByCode = new Map();

function getExchangeCodeForSessionOnce(code) {
  let p = exchangeCodeResultByCode.get(code);
  if (p) return p;

  p = (async () => {
    log("exchangeCodeForSession (once per code)", { codePrefix: code.slice(0, 8) + "…" });
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      log("exchangeCodeForSession failed", error.message);
      return { ok: false };
    }
    const { data: confirmed } = await supabase.auth.getSession();
    if (confirmed?.session) {
      log("session established after exchange");
      return { ok: true };
    }
    log("exchange returned no error but no session");
    return { ok: false };
  })();

  exchangeCodeResultByCode.set(code, p);
  return p;
}

function log(tag, extra) {
  try {
    if (extra !== undefined) console.log(`[PasswordRecovery] ${tag}`, extra);
    else console.log(`[PasswordRecovery] ${tag}`);
  } catch {
    /* ignore */
  }
}

function withTimeout(ms, label) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(label)), ms));
}

function readQueryParams(search) {
  const q = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(q);
}

function readHashParams(hash) {
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  return new URLSearchParams(h);
}

/** Snapshot once: PKCE / magic-link style `code` from query (and hash if present). */
function snapshotRecoveryParams() {
  if (typeof window === "undefined") return null;
  const search = window.location.search || "";
  const hash = window.location.hash || "";
  const pathname = window.location.pathname || "";
  const searchParams = readQueryParams(search);
  const hashParams = readHashParams(hash);
  const code = searchParams.get("code") || hashParams.get("code") || "";
  const hasCode = code.length > 0;
  return { pathname, search, hash, code, hasCode };
}

async function establishRecoverySession(snap) {
  const { data: existing } = await supabase.auth.getSession();
  if (existing?.session) {
    log("session already present");
    return { ok: true };
  }

  if (!snap?.hasCode) {
    log("missing code query param");
    return { ok: false };
  }

  return getExchangeCodeForSessionOnce(snap.code);
}

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [initDone, setInitDone] = useState(false);

  const snapRef = useRef(null);
  const doneRef = useRef(false);
  const submitInFlightRef = useRef(false);
  /** True after a successful session (existing session or exchangeCodeForSession ok) for this mount. */
  const exchangeCompletedRef = useRef(false);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (!snapRef.current) snapRef.current = snapshotRecoveryParams();
    log("snapshot", {
      hasCode: snapRef.current?.hasCode,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (exchangeCompletedRef.current) {
        if (!cancelled && !doneRef.current) {
          setSessionReady(true);
          setInitDone(true);
        }
        log("init skipped: exchange already completed");
        return;
      }

      const snap = snapRef.current;
      if (!snap?.hasCode) {
        if (!cancelled) {
          setError(INVALID_LINK_MSG);
          setSessionReady(false);
          setInitDone(true);
        }
        log("init: no code in URL");
        return;
      }

      try {
        const { ok } = await establishRecoverySession(snap);
        if (cancelled || doneRef.current) return;

        if (ok) {
          exchangeCompletedRef.current = true;
          setSessionReady(true);
          setError(null);
          log("session ready");
        } else {
          setError(INVALID_LINK_MSG);
          setSessionReady(false);
        }
      } catch (e) {
        if (!cancelled && !doneRef.current) {
          log("init error", e?.message);
          setError(INVALID_LINK_MSG);
          setSessionReady(false);
        }
      } finally {
        if (!cancelled && !doneRef.current) setInitDone(true);
        log("init complete");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (doneRef.current || submitInFlightRef.current) return;

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
      log("updateUser start");

      try {
        const result = await Promise.race([
          supabase.auth.updateUser({ password: password.trim() }),
          withTimeout(UPDATE_USER_MS, "update_user_timeout"),
        ]);

        if (result?.error) {
          setError(result.error.message);
          log("updateUser failed", result.error.message);
          return;
        }

        log("updateUser ok");
        doneRef.current = true;
        clearPasswordRecoveryFlow();
        void supabase.auth.signOut().catch(() => {});
        setSuccess(true);
        setLoading(false);
        window.location.replace(`${window.location.origin}/login?passwordReset=success`);
      } catch (err) {
        const m = err?.message || String(err);
        if (m === "update_user_timeout") {
          setError("Password update timed out. Please request a new reset email.");
          log("updateUser timeout");
        } else {
          setError(m || "Could not update password.");
          log("updateUser error", m);
        }
      } finally {
        submitInFlightRef.current = false;
        setLoading(false);
      }
    },
    [password, confirmPassword]
  );

  const showForm = initDone && sessionReady && !success && !doneRef.current;
  const showPreparing = !initDone;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.logo}>ArmPal</h1>
        <p style={styles.sub}>Set a new password for your account.</p>

        {error && <div style={styles.error}>{error}</div>}
        {success && (
          <div style={styles.success}>Password updated. Redirecting to sign in…</div>
        )}
        {showPreparing && <p style={styles.muted}>Preparing secure recovery session...</p>}

        {showForm && (
          <form onSubmit={onSubmit}>
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
