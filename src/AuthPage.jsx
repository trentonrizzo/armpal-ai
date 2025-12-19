import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient"; // ✅ FIXED PATH

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRecovery, setIsRecovery] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Supabase recovery links use URL hash
    const hash = window.location.hash || "";
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }
  }, []);

  async function handleLogin() {
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) setError(error.message);
    setLoading(false);
  }

  async function handlePasswordReset() {
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

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    setSuccess(true);

    setTimeout(() => {
      window.location.href = "/";
    }, 1200);
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.logo}>ArmPal</h1>
      <p style={styles.subtitle}>
        {isRecovery ? "Reset your password" : "Welcome back"}
      </p>

      {error && <div style={styles.error}>{error}</div>}

      {isRecovery ? (
        success ? (
          <div style={styles.success}>Password updated. Redirecting…</div>
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
              onClick={handlePasswordReset}
              disabled={loading}
              style={styles.button}
            >
              {loading ? "Updating…" : "Update Password"}
            </button>
          </>
        )
      ) : (
        <>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
          />
          <button
            onClick={handleLogin}
            disabled={loading}
            style={styles.button}
          >
            {loading ? "Logging in…" : "Log In"}
          </button>
        </>
      )}
    </div>
  );
}

/* =========================
   STYLES
========================= */

const styles = {
  page: {
    minHeight: "100vh",
    background: "#000",
    color: "white",
    padding: 20,
  },
  logo: {
    fontSize: 32,
    fontWeight: 900,
    marginBottom: 4,
  },
  subtitle: {
    opacity: 0.7,
    marginBottom: 20,
  },
  input: {
    width: "100%",
    padding: 12,
    marginBottom: 10,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "#111",
    color: "white",
  },
  button: {
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
