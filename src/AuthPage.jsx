import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

/*
  AuthPage – CORRECT RESET PASSWORD FLOW (NO LOOPS)

  - Forgot password ALWAYS sends email
  - Email link ALWAYS lands in recovery mode
  - No App.jsx changes required
*/

export default function AuthPage() {
  const [mode, setMode] = useState("login"); // login | forgot | recovery
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  /* ============================
     DETECT PASSWORD RECOVERY
  ============================ */
  useEffect(() => {
    const hash = window.location.hash || "";
    const search = window.location.search || "";

    if (
      hash.includes("type=recovery") ||
      hash.includes("access_token") ||
      search.includes("code=")
    ) {
      setMode("recovery");
    }

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("recovery");
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  /* ============================
     LOGIN
  ============================ */
  async function handleLogin() {
    setLoading(true);
    setMsg(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) setMsg({ type: "error", text: error.message });
    setLoading(false);
  }

  /* ============================
     SEND RESET EMAIL (FIXED)
  ============================ */
  async function sendResetEmail() {
    if (!email) {
      setMsg({ type: "error", text: "Enter your email first." });
      return;
    }

    setLoading(true);
    setMsg(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`, // SAME PAGE, BUT RECOVERY MODE
    });

    if (error) {
      setMsg({ type: "error", text: error.message });
    } else {
      setMsg({
        type: "success",
        text: "Reset email sent. Open the newest email link.",
      });
    }

    setLoading(false);
  }

  /* ============================
     UPDATE PASSWORD
  ============================ */
  async function handlePasswordUpdate() {
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
      setMsg({ type: "error", text: error.message });
      setLoading(false);
      return;
    }

    setMsg({
      type: "success",
      text: "Password updated. Redirecting to login…",
    });

    setTimeout(async () => {
      await supabase.auth.signOut();
      window.location.href = "/auth";
    }, 1200);
  }

  /* ============================
     UI
  ============================ */
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.logo}>ArmPal</h1>

        {msg && (
          <div style={msg.type === "error" ? styles.error : styles.success}>
            {msg.text}
          </div>
        )}

        {mode === "recovery" && (
          <>
            <h2>Reset password</h2>
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
              onClick={handlePasswordUpdate}
              style={styles.primary}
              disabled={loading}
            >
              Update password
            </button>
          </>
        )}

        {mode === "login" && (
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
            <button onClick={handleLogin} style={styles.primary}>
              Log in
            </button>
            <button onClick={() => setMode("forgot")} style={styles.secondary}>
              Forgot password?
            </button>
          </>
        )}

        {mode === "forgot" && (
          <>
            <input
              type="email"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
            />
            <button onClick={sendResetEmail} style={styles.primary}>
              Send reset email
            </button>
            <button onClick={() => setMode("login")} style={styles.secondary}>
              Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================
   STYLES (unchanged)
============================ */
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
  logo: { fontSize: 32, fontWeight: 900, marginBottom: 10 },
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
  secondary: {
    width: "100%",
    padding: 12,
    background: "#1a1a1a",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 14,
    color: "white",
    marginTop: 10,
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
