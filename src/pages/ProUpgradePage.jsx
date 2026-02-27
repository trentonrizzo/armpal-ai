// src/pages/ProUpgradePage.jsx
// Pro upgrade page — benefits, price, CTA to Stripe checkout.
// Pro status remains from Supabase profiles.is_pro (webhook updates).

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

const PRO_PRICE_DISPLAY = "$7.99";

const FREE_FEATURES = [
  "Up to 25 workouts saved",
  "Basic PR tracking",
  "Basic measurements",
  "AI chat (limited)",
  "Messaging",
  "Add friends",
  "Basic dashboard",
  "Progress photos (private)",
  "Standard analytics",
  "Workout sharing",
];

const PRO_FEATURES = [
  "Up to 1,000 saved workouts",
  "Unlimited program creation",
  "Advanced AI workout generator",
  "AI structured program builder",
  "Rep range + % + RPE support",
  "Advanced analytics graphs",
  "1RM prediction",
  "Goal tracking system",
  "Milestone celebrations",
  "Streak tracking",
  "Full measurement history tracking",
  "Progress comparison charts",
  "Workout export visuals",
  "Shareable progress cards",
  "AI personality modes (Coach / Savage / Science / Recovery)",
  "Early feature access",
  "Creator marketplace access (future)",
  "Referral rewards system (future)",
  "Pro badge",
  "Exclusive premium programs",
  "Advanced workout sharing tools",
];

function FeatureCheck({ text, accent }) {
  return (
    <li style={S.featureRow}>
      <span style={{ ...S.checkIcon, color: accent ? "var(--accent)" : "#4ade80" }}>✓</span>
      <span>{text}</span>
    </li>
  );
}

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
    <div style={S.page}>
      <button type="button" onClick={() => navigate(-1)} style={S.backBtn}>
        ← Back
      </button>

      {/* Hero */}
      <div style={S.heroCard}>
        <div style={S.proBadge}>PRO</div>
        <h1 style={S.heroTitle}>Upgrade to ArmPal Pro</h1>
        <p style={S.heroSub}>
          Unlock the full training experience — advanced AI, analytics, program creation, and more.
        </p>
      </div>

      {/* Tier comparison */}
      <div style={S.tierGrid}>
        {/* Free tier */}
        <div style={S.tierCard}>
          <div style={S.tierHeader}>
            <span style={S.tierLabel}>Free</span>
            <span style={S.tierPrice}>$0</span>
          </div>
          <ul style={S.featureList}>
            {FREE_FEATURES.map((f) => (
              <FeatureCheck key={f} text={f} accent={false} />
            ))}
          </ul>
        </div>

        {/* Pro tier */}
        <div style={{ ...S.tierCard, ...S.tierCardPro }}>
          <div style={S.tierHeader}>
            <span style={{ ...S.tierLabel, color: "var(--accent)" }}>Pro</span>
            <span style={S.tierPrice}>
              {PRO_PRICE_DISPLAY}
              <span style={S.tierPriceSub}>/mo</span>
            </span>
          </div>
          <ul style={S.featureList}>
            {PRO_FEATURES.map((f) => (
              <FeatureCheck key={f} text={f} accent />
            ))}
          </ul>
        </div>
      </div>

      {/* Price + CTA */}
      <div style={S.ctaSection}>
        <div style={S.priceBox}>
          <span style={S.priceLabel}>Monthly</span>
          <p style={S.priceValue}>
            {PRO_PRICE_DISPLAY}
            <span style={S.priceUnit}> / month</span>
          </p>
          <p style={S.priceSub}>Cancel anytime. No commitment.</p>
        </div>

        {error && <p style={S.error}>{error}</p>}

        <button
          type="button"
          onClick={startCheckout}
          disabled={loading}
          style={{ ...S.ctaBtn, opacity: loading ? 0.8 : 1, cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? "Redirecting…" : "Upgrade to Pro"}
        </button>
        <p style={S.ctaFooter}>Secure checkout via Stripe</p>
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: "100vh",
    padding: "24px 16px 120px",
    maxWidth: 520,
    margin: "0 auto",
  },
  backBtn: {
    background: "transparent",
    border: "none",
    color: "var(--text)",
    opacity: 0.8,
    fontSize: 14,
    marginBottom: 20,
    cursor: "pointer",
  },
  heroCard: {
    textAlign: "center",
    padding: "32px 20px",
    borderRadius: 20,
    background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 15%, var(--card)) 0%, var(--card) 100%)",
    border: "1px solid color-mix(in srgb, var(--accent) 30%, var(--border))",
    marginBottom: 24,
  },
  proBadge: {
    display: "inline-block",
    padding: "4px 16px",
    borderRadius: 999,
    background: "var(--accent)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  heroTitle: { fontSize: 26, fontWeight: 900, margin: "0 0 8px", color: "var(--text)" },
  heroSub: { fontSize: 14, opacity: 0.8, margin: 0, lineHeight: 1.5, color: "var(--text-dim)" },

  tierGrid: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    marginBottom: 24,
  },
  tierCard: {
    borderRadius: 16,
    padding: "20px 16px",
    background: "var(--card)",
    border: "1px solid var(--border)",
  },
  tierCardPro: {
    border: "1.5px solid var(--accent)",
    background: "color-mix(in srgb, var(--accent) 4%, var(--card))",
  },
  tierHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingBottom: 12,
    borderBottom: "1px solid var(--border)",
  },
  tierLabel: { fontSize: 16, fontWeight: 800, color: "var(--text)" },
  tierPrice: { fontSize: 20, fontWeight: 800, color: "var(--text)" },
  tierPriceSub: { fontSize: 13, fontWeight: 500, opacity: 0.7 },

  featureList: { listStyle: "none", padding: 0, margin: 0 },
  featureRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "6px 0",
    fontSize: 14,
    color: "var(--text)",
    lineHeight: 1.4,
  },
  checkIcon: { flexShrink: 0, fontWeight: 900, fontSize: 15, marginTop: 1 },

  ctaSection: {
    textAlign: "center",
  },
  priceBox: {
    padding: "18px 20px",
    borderRadius: 14,
    background: "var(--card-2)",
    border: "1px solid var(--border)",
    marginBottom: 20,
  },
  priceLabel: { fontSize: 13, opacity: 0.7, display: "block", marginBottom: 4 },
  priceValue: { fontSize: 28, fontWeight: 900, margin: "0 0 4px", color: "var(--text)" },
  priceUnit: { fontSize: 14, fontWeight: 500, opacity: 0.7 },
  priceSub: { fontSize: 12, opacity: 0.6, margin: 0 },

  error: {
    color: "#f55",
    fontSize: 14,
    marginBottom: 12,
  },
  ctaBtn: {
    width: "100%",
    padding: "16px 20px",
    borderRadius: 14,
    border: "none",
    background: "var(--accent)",
    color: "#fff",
    fontWeight: 800,
    fontSize: 17,
    letterSpacing: 0.3,
  },
  ctaFooter: {
    marginTop: 10,
    fontSize: 12,
    opacity: 0.5,
  },
};
