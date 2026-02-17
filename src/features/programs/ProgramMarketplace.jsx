import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import ProgramCard from "./ProgramCard";

export default function ProgramMarketplace() {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState([]);
  const [ownedIds, setOwnedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [user, setUser] = useState(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!alive) return;
      setUser(u ?? null);

      const { data: progs, error: progErr } = await supabase
        .from("programs")
        .select("*")
        .order("created_at", { ascending: false });

      if (!alive) return;
      const raw = progErr ? [] : (progs ?? []);
      setPrograms(raw);

      if (u?.id) {
        const { data: upRows } = await supabase
          .from("user_programs")
          .select("program_id")
          .eq("user_id", u.id);
        if (alive && upRows) {
          setOwnedIds(new Set(upRows.map((r) => r.program_id)));
        }
      }
      setLoading(false);
    })();

    return () => { alive = false; };
  }, []);

  const uniquePrograms = Object.values(
    programs.reduce((acc, p) => {
      if (!acc[p.title] || (acc[p.title].created_at < p.created_at)) {
        acc[p.title] = p;
      }
      return acc;
    }, {})
  );

  const searchLower = search.trim().toLowerCase();
  const filtered = searchLower
    ? uniquePrograms.filter((p) => (p.title || "").toLowerCase().includes(searchLower))
    : uniquePrograms;

  return (
    <div style={styles.wrap}>
      <h1 style={styles.title}>Programs</h1>

      <Link to="/programs/create" className="pill" style={styles.createLink}>
        + Create Program
      </Link>

      <input
        type="search"
        placeholder="Search by title…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={styles.search}
        aria-label="Search programs"
      />

      <div style={styles.links}>
        <button
          type="button"
          onClick={() => navigate("/programs/my")}
          style={styles.linkBtn}
        >
          My Programs
        </button>
      </div>

      {loading ? (
        <p style={styles.hint}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p style={styles.hint}>
          {uniquePrograms.length === 0
            ? "No programs in the marketplace yet."
            : "No programs match your search."}
        </p>
      ) : (
        <div style={styles.grid}>
          {filtered.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              owned={ownedIds.has(program.id)}
            />
          ))}
        </div>
      )}

      {/* Future: creator filter / creator support */}
    </div>
  );
}

const styles = {
  wrap: {
    padding: "16px 16px 90px",
    maxWidth: "560px",
    margin: "0 auto",
  },
  title: {
    fontSize: 22,
    fontWeight: 900,
    margin: "0 0 16px",
    color: "var(--text)",
  },
  search: {
    width: "100%",
    padding: "12px 14px",
    marginBottom: 12,
    background: "var(--card-2)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    color: "var(--text)",
    fontSize: 14,
    boxSizing: "border-box",
  },
  links: {
    marginBottom: 16,
  },
  linkBtn: {
    padding: "8px 0",
    background: "none",
    border: "none",
    color: "var(--accent)",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  hint: {
    color: "var(--text-dim)",
    fontSize: 14,
  },
  grid: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  createLink: {
    display: "inline-block",
    marginBottom: 16,
    padding: "10px 16px",
    borderRadius: 999,
    background: "var(--accent)",
    color: "var(--text)",
    fontWeight: 700,
    fontSize: 14,
    textDecoration: "none",
    border: "1px solid var(--border)",
  },
};
