import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function ResetPassword() {
  const [session, setSession] = useState(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });
  }, []);

  async function handleReset() {
    setError(null);

    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Important: end recovery session
    await supabase.auth.signOut();

    setSuccess(true);

    setTimeout(() => {
      window.location.href = "/";
    }, 1200);
  }

  if (!session) {
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <h2>Invalid or expired reset link</h2>
          <p>Please request a new password reset.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.center}>
      <div style={styles.card}>
        <h2 style={{ marginBottom: 10 }}>Reset Password</h2>

        {error && <div style={styles.error}>{error}</div>}

        {success ? (
          <div style={styles.success}>
            Password updated. Redirecting…
          </div>
        ) : (
          <>
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
            />

            <input
              type="password"
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={styles.input}
            />

            <button
              onClick={handleReset}
              disabled={loading}
              style={styles.button}
            >
              {loading ? "Updating…" : "Update Password"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* =========================
   STYLES (isolated)
========================= */

const styles = {
  center: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#000",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    background: "#0f0f10",
    borderRadius: 16,
    padding: 20,
    color: "white",
    boxShadow: "0 0 0 1px rgba(255,255,255,0.08)",
  },
  input: {
    width: "100%",
    padding: 12,
    marginTop: 10,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "#111",
    color: "white",
    outline: "none",
  },
  button: {
    marginTop: 16,
    width: "100%",
    padding: 14,
    borderRadius: 14,
    border: "none",
    background: "#ff2f2f",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  },
  error: {
    background: "rgba(255,47,47,0.15)",
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    fontSize: 13,
  },
  success: {
    background: "rgba(0,200,100,0.15)",
    padding: 12,
    borderRadius: 10,
    fontSize: 14,
  },
};
