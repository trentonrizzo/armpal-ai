import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function SettingsOverlay({ open, onClose }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (open) {
      supabase.auth.getUser().then(({ data }) => setUser(data?.user));
    }
  }, [open]);

  if (!open) return null;

  async function logout() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 9999,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "74%",
          maxWidth: 380,
          background: "#0f0f10",
          padding: 16,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 900 }}>Settings</h2>

        <div style={{ marginTop: 14, fontSize: 13, opacity: 0.8 }}>
          <div>Email</div>
          <div style={{ opacity: 0.6 }}>{user?.email}</div>
        </div>

        <div style={{ flex: 1 }} />

        <button
          onClick={logout}
          style={{
            padding: 12,
            borderRadius: 14,
            background: "#ff2f2f",
            border: "none",
            color: "white",
            fontWeight: 900,
          }}
        >
          Log out
        </button>
      </div>
    </div>
  );
}
