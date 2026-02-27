import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";

export default function DashboardCreditsCard() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [user, setUser] = useState(null);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (alive) setUser(u ?? null);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("points_wallet")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!alive) return;
      setBalance(data?.balance ?? 0);
    })();
    return () => { alive = false; };
  }, [user?.id]);

  // Live update: refetch when window gains focus (e.g. return from Credits page)
  useEffect(() => {
    if (!user?.id) return;
    const onFocus = () => {
      supabase
        .from("points_wallet")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => setBalance(data?.balance ?? 0));
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user?.id]);

  const credits = balance ?? 0;

  return (
    <button
      type="button"
      onClick={() => navigate("/credits")}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onPointerDown={() => setHover(true)}
      onPointerUp={() => setHover(false)}
      style={{ ...styles.row, opacity: hover ? 0.8 : 1 }}
      aria-label={`Credits: ${credits}`}
    >
      <span style={styles.coin} aria-hidden />
      <span style={styles.count}>{Number(credits).toLocaleString()}</span>
    </button>
  );
}

const styles = {
  row: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    padding: 0,
    border: "none",
    background: "transparent",
    color: "var(--text)",
    cursor: "pointer",
    transition: "opacity 0.15s ease",
  },
  coin: {
    width: 24,
    height: 24,
    borderRadius: "50%",
    background: "linear-gradient(145deg, #FFD700 0%, #F5B800 100%)",
    boxShadow: "0 0 10px rgba(255, 215, 0, 0.45)",
    flexShrink: 0,
  },
  count: {
    fontSize: 15,
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
  },
};
