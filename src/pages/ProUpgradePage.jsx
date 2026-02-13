// src/pages/ProUpgradePage.jsx
// Pro upgrade page — benefits, price, CTA to Stripe checkout.
// Pro status remains from Supabase profiles.is_pro (webhook updates).

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

const BENEFITS = [
  "Unlimited measurements, goals, workouts (1,000 cap)",
  "ArmPal AI chat access",
  "Smart Analytics / Progress Overview",
  "Future Pro features as we ship them",
];

export default function ProUpgradePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const startCheckout = async () => {
    setError(null);
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        setError("Please sign in to upgrade.");
        setLoading(false);
        return;
      }

      const res = await fetch(`${window.location.origin}/api/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Checkout failed");
      }

      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("No checkout URL returned");
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "24px 16px 100px",
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--text)",
          opacity: 0.8,
          fontSize: 14,
          marginBottom: 24,
          cursor: "pointer",
        }}
      >
        ← Back
      </button>

      <div
        style={{
          background: "var(--card)",
          borderRadius: 20,
          padding: 28,
          border: "1px solid var(--border)",
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px" }}>
          Upgrade to Pro
        </h1>
        <p style={{ fontSize: 14, opacity: 0.85, margin: "0 0 24px" }}>
          Unlock the full ArmPal experience.
        </p>

        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "0 0 28px",
          }}
        >
          {BENEFITS.map((text, i) => (
            <li
              key={i}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                marginBottom: 14,
                fontSize: 15,
              }}
            >
              <span style={{ color: "var(--accent)" }}>✓</span>
              <span>{text}</span>
            </li>
          ))}
        </ul>

        <div
          style={{
            marginBottom: 24,
            padding: "14px 16px",
            background: "var(--card-2)",
            borderRadius: 12,
            border: "1px solid var(--border)",
          }}
        >
          <span style={{ fontSize: 13, opacity: 0.8 }}>Price</span>
          <p style={{ fontSize: 22, fontWeight: 800, margin: "4px 0 0" }}>
            $9.99 <span style={{ fontWeight: 500, fontSize: 14 }}>/ month</span>
          </p>
          <p style={{ fontSize: 12, opacity: 0.7, margin: "6px 0 0" }}>
            (Stripe test mode may show $1 — real price in production.)
          </p>
        </div>

        {error && (
          <p
            style={{
              color: "var(--accent)",
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={startCheckout}
          disabled={loading}
          style={{
            width: "100%",
            padding: "14px 20px",
            borderRadius: 12,
            border: "none",
            background: "var(--accent)",
            color: "var(--text)",
            fontWeight: 700,
            fontSize: 16,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.8 : 1,
          }}
        >
          {loading ? "Redirecting…" : "Upgrade to Pro"}
        </button>
      </div>
    </div>
  );
}
