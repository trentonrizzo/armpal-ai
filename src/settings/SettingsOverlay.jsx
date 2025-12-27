import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

/* ============================
   THEME HELPERS
============================ */

function getCurrentTheme() {
  return document.body.getAttribute("data-theme") || "dark";
}

function setTheme(next) {
  document.body.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
}

/* ============================
   TOGGLE PILL
============================ */

function TogglePill({ on, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 54,
        height: 30,
        borderRadius: 999,
        border: "1px solid var(--border-soft)",
        background: on ? "var(--accent-main)" : "var(--bg-card)",
        padding: 2,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        justifyContent: on ? "flex-end" : "flex-start",
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 999,
          background: "var(--bg-main)",
          opacity: disabled ? 0.6 : 1,
        }}
      />
    </button>
  );
}

/* ============================
   SETTINGS OVERLAY
============================ */

export default function SettingsOverlay({ open, onClose }) {
  const [user, setUser] = useState(null);
  const [section, setSection] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [theme, setThemeState] = useState(getCurrentTheme());

  useEffect(() => {
    if (!open) return;
    supabase.auth.getUser().then(({ data }) => setUser(data?.user));
  }, [open]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setThemeState(next);
  }

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
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
            background: "var(--bg-main)",
            color: "var(--text-main)",
            padding: 16,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 900 }}>Settings</h2>

          {/* APPEARANCE */}
          <div
            onClick={() =>
              setSection(section === "appearance" ? null : "appearance")
            }
            style={{
              marginTop: 18,
              padding: 14,
              borderRadius: 14,
              background: "var(--bg-card)",
              border: "1px solid var(--border-soft)",
            }}
          >
            <div style={{ fontWeight: 800 }}>Appearance</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {theme === "light" ? "Light mode" : "Dark mode"}
            </div>

            {section === "appearance" && (
              <div style={{ marginTop: 12 }}>
                <TogglePill
                  on={theme === "light"}
                  disabled={false}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTheme();
                  }}
                />
              </div>
            )}
          </div>

          <div style={{ flex: 1 }} />

          <button
            onClick={() => setShowLogoutConfirm(true)}
            style={{
              padding: 14,
              borderRadius: 14,
              background: "var(--accent-main)",
              border: "none",
              color: "#fff",
              fontWeight: 900,
            }}
          >
            Log out
          </button>
        </div>
      </div>

      {/* LOGOUT CONFIRM */}
      {showLogoutConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "86%",
              maxWidth: 340,
              background: "var(--bg-card)",
              color: "var(--text-main)",
              borderRadius: 16,
              padding: 18,
              border: "1px solid var(--border-soft)",
              textAlign: "center",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16 }}>Log out?</div>
            <div style={{ color: "var(--text-muted)", marginTop: 6 }}>
              You will need to sign back in.
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  background: "var(--bg-main)",
                  border: "1px solid var(--border-soft)",
                  color: "var(--text-main)",
                  fontWeight: 700,
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  background: "var(--accent-main)",
                  border: "none",
                  color: "#fff",
                  fontWeight: 900,
                }}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
