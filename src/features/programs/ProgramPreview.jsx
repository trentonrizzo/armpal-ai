import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import ProgramCard from "./ProgramCard";
import ReportModal from "../../components/reports/ReportModal";

export default function ProgramPreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [program, setProgram] = useState(null);
  const [owned, setOwned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [user, setUser] = useState(null);
  const [creatorProfile, setCreatorProfile] = useState(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!alive) return;
      setUser(u ?? null);

      if (!id) {
        setLoading(false);
        return;
      }

      const { data: prog, error: progErr } = await supabase
        .from("programs")
        .select("*")
        .eq("id", id)
        .single();

      if (!alive) return;
      if (progErr || !prog) {
        setProgram(null);
        setLoading(false);
        return;
      }
      setProgram(prog);

      if (prog.creator_id) {
        const { data: creator } = await supabase
          .from("profiles")
          .select("id, display_name, username, handle, role")
          .eq("id", prog.creator_id)
          .maybeSingle();
        if (alive) setCreatorProfile(creator || null);
      }

      if (u?.id) {
        const { data: up } = await supabase
          .from("user_programs")
          .select("id")
          .eq("user_id", u.id)
          .eq("program_id", id)
          .maybeSingle();
        if (alive) setOwned(!!up);
      } else {
        setOwned(false);
      }
      setLoading(false);
    })();

    return () => { alive = false; };
  }, [id]);

  async function handleBuy() {
    if (!user?.id || !program?.id || buying) return;
    setBuying(true);
    const { error } = await supabase
      .from("user_programs")
      .insert({ user_id: user.id, program_id: program.id });
    setBuying(false);
    if (error) {
      if (error.code === "23505") setOwned(true);
      else alert(error.message || "Could not add program.");
      return;
    }
    setOwned(true);
  }

  async function handleRemoveFromMarketplace() {
    if (!user?.id || !program?.id || program.creator_id !== user.id || deleting) return;
    if (!window.confirm("Remove this program from the marketplace?")) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("programs")
        .delete()
        .eq("id", program.id);
      if (error) {
        console.error("[ProgramPreview] Delete program failed (falling back to unpublish):", error?.message ?? error, error);
        const { error: upErr } = await supabase
          .from("programs")
          .update({ is_published: false })
          .eq("id", program.id);
        if (upErr) {
          console.error("[ProgramPreview] Unpublish failed:", upErr?.message ?? upErr, upErr);
          alert(upErr?.message || "Could not unpublish program.");
          setDeleting(false);
          return;
        }
        alert("Program unpublished (removed from marketplace).");
        navigate("/programs");
        setDeleting(false);
        return;
      }
      alert("Program deleted.");
      navigate("/programs");
    } catch (e) {
      console.error("[ProgramPreview] handleRemoveFromMarketplace error:", e?.message ?? e, e);
      alert(e?.message || "Something went wrong.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div style={styles.wrap}>
        <div style={styles.loading}>Loading…</div>
      </div>
    );
  }

  if (!program) {
    return (
      <div style={styles.wrap}>
        <p style={styles.loading}>Program not found.</p>
        <button type="button" onClick={() => navigate("/programs")} style={styles.backBtn}>
          Back to Programs
        </button>
      </div>
    );
  }

  const isCreator = user?.id && program?.creator_id === user.id;

  return (
    <div style={styles.wrap}>
      <button
        type="button"
        onClick={() => navigate("/programs")}
        style={styles.backBtn}
        aria-label="Back to programs"
      >
        ← Back
      </button>

      <ProgramCard program={program} owned={owned} creatorProfile={creatorProfile} />

      <div style={styles.previewSection}>
        <h2 style={styles.previewTitle}>Preview</h2>
        <p style={styles.previewDesc}>
          {program.preview_description || "No description yet."}
        </p>
      </div>

      {owned ? (
        <button
          type="button"
          onClick={() => navigate(`/programs/${program.id}/view`)}
          style={styles.openBtn}
        >
          Open Program
        </button>
      ) : (
        <button
          type="button"
          onClick={handleBuy}
          disabled={!user || buying}
          style={styles.buyBtn}
        >
          {!user ? "Sign in to get this program" : buying ? "Adding…" : "Get this program"}
        </button>
      )}

      {isCreator && (
        <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end", position: "relative" }}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            disabled={deleting}
            style={styles.menuBtn}
            aria-label="Program options"
          >
            ⋯
          </button>
          {menuOpen && (
            <div style={styles.menuPopover} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                style={styles.menuItem}
                onClick={() => {
                  setMenuOpen(false);
                  handleRemoveFromMarketplace();
                }}
              >
                {deleting ? "Working…" : "Delete / Unpublish"}
              </button>
              <button
                type="button"
                style={styles.menuItem}
                onClick={() => {
                  setMenuOpen(false);
                  setShowReport(true);
                }}
              >
                Report
              </button>
            </div>
          )}
        </div>
      )}

      <ReportModal
        open={showReport}
        onClose={() => setShowReport(false)}
        targetType="program"
        targetId={program?.id}
        targetLabel={program?.title || "Program"}
      />
    </div>
  );
}

const styles = {
  wrap: {
    padding: "16px 16px 90px",
    maxWidth: "560px",
    margin: "0 auto",
  },
  loading: {
    color: "var(--text-dim)",
    fontSize: 14,
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
  previewSection: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    background: "var(--card-2)",
    border: "1px solid var(--border)",
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: 700,
    margin: "0 0 8px",
    color: "var(--text)",
  },
  previewDesc: {
    fontSize: 13,
    lineHeight: 1.4,
    color: "var(--text-dim)",
    margin: 0,
  },
  buyBtn: {
    marginTop: 16,
    width: "100%",
    padding: 14,
    borderRadius: 12,
    border: "none",
    background: "var(--accent)",
    color: "var(--text)",
    fontWeight: 800,
    fontSize: 15,
    cursor: "pointer",
  },
  openBtn: {
    marginTop: 16,
    width: "100%",
    padding: 14,
    borderRadius: 12,
    border: "1px solid var(--accent)",
    background: "var(--card)",
    color: "var(--text)",
    fontWeight: 800,
    fontSize: 15,
    cursor: "pointer",
  },
  menuBtn: {
    padding: 8,
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "var(--card-2)",
    color: "var(--text)",
    fontSize: 16,
    lineHeight: 1,
    cursor: "pointer",
  },
  menuPopover: {
    position: "absolute",
    top: 44,
    right: 0,
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--card)",
    overflow: "hidden",
    minWidth: 180,
    boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
    zIndex: 10,
  },
  menuItem: {
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    border: "none",
    background: "transparent",
    color: "var(--text)",
    fontWeight: 800,
    cursor: "pointer",
  },
};
