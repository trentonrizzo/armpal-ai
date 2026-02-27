import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import ProgramCard from "./ProgramCard";

export default function MyPrograms() {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!alive) return;
      setUser(u ?? null);

      if (!u?.id) {
        setPrograms([]);
        setLoading(false);
        return;
      }

      const [createdRes, purchasedRes] = await Promise.all([
        supabase.from("programs").select("*").eq("creator_id", u.id),
        supabase.from("user_programs").select("program_id").eq("user_id", u.id),
      ]);

      if (!alive) return;

      const createdIds = new Set((createdRes.data ?? []).map((p) => p.id));
      const purchasedIds = (purchasedRes.data ?? []).map((r) => r.program_id);
      const allIds = [...createdIds, ...purchasedIds].filter(Boolean);
      const uniqueIds = [...new Set(allIds)];

      if (uniqueIds.length === 0) {
        setPrograms([]);
        setLoading(false);
        return;
      }

      const { data: progs, error: progErr } = await supabase
        .from("programs")
        .select("*")
        .in("id", uniqueIds);

      if (!alive) return;
      if (progErr) {
        setPrograms([]);
      } else {
        setPrograms(progs ?? []);
      }
      setLoading(false);
    })();

    return () => { alive = false; };
  }, []);

  return (
    <div style={styles.wrap}>
      <button
        type="button"
        onClick={() => navigate("/programs")}
        style={styles.backBtn}
        aria-label="Back to programs"
      >
        ← Programs
      </button>

      <h1 style={styles.title}>My Programs</h1>

      {!user ? (
        <p style={styles.hint}>Sign in to see your programs.</p>
      ) : loading ? (
        <p style={styles.hint}>Loading…</p>
      ) : programs.length === 0 ? (
        <p style={styles.hint}>You don’t have any programs yet. Browse the marketplace.</p>
      ) : (
        <div style={styles.grid}>
          {programs.map((program) => (
            <ProgramCard key={program.id} program={program} owned />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate("/programs")}
        style={styles.marketBtn}
      >
        Browse marketplace
      </button>
    </div>
  );
}

const styles = {
  wrap: {
    padding: "16px 16px 90px",
    maxWidth: "560px",
    margin: "0 auto",
  },
  backBtn: {
    marginBottom: 16,
    padding: "8px 0",
    background: "none",
    border: "none",
    color: "var(--text-dim)",
    fontSize: 14,
    cursor: "pointer",
  },
  title: {
    fontSize: 20,
    fontWeight: 800,
    margin: "0 0 16px",
    color: "var(--text)",
  },
  hint: {
    color: "var(--text-dim)",
    fontSize: 14,
    marginBottom: 16,
  },
  grid: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  marketBtn: {
    marginTop: 16,
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--card-2)",
    color: "var(--text)",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
};
