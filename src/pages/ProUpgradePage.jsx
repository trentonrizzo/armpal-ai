// src/pages/ProUpgradePage.jsx
// Pro upgrade — App Store subscription on iOS; profile.is_pro on web.

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePurchase } from "../context/PurchaseContext";

const PRO_PRICE_FALLBACK_LABEL = "Price shown at purchase";

const FREE_FEATURES = [
  // Existing base benefits
  "Strength calculator",
  "Up to 5 workouts saved",
  "Up to 5 bodyweight logs",
  "Up to 5 measurement logs",
  "Up to 5 PR logs",
  "Unlimited nutrition entries",
  "Profiles + friends",
  // Media + AI limits (appended)
  "No video uploads",
  "20 photos/day (max 5MB)",
  "10 voice messages/day (30s)",
  "Limited AI usage (chat, food scan, workout converter)",
];

const PRO_FEATURES = [
  // Existing Pro benefits
  "AI Chat — up to 25 responses/day",
  "AI Workout Converter — up to 10 uses/day",
  "AI Food Scan — up to 10 scans/day",
  "Up to 1,000 workouts, PRs, measurements, bodyweight logs, and goals",
  "Unlimited nutrition tracking",
  "10 videos/day (max 25MB)",
  "100 photos/day (max 10MB)",
  "50 voice messages/day (2 min)",
  "Expanded AI usage with higher daily limits",
  "Access to all Pro features",
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
  const [error, setError] = useState(null);
  const {
    product,
    subscriptionStatus,
    priceStatus,
    initializing,
    purchaseLoading,
    restoreLoading,
    purchase,
    restore,
  } = usePurchase();

  const subResolving = subscriptionStatus === "loading" || initializing;
  const verifiedPro = subscriptionStatus === "pro";

  const livePrice = typeof product?.displayPrice === "string" ? product.displayPrice.trim() : "";
  const hasLivePrice = livePrice.length > 0;
  const priceLoading = priceStatus === "loading";

  const priceDisplay = priceLoading ? "Loading price..." : hasLivePrice ? livePrice : PRO_PRICE_FALLBACK_LABEL;
  const showPerMonthSuffix = hasLivePrice && !priceLoading;

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
          Unlock higher AI limits and more room for your training history.
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
              {priceDisplay}
              {showPerMonthSuffix ? <span style={S.tierPriceSub}> / month</span> : null}
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
            {priceDisplay}
            {showPerMonthSuffix ? <span style={S.priceUnit}> / month</span> : null}
          </p>
          <p style={S.priceSub}>Cancel anytime. No commitment.</p>
        </div>

        {error && <p style={S.error}>{error}</p>}

        <button
          type="button"
          onClick={async () => {
            setError(null);
            const result = await purchase();
            if (result?.ok) return;
            if (result?.status === "userCancelled") return;
            if (result?.status === "pending") {
              alert("Purchase is pending approval.");
              return;
            }
            if (result?.status === "verificationFailed") {
              alert("Purchase verification failed.");
              return;
            }
            if (result?.error) {
              alert(result.error);
              return;
            }
            alert("Purchase failed. Please try again.");
          }}
          disabled={subResolving || purchaseLoading || verifiedPro}
          style={{
            ...S.ctaBtn,
            opacity: subResolving || purchaseLoading || verifiedPro ? 0.8 : 1,
            cursor: subResolving || purchaseLoading || verifiedPro ? "not-allowed" : "pointer",
          }}
        >
          {verifiedPro
            ? "You're Pro"
            : subResolving
              ? "Checking..."
              : purchaseLoading
                ? "Processing..."
                : "Upgrade to Pro"}
        </button>

        <button
          type="button"
          onClick={async () => {
            setError(null);
            const result = await restore();
            if (result?.ok) return;
            if (result?.error) {
              alert(result.error);
            } else {
              alert("Restore failed.");
            }
          }}
          disabled={subResolving || restoreLoading}
          style={{
            ...S.restoreBtn,
            opacity: subResolving || restoreLoading ? 0.8 : 1,
            cursor: subResolving || restoreLoading ? "not-allowed" : "pointer",
          }}
        >
          {restoreLoading ? "Restoring..." : "Restore Purchases"}
        </button>

        <div style={S.disclosureBox}>
          <p style={S.disclosureLine}>
            <strong>
              {priceLoading
                ? "Loading price..."
                : hasLivePrice
                  ? `${livePrice} / month`
                  : PRO_PRICE_FALLBACK_LABEL}
            </strong>
          </p>
          <p style={S.disclosureLine}>Monthly subscription.</p>
          <p style={S.disclosureLine}>
            Subscription automatically renews monthly unless canceled at least 24 hours before the end
            of the current billing period.
          </p>
          <p style={S.disclosureLine}>
            Payment will be charged to your Apple ID at confirmation of purchase.
          </p>
          <p style={S.disclosureLine}>
            Your account will be charged for renewal within 24 hours before the end of the current
            period.
          </p>
          <p style={S.disclosureLine}>
            You can manage or cancel your subscription anytime in your Apple ID account settings.
          </p>
          <p style={S.disclosureLine}>Prices may vary by region.</p>
          <p style={S.legalLinks}>
            <a href="/privacy" style={S.legalLink}>
              Privacy Policy
            </a>
            <span style={{ opacity: 0.5 }}>•</span>
            <a href="/terms" style={S.legalLink}>
              Terms of Service
            </a>
          </p>
        </div>
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
  restoreBtn: {
    width: "100%",
    marginTop: 10,
    padding: "14px 20px",
    borderRadius: 14,
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: "var(--text)",
    fontWeight: 700,
    fontSize: 15,
  },
  disclosureBox: {
    marginTop: 12,
    textAlign: "left",
    fontSize: 12,
    opacity: 0.78,
    lineHeight: 1.45,
  },
  disclosureLine: {
    margin: "0 0 6px",
    color: "var(--text)",
  },
  legalLinks: {
    margin: "10px 0 0",
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  legalLink: {
    color: "var(--accent)",
    textDecoration: "underline",
    fontWeight: 700,
  },
  ctaFooter: {
    marginTop: 10,
    fontSize: 12,
    opacity: 0.5,
  },
};
