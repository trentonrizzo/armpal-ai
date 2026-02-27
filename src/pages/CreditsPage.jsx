import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useToast } from "../components/ToastProvider";

const BASE_URL = "https://armpal.app";
const SIGNUP_PATH = "/signup";

function generateReferralCode() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export default function CreditsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [referralCode, setReferralCode] = useState("");
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
      const [walletRes, txRes, profRes] = await Promise.all([
        supabase.from("points_wallet").select("balance, lifetime_earned").eq("user_id", user.id).maybeSingle(),
        supabase.from("points_transactions").select("id, amount, reason, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
        supabase.from("profiles").select("referral_code").eq("id", user.id).maybeSingle(),
      ]);
      if (!alive) return;
      setWallet(walletRes.data || { balance: 0, lifetime_earned: 0 });
      setTransactions(txRes.data || []);
      let code = profRes?.data?.referral_code;
      if (!code) {
        code = generateReferralCode();
        await supabase.from("profiles").update({ referral_code: code }).eq("id", user.id);
      }
      setReferralCode(code || "");
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user?.id]);

  const balance = wallet?.balance ?? 0;
  const lifetimeEarned = wallet?.lifetime_earned ?? 0;
  const referralLink = referralCode ? `${BASE_URL}${SIGNUP_PATH}?ref=${encodeURIComponent(referralCode)}` : "";

  async function copyReferralLink() {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      if (toast?.success) toast.success("Link copied!");
    } catch {
      if (toast?.error) toast.error("Could not copy");
    }
  }

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

          <div style={styles.actions}>
            <Link to="/redeem" style={styles.actionBtn}>Redeem</Link>
            <Link to="/referrals" style={styles.actionBtn}>Invite Friends</Link>
          </div>

          <h2 style={styles.sectionTitle}>Refer a friend</h2>
          <p style={styles.referralExplanation}>
            Share your link. When friends sign up and go Pro, you earn credits.
          </p>
          <div style={styles.linkBox}>
            <input readOnly value={referralLink} style={styles.linkInput} aria-label="Referral link" />
          </div>
          <button type="button" onClick={copyReferralLink} disabled={!referralLink} style={styles.copyBtn}>
            Copy referral link
          </button>

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
  actions: { display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  actionBtn: {
    padding: "10px 16px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--card-2)",
    color: "var(--text)",
    fontSize: 14,
    fontWeight: 600,
    textDecoration: "none",
  },
  referralExplanation: { fontSize: 14, color: "var(--text-dim)", margin: "0 0 12px" },
  linkBox: { marginBottom: 10 },
  linkInput: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--card-2)",
    color: "var(--text)",
    fontSize: 13,
    boxSizing: "border-box",
  },
  copyBtn: {
    padding: "12px 20px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--card-2)",
    color: "var(--text)",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    marginBottom: 24,
  },
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
