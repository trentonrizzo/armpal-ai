import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import ProgramCard from "./ProgramCard";

export default function MyPrograms() {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [confirmConfig, setConfirmConfig] = useState(null);

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

      const { data: progs, error: progErr } = await supabase
        .from("programs")
        .select("*")
        .eq("creator_id", u.id)
        .eq("deleted", false)
        .order("created_at", { ascending: false });

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

  const drafts = programs.filter((p) => p.is_draft === true);
  const published = programs.filter((p) => p.is_published === true && p.deleted === false);

  async function handleUpdateProgram(id, patch) {
    const { error } = await supabase
      .from("programs")
      .update(patch)
      .eq("id", id);
    if (error) {
      console.error("[MyPrograms] update failed", error);
      return;
    }
    setPrograms((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function openConfirm(config) {
    setConfirmConfig(config);
  }

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
        <>
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Drafts</h2>
            {drafts.length === 0 ? (
              <p style={styles.hint}>No drafts yet.</p>
            ) : (
              <div style={styles.grid}>
                {drafts.map((program) => (
                  <div key={program.id} style={styles.programRow}>
                    <ProgramCard program={program} owned />
                    <div style={styles.actionsRow}>
                      <button
                        type="button"
                        style={styles.smallBtn}
                        onClick={() =>
                          navigate("/programs/create", { state: { programId: program.id } })
                        }
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        style={styles.smallPrimaryBtn}
                        onClick={() =>
                          openConfirm({
                            title: "Publish program?",
                            message: "Publish this program to the marketplace.",
                            onConfirm: () => {
                              handleUpdateProgram(program.id, {
                                is_published: true,
                                is_draft: false,
                                deleted: false,
                              });
                              setConfirmConfig(null);
                            },
                          })
                        }
                      >
                        Publish
                      </button>
                      <button
                        type="button"
                        style={styles.smallDangerBtn}
                        onClick={() =>
                          openConfirm({
                            title: "Delete program?",
                            message: "This program will be deleted.",
                            onConfirm: () => {
                              handleUpdateProgram(program.id, { deleted: true });
                              setConfirmConfig(null);
                            },
                          })
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Published</h2>
            {published.length === 0 ? (
              <p style={styles.hint}>No published programs yet.</p>
            ) : (
              <div style={styles.grid}>
                {published.map((program) => (
                  <div key={program.id} style={styles.programRow}>
                    <ProgramCard program={program} owned />
                    <div style={styles.actionsRow}>
                      <button
                        type="button"
                        style={styles.smallBtn}
                        onClick={() =>
                          navigate("/programs/create", { state: { programId: program.id } })
                        }
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        style={styles.smallBtn}
                        onClick={() =>
                          openConfirm({
                            title: "Unpublish program?",
                            message: "Unpublish this program from the marketplace.",
                            onConfirm: () => {
                              handleUpdateProgram(program.id, {
                                is_published: false,
                                is_draft: true,
                              });
                              setConfirmConfig(null);
                            },
                          })
                        }
                      >
                        Unpublish
                      </button>
                      <button
                        type="button"
                        style={styles.smallDangerBtn}
                        onClick={() =>
                          openConfirm({
                            title: "Delete program?",
                            message: "This program will be deleted.",
                            onConfirm: () => {
                              handleUpdateProgram(program.id, { deleted: true });
                              setConfirmConfig(null);
                            },
                          })
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <button
        type="button"
        onClick={() => navigate("/programs")}
        style={styles.marketBtn}
      >
        Browse marketplace
      </button>

      {confirmConfig && (
        <div style={styles.modalBackdrop} onClick={() => setConfirmConfig(null)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>{confirmConfig.title}</h3>
            <p style={styles.modalBody}>{confirmConfig.message}</p>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                type="button"
                style={styles.smallBtn}
                onClick={() => setConfirmConfig(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                style={styles.smallPrimaryBtn}
                onClick={() => {
                  confirmConfig.onConfirm?.();
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
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
  section: {
    marginTop: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 800,
    margin: "0 0 8px",
    color: "var(--text)",
  },
  programRow: {
    borderRadius: 14,
    border: "1px solid var(--border)",
    background: "var(--card-2)",
    padding: 10,
  },
  actionsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
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
  smallBtn: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "var(--card-2)",
    color: "var(--text)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  smallPrimaryBtn: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "none",
    background: "var(--accent)",
    color: "var(--text)",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  smallDangerBtn: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid var(--accent)",
    background: "transparent",
    color: "var(--accent)",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 10001,
  },
  modalCard: {
    background: "var(--card-2)",
    borderRadius: 16,
    border: "1px solid var(--border)",
    padding: 20,
    maxWidth: 360,
    width: "100%",
    boxShadow: "0 18px 40px rgba(0,0,0,0.6)",
  },
  modalTitle: {
    margin: "0 0 8px",
    fontSize: 16,
    fontWeight: 800,
    color: "var(--text)",
  },
  modalBody: {
    margin: "0 0 14px",
    fontSize: 13,
    color: "var(--text-dim)",
  },
};
