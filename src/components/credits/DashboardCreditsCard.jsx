import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../supabaseClient";

export default function DashboardCreditsCard() {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [displayBalance, setDisplayBalance] = useState(0);
  const [user, setUser] = useState(null);

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
      const { data } = await supabase
        .from("points_wallet")
        .select("balance, lifetime_earned")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!alive) return;
      setWallet(data || { balance: 0, lifetime_earned: 0 });
      setDisplayBalance(data?.balance ?? 0);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user?.id]);

  // Smooth count-up animation when balance changes
  useEffect(() => {
    if (wallet == null) return;
    const target = wallet.balance ?? 0;
    const start = displayBalance;
    if (start === target) return;
    const startTime = performance.now();
    const duration = 400;
    let raf;
    const tick = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - t, 2);
      setDisplayBalance(Math.round(start + (target - start) * ease));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [wallet?.balance]);

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.emoji}>🔥</span>
        <span style={styles.label}>ArmPal Credits</span>
      </div>
      {loading ? (
        <p style={styles.balance}>—</p>
      ) : (
        <p style={styles.balance}>{displayBalance.toLocaleString()}</p>
      )}
      <div style={styles.actions}>
        <Link to="/credits" style={styles.btn}>
          View History
        </Link>
        <Link to="/referrals" style={styles.btn}>
          Invite Friends
        </Link>
        <Link to="/redeem" style={styles.btn}>
          Redeem
        </Link>
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: "var(--card-2)",
    borderRadius: 16,
    padding: "20px 18px",
    marginBottom: 16,
    border: "1px solid var(--border)",
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  emoji: { fontSize: 18 },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-dim)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  balance: {
    fontSize: 32,
    fontWeight: 800,
    margin: "0 0 16px",
    color: "var(--text)",
    fontVariantNumeric: "tabular-nums",
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  btn: {
    padding: "10px 16px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--bg)",
    color: "var(--text)",
    fontSize: 13,
    fontWeight: 600,
    textDecoration: "none",
  },
};
