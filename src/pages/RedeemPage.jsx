import React from "react";
import { useNavigate } from "react-router-dom";

export default function RedeemPage() {
  const navigate = useNavigate();

  const comingSoonOptions = [
    "Subscription discount",
    "Program purchases",
    "Future shop discounts",
  ];

  return (
    <div style={styles.wrap}>
      <button type="button" onClick={() => navigate(-1)} style={styles.backBtn}>
        ← Back
      </button>
      <h1 style={styles.title}>Redeem Credits</h1>
      <p style={styles.subtitle}>Use your ArmPal Credits for rewards.</p>

      <div style={styles.card}>
        <p style={styles.comingSoon}>Coming soon</p>
        <ul style={styles.list}>
          {comingSoonOptions.map((opt, i) => (
            <li key={i} style={styles.option}>{opt}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const styles = {
  wrap: { padding: "16px 16px 90px", maxWidth: "480px", margin: "0 auto" },
  backBtn: {
    marginBottom: 16,
    padding: "8px 0",
    background: "none",
    border: "none",
    color: "var(--text-dim)",
    fontSize: 14,
    cursor: "pointer",
  },
  title: { fontSize: 22, fontWeight: 800, margin: "0 0 8px", color: "var(--text)" },
  subtitle: { fontSize: 14, color: "var(--text-dim)", margin: "0 0 24px" },
  card: {
    background: "var(--card-2)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: 24,
  },
  comingSoon: { fontSize: 16, fontWeight: 700, color: "var(--text-dim)", margin: "0 0 16px" },
  list: { listStyle: "none", margin: 0, padding: 0 },
  option: { padding: "8px 0", fontSize: 14, color: "var(--text)", borderBottom: "1px solid var(--border)" },
};
