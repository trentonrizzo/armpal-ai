import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function CreditsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (alive) setUser(u ?? null);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      const [walletRes, txRes] = await Promise.all([
        supabase.from("points_wallet").select("balance, lifetime_earned").eq("user_id", user.id).maybeSingle(),
        supabase.from("points_transactions").select("id, amount, reason, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
      ]);
      if (!alive) return;
      setWallet(walletRes.data || { balance: 0, lifetime_earned: 0 });
      setTransactions(txRes.data || []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user?.id]);

  const balance = wallet?.balance ?? 0;
  const lifetimeEarned = wallet?.lifetime_earned ?? 0;

  return (
    <div style={styles.wrap}>
      <button type="button" onClick={() => navigate(-1)} style={styles.backBtn}>
        ← Back
      </button>
      <h1 style={styles.title}>Credits</h1>

      {loading ? (
        <p style={styles.hint}>Loading…</p>
      ) : (
        <>
          <div style={styles.summary}>
            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>Current balance</span>
              <span style={styles.summaryVal}>{balance.toLocaleString()}</span>
            </div>
            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>Lifetime earned</span>
              <span style={styles.summaryVal}>{lifetimeEarned.toLocaleString()}</span>
            </div>
          </div>

          <h2 style={styles.sectionTitle}>History</h2>
          <ul style={styles.list}>
            {transactions.length === 0 ? (
              <li style={styles.empty}>No transactions yet.</li>
            ) : (
              transactions.map((tx) => {
                const isPositive = tx.amount > 0;
                return (
                  <li key={tx.id} style={styles.row}>
                    <div style={styles.rowLeft}>
                      <span style={{ ...styles.amount, color: isPositive ? "var(--green, #22c55e)" : "var(--red, #ef4444)" }}>
                        {isPositive ? "+" : ""}{tx.amount}
                      </span>
                      <span style={styles.reason}>{tx.reason || "—"}</span>
                    </div>
                    <span style={styles.date}>
                      {tx.created_at ? new Date(tx.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        </>
      )}
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
  title: { fontSize: 22, fontWeight: 800, margin: "0 0 20px", color: "var(--text)" },
  hint: { color: "var(--text-dim)", fontSize: 14 },
  summary: {
    background: "var(--card-2)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "16px 18px",
    marginBottom: 24,
  },
  summaryRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  summaryLabel: { fontSize: 14, color: "var(--text-dim)" },
  summaryVal: { fontSize: 18, fontWeight: 700, color: "var(--text)" },
  sectionTitle: { fontSize: 16, fontWeight: 700, margin: "0 0 12px", color: "var(--text)" },
  list: { listStyle: "none", margin: 0, padding: 0 },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 14px",
    background: "var(--card-2)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    marginBottom: 8,
  },
  rowLeft: { display: "flex", flexDirection: "column", gap: 2 },
  amount: { fontSize: 16, fontWeight: 700 },
  reason: { fontSize: 13, color: "var(--text-dim)" },
  date: { fontSize: 12, color: "var(--text-dim)" },
  empty: { padding: 20, textAlign: "center", color: "var(--text-dim)", fontSize: 14 },
};
