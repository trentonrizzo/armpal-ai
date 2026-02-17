import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";

export default function ProgramViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [program, setProgram] = useState(null);
  const [logic, setLogic] = useState(null);
  const [owned, setOwned] = useState(false);
  const [frequency, setFrequency] = useState(null);
  const [loading, setLoading] = useState(true);

  const frequencyRange = logic?.logic_json?.frequency_range;
  const hasFrequencyRange = Array.isArray(frequencyRange) && frequencyRange.length > 0;

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
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

      if (user?.id) {
        const { data: up } = await supabase
          .from("user_programs")
          .select("id")
          .eq("user_id", user.id)
          .eq("program_id", id)
          .maybeSingle();
        if (alive) setOwned(!!up);
      }

      const { data: logicRow, error: logicErr } = await supabase
        .from("program_logic")
        .select("logic_json")
        .eq("program_id", id)
        .maybeSingle();

      if (!alive) return;
      if (!logicErr && logicRow?.logic_json) {
        setLogic({ logic_json: logicRow.logic_json });
        const fr = logicRow.logic_json?.frequency_range;
        if (Array.isArray(fr) && fr.length > 0 && !frequency) {
          setFrequency(fr[0]);
        }
      } else {
        setLogic({ logic_json: {} });
      }
      setLoading(false);
    })();

    return () => { alive = false; };
  }, [id]);

  // When logic loads and we have frequency_range, set initial frequency if not set
  useEffect(() => {
    const fr = logic?.logic_json?.frequency_range;
    if (Array.isArray(fr) && fr.length > 0 && frequency === null) {
      setFrequency(fr[0]);
    }
  }, [logic, frequency]);

  if (loading) {
    return (
      <div style={styles.wrap}>
        <div style={styles.loading}>Loading program…</div>
      </div>
    );
  }

  if (!program || !owned) {
    return (
      <div style={styles.wrap}>
        <p style={styles.loading}>Program not found or you don’t have access.</p>
        <button type="button" onClick={() => navigate("/programs")} style={styles.backBtn}>
          Back to Programs
        </button>
      </div>
    );
  }

  const logicJson = logic?.logic_json ?? {};
  const fr = logicJson.frequency_range ?? [];
  const layout = getLayoutForFrequency(logicJson, frequency);

  return (
    <div style={styles.wrap}>
      <button
        type="button"
        onClick={() => navigate(`/programs/${id}`)}
        style={styles.backBtn}
        aria-label="Back to program"
      >
        ← Back
      </button>

      <h1 style={styles.title}>{program.title}</h1>

      {hasFrequencyRange && (
        <div style={styles.frequencyRow}>
          <span style={styles.frequencyLabel}>Days per week</span>
          <div style={styles.frequencyButtons}>
            {fr.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFrequency(f)}
                style={{
                  ...styles.freqBtn,
                  ...(frequency === f ? styles.freqBtnActive : {}),
                }}
              >
                {f}×
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={styles.layout}>
        {layout}
      </div>
    </div>
  );
}

function getLayoutForFrequency(logicJson, frequency) {
  const layouts = logicJson.layouts;
  const weeks = logicJson.weeks ?? 1;
  const phases = logicJson.phases ?? [];

  if (layouts && typeof layouts[frequency] !== "undefined") {
    const block = layouts[frequency];
    if (typeof block === "string") {
      return <p style={styles.layoutText}>{block}</p>;
    }
    if (Array.isArray(block)) {
      return (
        <ul style={styles.layoutList}>
          {block.map((item, i) => (
            <li key={i} style={styles.layoutItem}>{String(item)}</li>
          ))}
        </ul>
      );
    }
    if (block && typeof block === "object" && block.summary) {
      return <p style={styles.layoutText}>{block.summary}</p>;
    }
  }

  if (phases.length > 0) {
    return (
      <div style={styles.phaseBlock}>
        <div style={styles.phaseLabel}>
          {frequency != null ? `${frequency}×/week` : ""} · {weeks} week(s)
        </div>
        {phases.map((phase, i) => (
          <div key={i} style={styles.phaseCard}>
            <strong>{phase.name ?? `Phase ${i + 1}`}</strong>
            {phase.description ? <p style={styles.phaseDesc}>{phase.description}</p> : null}
          </div>
        ))}
      </div>
    );
  }

  return (
    <p style={styles.layoutText}>
      No layout defined for {frequency != null ? `${frequency}×/week` : "this frequency"}.
      Add layout data in program_logic.logic_json.
    </p>
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
  title: {
    fontSize: 20,
    fontWeight: 800,
    margin: "0 0 16px",
    color: "var(--text)",
  },
  frequencyRow: {
    marginBottom: 20,
  },
  frequencyLabel: {
    display: "block",
    fontSize: 12,
    color: "var(--text-dim)",
    marginBottom: 8,
  },
  frequencyButtons: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  freqBtn: {
    padding: "10px 16px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--card-2)",
    color: "var(--text)",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  freqBtnActive: {
    background: "var(--accent)",
    borderColor: "var(--accent)",
  },
  layout: {
    background: "var(--card-2)",
    borderRadius: 14,
    border: "1px solid var(--border)",
    padding: 16,
  },
  layoutText: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.5,
    color: "var(--text-dim)",
  },
  layoutList: {
    margin: 0,
    paddingLeft: 20,
  },
  layoutItem: {
    marginBottom: 6,
    fontSize: 14,
    color: "var(--text-dim)",
  },
  phaseBlock: {},
  phaseLabel: {
    fontSize: 12,
    color: "var(--text-dim)",
    marginBottom: 12,
  },
  phaseCard: {
    padding: 12,
    borderRadius: 10,
    border: "1px solid var(--border)",
    marginBottom: 10,
    background: "var(--card)",
  },
  phaseDesc: {
    margin: "6px 0 0",
    fontSize: 13,
    color: "var(--text-dim)",
  },
};
