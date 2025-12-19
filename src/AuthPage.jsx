import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

function isRecoveryLink() {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash || "";
  const search = window.location.search || "";
  return (
    hash.includes("type=recovery") ||
    hash.includes("access_token") ||
    search.includes("code=")
  );
}

export default function AuthPage() {
  const [mode, setMode] = useState("login"); // login | recovery
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    // 🔒 HARD FIX: if recovery link, kill auto-login and force reset UI
    if (isRecoveryLink()) {
      supabase.auth.signOut().finally(() => {
        setMode("recovery");
      });
    }

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        supabase.auth.signOut().finally(() => {
          setMode("recovery");
        });
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  async function handleLogin() {
    setMsg(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) setMsg(error.message);
    setLoading(false);
  }

  async function sendResetEmail() {
    setMsg(null);
    if (!email) return setMsg("Enter your email.");

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin, // ✅ FIX
    });
    if (error) setMsg(error.message);
    else setMsg("Reset email sent.");
    setLoading(false);
  }

  async function updatePassword() {
    setMsg(null);

    if (password.length < 6)
      return setMsg("Password must be at least 6 characters.");
    if (password !== confirm)
      return setMsg("Passwords do not match.");

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMsg(error.message);
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff", padding: 20 }}>
      <h1>ArmPal</h1>

      {msg && <div style={{ marginBottom: 10 }}>{msg}</div>}

      {mode === "recovery" ? (
        <>
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <button onClick={updatePassword} disabled={loading}>
            Reset Password
          </button>
        </>
      ) : (
        <>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button onClick={handleLogin} disabled={loading}>
            Log In
          </button>
          <button onClick={sendResetEmail} disabled={loading}>
            Forgot password
          </button>
        </>
      )}
    </div>
  );
}
