import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useToast } from "../components/ToastProvider";

const BASE_URL = "https://armpal.app";
const SIGNUP_PATH = "/signup";

export default function ReferralsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [referralCode, setReferralCode] = useState("");
  const [referralCount, setReferralCount] = useState(0);
  const [pointsFromReferrals, setPointsFromReferrals] = useState(0);
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
      const { data: prof } = await supabase.from("profiles").select("referral_code").eq("id", user.id).single();
      if (!alive) return;
      let code = prof?.referral_code;
      if (!code) {
        code = generateCode();
        await supabase.from("profiles").update({ referral_code: code }).eq("id", user.id);
      }
      setReferralCode(code || "");

      const { count } = await supabase.from("referral_rewards").select("id", { count: "exact", head: true }).eq("referrer_user_id", user.id);
      if (alive) setReferralCount(count ?? 0);

      const { data: tx } = await supabase
        .from("points_transactions")
        .select("amount")
        .eq("user_id", user.id)
        .ilike("reason", "%referral%");
      const total = (tx || []).reduce((s, r) => s + (r.amount || 0), 0);
      if (alive) setPointsFromReferrals(total);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user?.id]);

  const referralLink = referralCode ? `${BASE_URL}${SIGNUP_PATH}?ref=${encodeURIComponent(referralCode)}` : "";

  function generateCode() {
    const chars = "abcdefghjkmnpqrstuvwxyz23456789";
    let s = "";
    for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  async function copyLink() {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      if (toast?.success) toast.success("Link copied!");
    } catch {
      if (toast?.error) toast.error("Could not copy");
    }
  }

  function shareLink() {
    if (!referralLink) return;
    if (navigator.share) {
      navigator.share({
        title: "Join ArmPal",
        text: "Train with me on ArmPal — track PRs, programs, and more.",
        url: referralLink,
      }).catch(() => copyLink());
    } else {
      copyLink();
    }
  }

  return (
    <div style={styles.wrap}>
      <button type="button" onClick={() => navigate(-1)} style={styles.backBtn}>
        ← Back
      </button>
      <h1 style={styles.title}>Invite Friends</h1>
      <p style={styles.subtitle}>Share your link. When friends sign up and go Pro, you earn credits.</p>

      {loading ? (
        <p style={styles.hint}>Loading…</p>
      ) : (
        <>
          <div style={styles.linkBox}>
            <input readOnly value={referralLink} style={styles.input} />
          </div>
          <div style={styles.actions}>
            <button type="button" onClick={copyLink} style={styles.btn}>
              Copy
            </button>
            <button type="button" onClick={shareLink} style={styles.btnPrimary}>
              Share
            </button>
          </div>

          <div style={styles.stats}>
            <div style={styles.statRow}>
              <span style={styles.statLabel}>Total referrals</span>
              <span style={styles.statVal}>{referralCount}</span>
            </div>
            <div style={styles.statRow}>
              <span style={styles.statLabel}>Points earned from referrals</span>
              <span style={styles.statVal}>{pointsFromReferrals}</span>
            </div>
          </div>
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
  title: { fontSize: 22, fontWeight: 800, margin: "0 0 8px", color: "var(--text)" },
  subtitle: { fontSize: 14, color: "var(--text-dim)", margin: "0 0 24px" },
  linkBox: { marginBottom: 12 },
  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--card-2)",
    color: "var(--text)",
    fontSize: 13,
    boxSizing: "border-box",
  },
  actions: { display: "flex", gap: 10, marginBottom: 28 },
  btn: {
    padding: "12px 20px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--card-2)",
    color: "var(--text)",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  btnPrimary: {
    padding: "12px 20px",
    borderRadius: 10,
    border: "none",
    background: "var(--accent)",
    color: "var(--text)",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  stats: {
    background: "var(--card-2)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "16px 18px",
  },
  statRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  statLabel: { fontSize: 14, color: "var(--text-dim)" },
  statVal: { fontSize: 18, fontWeight: 700, color: "var(--text)" },
  hint: { color: "var(--text-dim)", fontSize: 14 },
};
