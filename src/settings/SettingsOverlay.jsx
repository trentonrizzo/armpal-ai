import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { enablePush, disablePush } from "../lib/push";
import { useTheme } from "../context/ThemeContext";
import { updateProfile } from "../utils/profile";

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
        border: "1px solid var(--border)",
        background: disabled
          ? "#222"
          : on
          ? "var(--accent)"
          : "#1a1a1a",
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
          background: "#fff",
          opacity: disabled ? 0.6 : 1,
        }}
      />
    </button>
  );
}

/* ============================
   SETTINGS OVERLAY
============================ */

export default function SettingsOverlay({ open, onClose, initialLegalOpen }) {
  const { theme, setTheme, accent, setAccent } = useTheme();

  function closeLegalAndOverlay() {
    setLegalModal(null);
    onClose();
  }

  const [user, setUser] = useState(null);
  const [section, setSection] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [legalModal, setLegalModal] = useState(null); // "menu" | "privacy" | "terms" | null

  const [notifSupported, setNotifSupported] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifBusy, setNotifBusy] = useState(false);

  useEffect(() => {
    if (open && initialLegalOpen) {
      setLegalModal("menu");
    }
  }, [open, initialLegalOpen]);

  useEffect(() => {
    if (open && typeof window !== "undefined") {
      window.dispatchEvent(new Event("ap_settings_opened"));
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    supabase.auth.getUser().then(async ({ data }) => {
      const u = data?.user;
      setUser(u);
      const supported = typeof Notification !== "undefined";
      setNotifSupported(supported);
      if (supported && u?.id) {
        const perm = Notification.permission === "granted";
        const { data: subs } = await supabase
          .from("push_subscriptions")
          .select("id")
          .eq("user_id", u.id)
          .limit(1);
        setNotifEnabled(perm && subs?.length > 0);
      } else if (supported) {
        setNotifEnabled(Notification.permission === "granted");
      }
    });
  }, [open]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    // Persist per-account in profiles; ignore errors.
    updateProfile({ theme_mode: next }).catch(() => {});
  }

  async function toggleNotifications() {
    if (!user || !notifSupported) return;

    setNotifBusy(true);
    try {
      if (notifEnabled) {
        await disablePush(user.id);
        setNotifEnabled(false);
      } else {
        if (Notification.permission === "granted") {
          await enablePush(user.id);
          setNotifEnabled(true);
          return;
        }
        if (Notification.permission === "denied") {
          console.warn("Notifications blocked by browser");
          return;
        }
        const result = await Notification.requestPermission();
        if (result === "granted") {
          await enablePush(user.id);
          setNotifEnabled(true);
        }
      }
    } catch (err) {
      alert(err?.message || "Notification error");
    } finally {
      setNotifBusy(false);
    }
  }

  async function sendPasswordReset() {
    if (!user?.email) return;

    const redirectTo = window.location.origin;

    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo,
    });

    if (error) alert(error.message);
    else alert("Password reset email sent.");
  }

  async function confirmLogout() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  if (!open) return null;

  return (
    <>
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
            background: "var(--card)",
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
              background: "var(--card-2)",
              border: "1px solid var(--border)",
              cursor: "pointer",
            }}
          >
            <div style={{ fontWeight: 800 }}>Appearance</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>
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

                {/* ACCENT COLORS */}
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  {["red", "blue", "purple", "green"].map((c) => (
                    <button
                      key={c}
                      onClick={(e) => {
                    e.stopPropagation();
                    setAccent(c);
                    // Persist per-account accent; ignore errors.
                    updateProfile({ theme_accent: c }).catch(() => {});
                      }}
                      style={{
                        flex: 1,
                        padding: 8,
                        borderRadius: 10,
                        border:
                          accent === c
                            ? "2px solid var(--accent)"
                            : "1px solid var(--border)",
                        background: "var(--card)",
                        fontWeight: 700,
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* NOTIFICATIONS */}
          <div
            onClick={() =>
              setSection(section === "notifications" ? null : "notifications")
            }
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 14,
              background: "var(--card-2)",
              border: "1px solid var(--border)",
              cursor: "pointer",
            }}
          >
            <div style={{ fontWeight: 800 }}>Notifications</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>
              {notifSupported
                ? notifEnabled
                  ? "Enabled"
                  : "Disabled"
                : "Not supported"}
            </div>

            {section === "notifications" && (
              <div style={{ marginTop: 12 }}>
                <TogglePill
                  on={notifEnabled}
                  disabled={!notifSupported || notifBusy}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleNotifications();
                  }}
                />
              </div>
            )}
          </div>

          {/* ACCOUNT */}
          <div
            onClick={() => setSection(section === "account" ? null : "account")}
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 14,
              background: "var(--card-2)",
              border: "1px solid var(--border)",
              cursor: "pointer",
            }}
          >
            <div style={{ fontWeight: 800 }}>Account</div>

            {section === "account" && (
              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
                <div style={{ opacity: 0.6 }}>Email</div>
                <div>{user?.email}</div>

                <div style={{ height: 10 }} />

                <div style={{ opacity: 0.6 }}>User ID</div>
                <div style={{ fontSize: 12 }}>{user?.id}</div>

                <div style={{ height: 14 }} />

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    sendPasswordReset();
                  }}
                  style={{
                    padding: 10,
                    width: "100%",
                    borderRadius: 12,
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    fontWeight: 700,
                  }}
                >
                  Send password reset email
                </button>
              </div>
            )}
          </div>

          {/* LEGAL (always visible button, very obvious) */}
          <div
            onClick={() => setLegalModal("menu")}
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 14,
              background: "var(--card-2)",
              border: "2px solid var(--accent)",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 900, letterSpacing: 1 }}>LEGAL</div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "3px 8px",
                  borderRadius: 999,
                  background: "var(--accent)",
                  color: "#000",
                  textTransform: "uppercase",
                }}
              >
                Important
              </span>
            </div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
              Privacy Policy &amp; Terms &amp; Conditions
            </div>
          </div>

          <div style={{ flex: 1 }} />

          <button
            onClick={() => setShowLogoutConfirm(true)}
            style={{
              padding: 14,
              borderRadius: 14,
              background: "var(--accent)",
              border: "none",
              color: "white",
              fontWeight: 900,
            }}
          >
            Log out
          </button>
        </div>
      </div>

      {/* LOGOUT CONFIRM MODAL */}
      {showLogoutConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
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
              background: "var(--card)",
              borderRadius: 16,
              padding: 18,
              border: "1px solid var(--border)",
              textAlign: "center",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16 }}>Log out?</div>
            <div style={{ opacity: 0.7, marginTop: 6 }}>
              You will need to sign back in.
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  background: "transparent",
                  border: "1px solid var(--accent)",
                  color: "var(--accent)",
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
                  background: "var(--accent)",
                  border: "none",
                  color: "white",
                  fontWeight: 900,
                }}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEGAL MODAL(S) */}
      {legalModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setLegalModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "90%",
              maxWidth: legalModal === "menu" ? 360 : 420,
              maxHeight: "80vh",
              background: "var(--card)",
              borderRadius: 18,
              padding: 18,
              border: "1px solid var(--border)",
              overflowY: legalModal === "menu" ? "visible" : "auto",
            }}
          >
            {legalModal === "menu" && (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                    Legal
                  </h3>
                  <button
                    onClick={() => setLegalModal(null)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--text)",
                      fontSize: 16,
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>

                <p style={{ fontSize: 13, opacity: 0.8, marginBottom: 14 }}>
                  Read how ArmPal handles your data and the terms of using the app.
                </p>

                <Link
                  to="/privacy"
                  state={{ fromSettingsLegal: true }}
                  onClick={closeLegalAndOverlay}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--card-2)",
                    color: "var(--text)",
                    fontWeight: 700,
                    marginBottom: 10,
                    textAlign: "left",
                    textDecoration: "none",
                  }}
                >
                  Privacy Policy
                </Link>

                <Link
                  to="/terms"
                  state={{ fromSettingsLegal: true }}
                  onClick={closeLegalAndOverlay}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--card-2)",
                    color: "var(--text)",
                    fontWeight: 700,
                    marginBottom: 10,
                    textAlign: "left",
                    textDecoration: "none",
                  }}
                >
                  Terms of Service
                </Link>

                <Link
                  to="/support"
                  state={{ fromSettingsLegal: true }}
                  onClick={closeLegalAndOverlay}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--card-2)",
                    color: "var(--text)",
                    fontWeight: 700,
                    textAlign: "left",
                    textDecoration: "none",
                  }}
                >
                  Contact Support
                </Link>
              </>
            )}

            {legalModal === "privacy" && (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <button
                    onClick={() => setLegalModal("menu")}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--text)",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => setLegalModal(null)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--text)",
                      fontSize: 16,
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>

                <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 8px" }}>
                  Privacy Policy
                </h3>
                <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
                  Last updated: {new Date().toLocaleDateString()}
                </p>

                <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>
                  ArmPal helps you track your training and connect with other athletes.
                  We only collect the data we need to run the app and improve it, and
                  we never sell your personal data.
                </p>

                <h4 style={{ fontSize: 15, fontWeight: 700, marginTop: 12 }}>
                  Data We Collect
                </h4>
                <ul style={{ paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
                  <li>
                    <strong>Account &amp; profile info</strong>: email, handle, display
                    name, avatar, and basic settings tied to your account.
                  </li>
                  <li style={{ marginTop: 6 }}>
                    <strong>Workout data</strong>: workouts you log, exercises, PRs,
                    goals, and related training history.
                  </li>
                  <li style={{ marginTop: 6 }}>
                    <strong>Messages &amp; social activity</strong>: direct messages,
                    group chats, and friend connections needed to power social features.
                  </li>
                  <li style={{ marginTop: 6 }}>
                    <strong>Uploaded progress images</strong>: photos or media you
                    choose to upload for tracking progress.
                  </li>
                  <li style={{ marginTop: 6 }}>
                    <strong>Measurements</strong>: body measurements and other metrics
                    you log to follow your progress over time.
                  </li>
                  <li style={{ marginTop: 6 }}>
                    <strong>Subscription / payment status</strong>: information about
                    whether you have a Pro subscription and related billing status (we
                    rely on third‑party processors for payments).
                  </li>
                </ul>

                <h4 style={{ fontSize: 15, fontWeight: 700, marginTop: 12 }}>
                  How We Store Data
                </h4>
                <p style={{ fontSize: 13, lineHeight: 1.6 }}>
                  ArmPal uses <strong>Supabase</strong> as our primary backend. Your
                  account, workout history, messages, measurements, and other app data
                  are stored in Supabase databases and storage running on modern cloud
                  infrastructure.
                </p>

                <h4 style={{ fontSize: 15, fontWeight: 700, marginTop: 12 }}>
                  How We Use Data
                </h4>
                <p style={{ fontSize: 13, lineHeight: 1.6 }}>
                  We use your data to operate and improve ArmPal, including:
                </p>
                <ul style={{ paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
                  <li>Creating and maintaining your account and profile.</li>
                  <li style={{ marginTop: 6 }}>
                    Powering training tools like logs, analytics, and recommendations.
                  </li>
                  <li style={{ marginTop: 6 }}>
                    Enabling messaging, friends, and other social features.
                  </li>
                  <li style={{ marginTop: 6 }}>
                    Sending optional notifications about activity related to your
                    account.
                  </li>
                </ul>

                <h4 style={{ fontSize: 15, fontWeight: 700, marginTop: 12 }}>
                  No Sale of Personal Data
                </h4>
                <p style={{ fontSize: 13, lineHeight: 1.6 }}>
                  We <strong>do not sell</strong> your personal data. We may work with
                  service providers (for infrastructure, analytics, or payments) who
                  process data on our behalf under contract, but they do not own or sell
                  your data.
                </p>

                <h4 style={{ fontSize: 15, fontWeight: 700, marginTop: 12 }}>
                  Security Measures
                </h4>
                <p style={{ fontSize: 13, lineHeight: 1.6 }}>
                  We use reasonable technical and organizational measures to protect
                  your information, including Supabase authentication, access controls,
                  and HTTPS where supported. No system is perfectly secure, but we work
                  to keep your data safe.
                </p>

                <h4 style={{ fontSize: 15, fontWeight: 700, marginTop: 12 }}>
                  Your Choices &amp; Control
                </h4>
                <p style={{ fontSize: 13, lineHeight: 1.6 }}>
                  You control what you share with ArmPal. You decide which workouts,
                  measurements, images, and messages to create or delete. If you want to
                  request account deletion or have questions about your data, contact us
                  using the email below.
                </p>

                <h4 style={{ fontSize: 15, fontWeight: 700, marginTop: 12 }}>
                  Contact
                </h4>
                <p style={{ fontSize: 13, lineHeight: 1.6 }}>
                  For privacy questions, use{" "}
                  <span style={{ fontWeight: 700 }}>Contact Support</span> in the Legal
                  section to reach the team.
                </p>
              </>
            )}

            {legalModal === "terms" && (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <button
                    onClick={() => setLegalModal("menu")}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--text)",
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => setLegalModal(null)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--text)",
                      fontSize: 16,
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                </div>

                <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 8px" }}>
                  Terms &amp; Conditions
                </h3>
                <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
                  Last updated: {new Date().toLocaleDateString()}
                </p>

                <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>
                  By using ArmPal, you agree to these Terms &amp; Conditions. If you do
                  not agree, please stop using the app.
                </p>

                <h4 style={{ fontSize: 15, fontWeight: 700, marginTop: 12 }}>
                  Fitness &amp; Information Only
                </h4>
                <p style={{ fontSize: 13, lineHeight: 1.6 }}>
                  ArmPal is a fitness tracking and informational tool. It does not
                  provide medical advice, diagnosis, or treatment. Always consult a
                  qualified healthcare professional before starting or changing any
                  training program.
                </p>

                <h4 style={{ fontSize: 15, fontWeight: 700, marginTop: 12 }}>
                  Your Responsibility &amp; Injury Risk
                </h4>
                <p style={{ fontSize: 13, lineHeight: 1.6 }}>
                  You are solely responsible for your training decisions and for
                  evaluating the risks of any exercise. Strength training and
                  armwrestling carry a risk of injury. You agree that you use ArmPal at
                  your own risk and that you are responsible for stopping or adjusting
                  any activity that feels unsafe.
                </p>

                <h4 style={{ fontSize: 15, fontWeight: 700, marginTop: 12 }}>
                  No Guarantee of Results
                </h4>
                <p style={{ fontSize: 13, lineHeight: 1.6 }}>
                  We do not guarantee any specific performance outcomes, strength gains,
                  rankings, or competition results. Progress depends on many factors
                  outside our control, including your consistency, health, and overall
                  lifestyle.
                </p>

                <h4 style={{ fontSize: 15, fontWeight: 700, marginTop: 12 }}>
                  App Provided &quot;As-Is&quot;
                </h4>
                <p style={{ fontSize: 13, lineHeight: 1.6 }}>
                  ArmPal is provided on an &quot;as-is&quot; and &quot;as-available&quot;
                  basis. To the fullest extent permitted by law, we disclaim all
                  warranties, express or implied, including implied warranties of
                  merchantability, fitness for a particular purpose, and
                  non‑infringement.
                </p>

                <h4 style={{ fontSize: 15, fontWeight: 700, marginTop: 12 }}>
                  Misuse &amp; Account Termination
                </h4>
                <p style={{ fontSize: 13, lineHeight: 1.6 }}>
                  Abusive, harassing, or illegal use of ArmPal is not allowed. We may
                  suspend or terminate accounts that:
                </p>
                <ul style={{ paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
                  <li>Violate these Terms or other posted policies.</li>
                  <li style={{ marginTop: 6 }}>
                    Engage in harassment, hate, or threats toward other users.
                  </li>
                  <li style={{ marginTop: 6 }}>
                    Attempt to hack, reverse engineer, or otherwise attack the service.
                  </li>
                </ul>

                <h4 style={{ fontSize: 15, fontWeight: 700, marginTop: 12 }}>
                  Limitation of Liability
                </h4>
                <p style={{ fontSize: 13, lineHeight: 1.6 }}>
                  To the maximum extent permitted by law, ArmPal and its creators are
                  not liable for any indirect, incidental, special, consequential, or
                  punitive damages, or any loss of profits or data, arising from your
                  use of the app, even if we have been advised of the possibility of
                  such damages.
                </p>

                <h4 style={{ fontSize: 15, fontWeight: 700, marginTop: 12 }}>
                  Contact
                </h4>
                <p style={{ fontSize: 13, lineHeight: 1.6 }}>
                  If you have questions about these Terms &amp; Conditions, use{" "}
                  <span style={{ fontWeight: 700 }}>Contact Support</span> in the Legal
                  section to reach the team.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
