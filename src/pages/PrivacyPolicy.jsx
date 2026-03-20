import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  const location = useLocation();
  const backToSettingsLegal = () => {
    navigate("/profile", {
      replace: true,
      state: { openSettings: true, openLegal: true },
    });
  };

  return (
    <div
      style={{
        padding: "16px 16px calc(110px + var(--safe-area-bottom))",
        paddingTop: "calc(16px + var(--safe-area-top))",
        maxWidth: 760,
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          position: "relative",
          padding: "4px 52px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <button
          type="button"
          onClick={() =>
            location.state?.fromSettingsLegal
              ? backToSettingsLegal()
              : navigate("/", { replace: true })
          }
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            width: 36,
            height: 36,
            borderRadius: 18,
            background: "rgba(255,255,255,0.2)",
            border: "none",
            color: "var(--text)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <FaArrowLeft size={18} />
        </button>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 800,
            margin: 0,
            textAlign: "center",
          }}
        >
          Privacy Policy
        </h1>
      </div>

      <p style={{ fontSize: 13, opacity: 0.8, marginBottom: 16 }}>
        Last updated: {new Date().toLocaleDateString()}
      </p>

      <div
        style={{
          background: "var(--card)",
          borderRadius: 14,
          padding: 18,
          border: "1px solid var(--border)",
          fontSize: 14,
          lineHeight: 1.7,
        }}
      >
        <p style={{ marginBottom: 10 }}>
          ArmPal helps you track your training and connect with other athletes.
          We only collect the data we need to run the app and improve it, and
          we never sell your personal data.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 18 }}>
          Data We Collect
        </h2>
        <ul style={{ paddingLeft: 18, marginTop: 8, lineHeight: 1.6 }}>
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
            rely on third-party processors for payments).
          </li>
        </ul>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 18 }}>
          How We Store Data
        </h2>
        <p style={{ marginTop: 8 }}>
          ArmPal uses <strong>Supabase</strong> as our primary backend. Your
          account, workout history, messages, measurements, and other app data
          are stored in Supabase databases and storage running on modern cloud
          infrastructure.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 18 }}>
          How We Use Your Data
        </h2>
        <p style={{ marginTop: 8 }}>
          We use your data to operate and improve ArmPal, including:
        </p>
        <ul style={{ paddingLeft: 18, marginTop: 8, lineHeight: 1.6 }}>
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

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 18 }}>
          No Sale of Personal Data
        </h2>
        <p style={{ marginTop: 8 }}>
          We <strong>do not sell</strong> your personal data. We may work with
          service providers (for infrastructure, analytics, or payments) who
          process data on our behalf under contract, but they do not own or sell
          your data.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 18 }}>
          Security Measures
        </h2>
        <p style={{ marginTop: 8 }}>
          We use reasonable technical and organizational measures to protect
          your information, including Supabase authentication, access controls,
          and HTTPS where supported. No system is perfectly secure, but we work
          to keep your data safe.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 18 }}>
          Your Choices &amp; Control
        </h2>
        <p style={{ marginTop: 8 }}>
          You control what you share with ArmPal. You decide which workouts,
          measurements, images, and messages to create or delete. If you want to
          request account deletion or have questions about your data, contact us
          using the email below.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 18 }}>
          Contact
        </h2>
        <p style={{ marginTop: 8 }}>
          For privacy questions, use <span style={{ fontWeight: 700 }}>Contact Support</span> in the Legal
          section to reach the team.
        </p>
        <Link
          to="/support"
          style={{
            display: "inline-block",
            marginTop: 14,
            padding: "12px 20px",
            borderRadius: 12,
            background: "var(--accent)",
            color: "#fff",
            fontWeight: 700,
            textDecoration: "none",
            border: "1px solid var(--border)",
          }}
        >
          Contact Support
        </Link>
      </div>
    </div>
  );
}

