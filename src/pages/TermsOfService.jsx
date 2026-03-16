import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";

export default function TermsOfService() {
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
        padding: "16px 16px 90px",
        maxWidth: 900,
        margin: "0 auto",
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
              : navigate("/profile", { replace: true })
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
          Terms of Service
        </h1>
      </div>

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
          By using ArmPal, you agree to the terms below. If you do not agree,
          please do not use the app.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 18 }}>
          Fitness Disclaimer
        </h2>
        <p style={{ marginTop: 8 }}>
          ArmPal is a training and tracking tool. It does not provide medical,
          physiotherapy, or professional healthcare advice. Training, including
          armwrestling and strength work, carries a risk of injury. Always
          consult a qualified healthcare provider before starting any new
          exercise program.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 18 }}>
          User Responsibility
        </h2>
        <p style={{ marginTop: 8 }}>
          You are solely responsible for how you use the app and for any
          decisions you make about your training. This includes:
        </p>
        <ul style={{ paddingLeft: 18, marginTop: 8 }}>
          <li>Choosing which workouts, loads, and volumes to perform.</li>
          <li style={{ marginTop: 6 }}>
            Monitoring your own readiness, pain, and recovery.
          </li>
          <li style={{ marginTop: 6 }}>
            Stopping or modifying training if something feels unsafe.
          </li>
        </ul>
        <p style={{ marginTop: 8 }}>
          ArmPal is not responsible for injuries, health issues, or other
          outcomes that result from training choices you make.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 18 }}>
          No Guarantee of Results
        </h2>
        <p style={{ marginTop: 8 }}>
          We do not guarantee any specific performance, strength, or competitive
          results. Training outcomes depend on many factors, including genetics,
          consistency, lifestyle, and overall health.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 18 }}>
          App Provided &quot;As-Is&quot;
        </h2>
        <p style={{ marginTop: 8 }}>
          ArmPal is provided on an &quot;as-is&quot; and &quot;as-available&quot; basis. To the
          fullest extent permitted by law, we disclaim all warranties, express
          or implied, including implied warranties of merchantability, fitness
          for a particular purpose, and non-infringement.
        </p>
        <p style={{ marginTop: 8 }}>
          We do not guarantee that the app will be uninterrupted, error-free,
          or free from security vulnerabilities.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 18 }}>
          Limitation of Liability
        </h2>
        <p style={{ marginTop: 8 }}>
          To the maximum extent allowed by law, ArmPal and its creators will not
          be liable for any indirect, incidental, special, consequential, or
          punitive damages, or any loss of profits or data, arising from your
          use of the app.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 18 }}>
          Account Termination
        </h2>
        <p style={{ marginTop: 8 }}>
          We may suspend or terminate your account, with or without notice, if
          we believe you are:
        </p>
        <ul style={{ paddingLeft: 18, marginTop: 8 }}>
          <li>Violating these Terms or other policies.</li>
          <li style={{ marginTop: 6 }}>
            Abusing, harassing, or threatening other users.
          </li>
          <li style={{ marginTop: 6 }}>
            Attempting to attack, reverse engineer, or misuse the app or its
            infrastructure.
          </li>
        </ul>
        <p style={{ marginTop: 8 }}>
          You may also stop using the app at any time. If you want to fully
          delete your account and associated data, contact us using the email
          below.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 18 }}>
          Changes to These Terms
        </h2>
        <p style={{ marginTop: 8 }}>
          We may update these Terms from time to time. If we make material
          changes, we may notify you in the app or by email. Your continued use
          of ArmPal after changes go into effect means you accept the updated
          Terms.
        </p>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 18 }}>
          Contact
        </h2>
        <p style={{ marginTop: 8 }}>
          If you have questions about these Terms of Service, contact us at{" "}
          <a
            href="mailto:support@armpal.app"
            style={{ color: "var(--accent)", textDecoration: "underline" }}
          >
            support@armpal.app
          </a>
          .
        </p>
        <p style={{ marginTop: 14, fontSize: 14, lineHeight: 1.6 }}>
          For support contact{" "}
          <a
            href="mailto:support@armpal.app"
            style={{ color: "var(--accent)", textDecoration: "underline" }}
          >
            support@armpal.app
          </a>{" "}
          or visit{" "}
          <Link
            to="/support"
            style={{ color: "var(--accent)", textDecoration: "underline" }}
          >
            /support
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

