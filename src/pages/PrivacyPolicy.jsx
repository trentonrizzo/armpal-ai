import React from "react";
import { Link } from "react-router-dom";

export default function PrivacyPolicy() {
  return (
    <div
      style={{
        padding: "16px 16px 90px",
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      <h1
        style={{
          fontSize: 24,
          fontWeight: 800,
          marginBottom: 12,
        }}
      >
        Privacy Policy
      </h1>

      <p style={{ fontSize: 13, opacity: 0.8, marginBottom: 16 }}>
        Last updated: {new Date().toLocaleDateString()}
      </p>

      <div
        style={{
          background: "var(--card)",
          borderRadius: 14,
          padding: 16,
          border: "1px solid var(--border)",
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        <p>
          ArmPal is built to help you track your armwrestling training and connect
          with friends. We only collect the data we need to provide and improve
          the app, and we don&apos;t sell your data.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 18 }}>
          Data We Collect
        </h2>
        <ul style={{ paddingLeft: 18, marginTop: 8 }}>
          <li>
            <strong>Profile information</strong>: such as your name, handle,
            email, avatar, and basic account settings.
          </li>
          <li style={{ marginTop: 6 }}>
            <strong>Workout data</strong>: logs of your workouts, exercises,
            PRs, measurements, goals, and related training data you choose to
            save in the app.
          </li>
          <li style={{ marginTop: 6 }}>
            <strong>Messages and social activity</strong>: direct messages with
            friends, group chats, friend connections, and basic activity needed
            to power social features.
          </li>
        </ul>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 18 }}>
          How We Store Your Data
        </h2>
        <p style={{ marginTop: 8 }}>
          ArmPal uses <strong>Supabase</strong> as our primary data platform.
          Your profile, workout history, and messages are stored in Supabase
          databases and storage. Supabase runs on modern cloud infrastructure
          with managed backups and access controls.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 18 }}>
          How We Use Your Data
        </h2>
        <p style={{ marginTop: 8 }}>
          We use your data to operate and improve ArmPal, including:
        </p>
        <ul style={{ paddingLeft: 18, marginTop: 8 }}>
          <li>Creating and maintaining your account and profile.</li>
          <li style={{ marginTop: 6 }}>
            Powering training features like workout logs, analytics, and goals.
          </li>
          <li style={{ marginTop: 6 }}>
            Enabling social features like friends, messages, and coaching.
          </li>
          <li style={{ marginTop: 6 }}>
            Sending optional notifications about activity in your account.
          </li>
        </ul>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 18 }}>
          No Sale of Personal Data
        </h2>
        <p style={{ marginTop: 8 }}>
          We <strong>do not sell</strong> your personal data to third parties.
          We may use third-party services (like analytics or infrastructure
          providers) to help run the app, but they only process data on our
          behalf under contractual agreements.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 18 }}>
          Security Practices
        </h2>
        <p style={{ marginTop: 8 }}>
          We take reasonable technical and organizational measures to protect
          your data, including:
        </p>
        <ul style={{ paddingLeft: 18, marginTop: 8 }}>
          <li>Using Supabase authentication and access controls.</li>
          <li style={{ marginTop: 6 }}>
            Restricting direct access to production databases.
          </li>
          <li style={{ marginTop: 6 }}>
            Using HTTPS to encrypt data in transit where supported.
          </li>
        </ul>
        <p style={{ marginTop: 8 }}>
          No security system is perfect, and we can&apos;t guarantee absolute
          security, but we continuously work to protect your information.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 18 }}>
          Your Choices
        </h2>
        <p style={{ marginTop: 8 }}>
          You can update some of your profile information from within the app.
          If you want to delete your account or request additional data actions,
          contact us using the email below.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 18 }}>
          Contact
        </h2>
        <p style={{ marginTop: 8 }}>
          If you have questions about this Privacy Policy or how we handle your
          data, contact us at{" "}
          <a
            href="mailto:support@armpal.app"
            style={{ color: "var(--accent)", textDecoration: "underline" }}
          >
            support@armpal.app
          </a>
          .
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

