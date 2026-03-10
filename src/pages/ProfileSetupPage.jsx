// Forced profile setup for new users: handle + display_name only.
// Shown when either is missing. No back button, no nav, cannot leave until saved.

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

const styles = {
  wrap: {
    minHeight: "100vh",
    padding: "24px 16px 40px",
    maxWidth: 400,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  card: {
    background: "var(--card-2)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 800,
    color: "var(--text)",
    margin: "0 0 8px",
  },
  message: {
    fontSize: 14,
    color: "var(--text-dim)",
    lineHeight: 1.5,
    marginBottom: 24,
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-dim)",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    marginBottom: 16,
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    color: "var(--text)",
    fontSize: 15,
    boxSizing: "border-box",
  },
  error: {
    fontSize: 13,
    color: "var(--accent)",
    marginTop: -8,
    marginBottom: 12,
  },
  saveBtn: {
    width: "100%",
    padding: "14px 20px",
    borderRadius: 12,
    border: "none",
    background: "var(--accent)",
    color: "var(--text)",
    fontWeight: 700,
    fontSize: 16,
    cursor: "pointer",
  },
  saveBtnDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
};

function normalizeHandle(val) {
  return String(val ?? "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

export default function ProfileSetupPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!alive) return;
      if (!u?.id) {
        navigate("/", { replace: true });
        return;
      }
      setUser(u);
      const { data: profile } = await supabase
        .from("profiles")
        .select("handle, display_name")
        .eq("id", u.id)
        .maybeSingle();
      if (!alive) return;
      if (profile?.handle) setHandle(profile.handle);
      if (profile?.display_name) setDisplayName(profile.display_name);
    })();
    return () => { alive = false; };
  }, [navigate]);

  async function handleSave() {
    if (!user?.id) return;
    const h = normalizeHandle(handle);
    const name = String(displayName ?? "").trim();
    setError("");

    if (!h) {
      setError("Please enter a handle.");
      return;
    }
    if (!name) {
      setError("Please enter a display name.");
      return;
    }

    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("handle", h)
        .neq("id", user.id)
        .maybeSingle();

      if (existing) {
        setError("Handle already taken. Try another.");
        setSaving(false);
        return;
      }

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ handle: h, display_name: name })
        .eq("id", user.id);

      if (updateErr) {
        if (updateErr.code === "23505") {
          setError("Handle already taken. Try another.");
        } else {
          setError(updateErr.message || "Could not save profile.");
        }
        setSaving(false);
        return;
      }

      navigate("/", { replace: true });
    } catch (e) {
      setError(e?.message || "Something went wrong.");
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <p style={styles.message}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.title}>Complete your profile</h1>
        <p style={styles.message}>
          Add a handle and display name so others can find you. You can change these later in Profile.
        </p>

        <label style={styles.label}>Handle</label>
        <input
          type="text"
          placeholder="e.g. johndoe"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          onBlur={() => setHandle(normalizeHandle(handle))}
          style={styles.input}
          autoComplete="username"
          maxLength={32}
        />

        <label style={styles.label}>Display name</label>
        <input
          type="text"
          placeholder="e.g. John Doe"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          style={styles.input}
          autoComplete="name"
          maxLength={64}
        />

        {error && <p style={styles.error} role="alert">{error}</p>}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !normalizeHandle(handle) || !String(displayName ?? "").trim()}
          style={{
            ...styles.saveBtn,
            ...(saving || !normalizeHandle(handle) || !String(displayName ?? "").trim()
              ? styles.saveBtnDisabled
              : {}),
          }}
        >
          {saving ? "Saving…" : "Save and continue"}
        </button>
      </div>
    </div>
  );
}
