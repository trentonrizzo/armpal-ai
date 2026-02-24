import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import ProgramCard from "./ProgramCard";
import ProgramPreviewModal from "./ProgramPreviewModal";

export default function ProgramMarketplace() {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState([]);
  const [ownedIds, setOwnedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [user, setUser] = useState(null);
  const [difficultyFilter, setDifficultyFilter] = useState("All");
  const [activeTag, setActiveTag] = useState(null);
  const [previewProgram, setPreviewProgram] = useState(null);
  const [creatorProfiles, setCreatorProfiles] = useState({});

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!alive) return;
      setUser(u ?? null);

      const { data: progs, error: progErr } = await supabase
        .from("programs")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (!alive) return;
      const raw = progErr ? [] : (progs ?? []);
      setPrograms(raw);

      const creatorIds = [...new Set(raw.map((p) => p.creator_id).filter(Boolean))];
      if (creatorIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, display_name, username, handle, role")
          .in("id", creatorIds);
        if (alive && profs) {
          const map = {};
          profs.forEach((p) => {
            map[p.id] = p;
          });
          setCreatorProfiles(map);
        }
      }

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

  let filtered = uniquePrograms;
  const searchLower = search.trim().toLowerCase();
  if (searchLower) {
    filtered = filtered.filter((p) => (p.title || "").toLowerCase().includes(searchLower));
  }
  if (difficultyFilter !== "All") {
    filtered = filtered.filter(
      (p) => p.parsed_program?.meta?.difficulty === difficultyFilter
    );
  }
  if (activeTag) {
    filtered = filtered.filter((p) =>
      p.parsed_program?.meta?.tags?.includes(activeTag)
    );
  }

  const allTags = [
    ...new Set(uniquePrograms.flatMap((p) => p.parsed_program?.meta?.tags ?? [])),
  ].sort();

  const trending = [...uniquePrograms].sort(
    (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
  );
  const hookFocused = uniquePrograms.filter((p) =>
    p.parsed_program?.meta?.tags?.includes("Hook")
  );
  const strengthPrograms = uniquePrograms.filter((p) =>
    p.parsed_program?.meta?.tags?.includes("Strength")
  );
  const beginnerFriendly = uniquePrograms.filter(
    (p) => p.parsed_program?.meta?.difficulty === "Beginner"
  );

  const recommended = [...uniquePrograms]
    .filter((p) => !ownedIds.has(p.id))
    .sort((a, b) => {
      const aTags = a.parsed_program?.meta?.tags ?? [];
      const bTags = b.parsed_program?.meta?.tags ?? [];
      const aPri = (aTags.includes("Hook") ? 2 : 0) + (aTags.includes("Strength") ? 2 : 0);
      const bPri = (bTags.includes("Hook") ? 2 : 0) + (bTags.includes("Strength") ? 2 : 0);
      return bPri - aPri;
    });

  function renderCard(program) {
    const creatorProfile = program.creator_id ? creatorProfiles[program.creator_id] : null;
    return (
      <ProgramCard
        key={program.id}
        program={program}
        owned={ownedIds.has(program.id)}
        creatorProfile={creatorProfile}
        onPreviewClick={() => setPreviewProgram(program)}
      />
    );
  }

  function renderRow(title, items) {
    if (!items.length) return null;
    return (
      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>{title}</h3>
        <div className="horizontal-row">
          {items.map((p) => (
            <div key={p.id} style={styles.cardWrap}>
              {renderCard(p)}
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div style={styles.wrap}>
      <h1 style={styles.title}>Programs</h1>

      <div style={styles.headerRow}>
        <Link to="/programs/create" className="pill" style={styles.createLink}>
          + Create Program
        </Link>
        <button
          type="button"
          onClick={() => navigate("/programs/my")}
          style={styles.myProgramsBtn}
        >
          My Programs
        </button>
      </div>

      <input
        type="search"
        placeholder="Search by title…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={styles.search}
        aria-label="Search programs"
      />

      {!loading && (
        <>
          <div style={styles.filterRow}>
            {["All", "Beginner", "Intermediate", "Advanced", "Elite"].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficultyFilter(d)}
                className={difficultyFilter === d ? "pill active" : "pill"}
                style={{
                  ...styles.filterPill,
                  ...(difficultyFilter === d ? styles.filterPillActive : {}),
                }}
              >
                {d}
              </button>
            ))}
          </div>
          {allTags.length > 0 && (
            <div style={styles.tagRow}>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                  className={activeTag === tag ? "pill active" : "pill"}
                  style={{
                    ...styles.tagChip,
                    ...(activeTag === tag ? styles.tagChipActive : {}),
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {loading ? (
        <p style={styles.hint}>Loading…</p>
      ) : (
        <>
          {recommended.length > 0 && (
            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>Recommended For You</h3>
              <div className="horizontal-row">
                {recommended.slice(0, 12).map((p) => (
                  <div key={p.id} style={styles.cardWrap}>
                    {renderCard(p)}
                  </div>
                ))}
              </div>
            </section>
          )}

          {renderRow("🔥 Trending Programs", trending)}
          {renderRow("🔥 Hook Focused", hookFocused)}
          {renderRow("🔥 Strength Programs", strengthPrograms)}
          {renderRow("🔥 Beginner Friendly", beginnerFriendly)}

          {(filtered.length > 0 && (searchLower || difficultyFilter !== "All" || activeTag)) && (
            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>Filtered Results</h3>
              <div style={styles.grid}>
                {filtered.map((p) => renderCard(p))}
              </div>
            </section>
          )}

          {filtered.length === 0 && (
            <p style={styles.hint}>
              {uniquePrograms.length === 0
                ? "No programs in the marketplace yet."
                : "No programs match your search or filters."}
            </p>
          )}
        </>
      )}

      {previewProgram && (
        <ProgramPreviewModal
          program={previewProgram}
          owned={ownedIds.has(previewProgram.id)}
          onClose={() => setPreviewProgram(null)}
        />
      )}
    </div>
  );
}

const styles = {
  wrap: {
    padding: "16px 16px 90px",
    maxWidth: "900px",
    margin: "0 auto",
  },
  title: {
    fontSize: 22,
    fontWeight: 900,
    margin: "0 0 16px",
    color: "var(--text)",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
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
  myProgramsBtn: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "var(--card-2)",
    color: "var(--text)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  filterRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  filterPill: {
    padding: "8px 14px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "var(--card-2)",
    color: "var(--text)",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  filterPillActive: {
    background: "var(--accent)",
    borderColor: "var(--accent)",
  },
  tagRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  tagChip: {
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: "var(--text-dim)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  tagChipActive: {
    background: "var(--accent)",
    borderColor: "var(--accent)",
    color: "var(--text)",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 800,
    margin: "0 0 12px",
    color: "var(--text)",
  },
  cardWrap: {
    minWidth: 280,
    flexShrink: 0,
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
