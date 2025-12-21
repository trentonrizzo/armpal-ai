// src/pages/ResetPassword.jsx
import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(true);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
      <form onSubmit={handleSubmit} style={{ width: 320 }}>
        <h1>Reset Password</h1>

        {error && <p style={{ color: "red" }}>{error}</p>}
        {success && <p>Password updated. You can close this page.</p>}

        {!success && (
          <>
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", padding: 10, marginBottom: 10 }}
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={{ width: "100%", padding: 10, marginBottom: 10 }}
            />
            <button disabled={loading} style={{ width: "100%", padding: 10 }}>
              {loading ? "Updating…" : "Update Password"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
