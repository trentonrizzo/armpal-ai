import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";

function buildDetailStr(ex) {
  const parts = [];
  if (ex.sets) parts.push(`${ex.sets} sets`);
  if (ex.reps) parts.push(`${ex.reps} reps`);
  if (ex.percentage) parts.push(ex.percentage);
  if (ex.rpe) parts.push(`RPE ${ex.rpe}`);
  if (ex.tempo) parts.push(`Tempo: ${ex.tempo}`);
  if (ex.notes) parts.push(ex.notes);
  return parts.join(" · ");
}

export default function CreateProgram() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rawContent, setRawContent] = useState("");
  const [convertedProgram, setConvertedProgram] = useState(null);
  const [convertError, setConvertError] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [priceInput, setPriceInput] = useState("15.99");
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.id) setUserId(user.id);
    });
  }, []);

  async function convertAI() {
    try {
      setIsConverting(true);
      setConvertError("");
      setConvertedProgram(null);

      const res = await fetch(`${window.location.origin}/api/ai/workout-converter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_text: rawContent,
          start_date: null,
          training_days: null,
          max_cards: 100,
          userId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || data?.message || "Convert failed");

      const workouts = data?.workouts;
      if (!Array.isArray(workouts) || workouts.length === 0) {
        setConvertError("No workouts detected. Try rephrasing your program.");
        return;
      }

      const days = workouts.map((w, i) => ({
        name: w.title || w.day_label || `Day ${i + 1}`,
        week_number: w.week_number || null,
        exercises: Array.isArray(w.exercises)
          ? w.exercises.map((ex) => ({
              name: ex.name || "Exercise",
              sets: ex.sets || null,
              reps: ex.reps || null,
              percentage: ex.percentage || null,
              rpe: ex.rpe || null,
              tempo: ex.tempo || null,
              notes: ex.notes || null,
            }))
          : [],
      }));

      setConvertedProgram({ days });
    } catch (e) {
      console.error(e);
      setConvertError(e.message || "Conversion failed");
    } finally {
      setIsConverting(false);
    }
  }

  function handlePriceChange(e) {
    let val = e.target.value;
    if (val === "") { setPriceInput(""); return; }
    if (!/^\d*\.?\d*$/.test(val)) return;
    const parts = val.split(".");
    parts[0] = parts[0].replace(/^0+(?=\d)/, "0");
    if (parts[0].length > 1 && parts[0].startsWith("0")) {
      parts[0] = parts[0].replace(/^0+/, "0");
    }
    setPriceInput(parts.join("."));
  }

  async function saveProgram() {
    if (!title.trim()) { alert("Enter a title."); return; }
    if (!convertedProgram || !Array.isArray(convertedProgram.days) || convertedProgram.days.length === 0) {
      alert("Convert with AI first."); return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) { alert("Sign in to save."); return; }

    const price = Number(priceInput) || 0;

    try {
      const { error: insErr } = await supabase.from("programs").insert({
        title,
        preview_description: description || null,
        parsed_program: convertedProgram,
        is_ai_parsed: true,
        price,
        creator_id: uid,
      });
      if (insErr) throw insErr;
      alert("Program created");
      navigate("/programs");
    } catch (e) {
      console.error(e);
      alert(e.message || "Save failed");
    }
  }

  const weeks = {};
  if (convertedProgram?.days) {
    convertedProgram.days.forEach((d) => {
      const wk = d.week_number || 0;
      if (!weeks[wk]) weeks[wk] = [];
      weeks[wk].push(d);
    });
  }

  return (
    <div style={{ padding: "16px 16px 90px", maxWidth: 560, margin: "0 auto" }}>
      <button type="button" onClick={() => navigate("/programs")} style={S.backBtn}>
        ← Programs
      </button>

      <h2 style={S.heading}>Create Program</h2>

      <input
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={S.input}
      />
      <input
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={S.input}
      />
      <input
        inputMode="decimal"
        value={priceInput}
        onChange={handlePriceChange}
        placeholder="Price"
        style={S.input}
      />

      {(() => {
        const platformFeePercent = 0.20;
        const stripePercent = 0.029;
        const stripeFixed = 0.30;
        const p = Number(priceInput) || 0;
        const stripeFee = p * stripePercent + stripeFixed;
        const platformFee = p * platformFeePercent;
        const creatorEarnings = p - stripeFee - platformFee;
        return (
          <div style={S.earningsBox}>
            <p style={{ margin: "0 0 6px", color: "var(--text)" }}>You set price: ${p.toFixed(2)}</p>
            <p style={{ margin: "0 0 6px", color: "var(--text-dim)" }}>ArmPal fee (20%): ${platformFee.toFixed(2)}</p>
            <p style={{ margin: "0 0 6px", color: "var(--text-dim)" }}>Stripe fee (est): ${stripeFee.toFixed(2)}</p>
            <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "10px 0" }} />
            <p style={{ margin: 0, color: "var(--text)" }}><strong>You earn ≈ ${creatorEarnings.toFixed(2)} per sale</strong></p>
          </div>
        );
      })()}

      <textarea
        placeholder={"Paste program here...\n\nSupports: rep ranges (8-12), percentages (80%), RPE, AMRAP, supersets, tempo, notes, multi-week layouts"}
        value={rawContent}
        onChange={(e) => setRawContent(e.target.value)}
        style={S.textarea}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <button
          type="button"
          onClick={convertAI}
          disabled={isConverting || !rawContent.trim()}
          style={{ ...S.primaryBtn, opacity: isConverting || !rawContent.trim() ? 0.6 : 1 }}
        >
          {isConverting ? "Converting..." : "Convert With AI ⚡"}
        </button>
        <button
          type="button"
          onClick={saveProgram}
          disabled={!convertedProgram}
          style={{ ...S.secondaryBtn, opacity: !convertedProgram ? 0.5 : 1 }}
        >
          Save Program
        </button>
      </div>

      {convertError && (
        <p style={{ margin: "0 0 12px", color: "var(--danger, #f55)", fontSize: 13 }}>
          {convertError}
        </p>
      )}

      {convertedProgram && convertedProgram.days.length > 0 && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px", color: "var(--text)" }}>
            Live Preview — {convertedProgram.days.length} workout{convertedProgram.days.length !== 1 ? "s" : ""}
          </h3>

          {Object.entries(weeks).map(([wk, days]) => (
            <div key={wk} style={{ marginBottom: 20 }}>
              {wk !== "0" && (
                <div style={S.weekLabel}>Week {wk}</div>
              )}
              {days.map((day, idx) => (
                <div key={idx} style={S.dayCard}>
                  <h4 style={S.dayTitle}>{day.name}</h4>
                  {day.exercises.length > 0 ? (
                    day.exercises.map((ex, i) => {
                      const detail = buildDetailStr(ex);
                      const isSuperset = /superset/i.test(ex.notes || "") || /superset/i.test(ex.name || "");
                      return (
                        <div key={i} style={{ ...S.exRow, ...(isSuperset ? S.supersetRow : {}) }}>
                          <div style={S.exName}>{ex.name}</div>
                          {detail && <div style={S.exDetail}>{detail}</div>}
                        </div>
                      );
                    })
                  ) : (
                    <p style={{ fontSize: 13, color: "var(--text-dim)", margin: 0 }}>No exercises listed.</p>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const S = {
  backBtn: { marginBottom: 16, background: "none", border: "none", color: "var(--text-dim)", fontSize: 14, cursor: "pointer" },
  heading: { fontSize: 20, fontWeight: 800, margin: "0 0 16px", color: "var(--text)" },
  input: { width: "100%", padding: 10, marginBottom: 12, background: "var(--card-2)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 14, boxSizing: "border-box" },
  textarea: { width: "100%", padding: 10, marginBottom: 12, minHeight: 140, background: "var(--card-2)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 14, boxSizing: "border-box", resize: "vertical" },
  earningsBox: { marginBottom: 24, padding: 14, background: "var(--card-2)", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14 },
  primaryBtn: { padding: "12px 18px", borderRadius: 12, border: "none", background: "var(--accent)", color: "var(--text)", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  secondaryBtn: { padding: "12px 18px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--card-2)", color: "var(--text)", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  weekLabel: { fontSize: 14, fontWeight: 800, color: "var(--accent)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  dayCard: { marginBottom: 12, padding: 14, borderRadius: 14, border: "1px solid var(--border)", background: "var(--card-2)" },
  dayTitle: { margin: "0 0 8px", fontSize: 15, fontWeight: 700, color: "var(--text)" },
  exRow: { marginBottom: 6, paddingLeft: 8, borderLeft: "2px solid var(--border)" },
  supersetRow: { borderLeftColor: "var(--accent)", background: "color-mix(in srgb, var(--accent) 6%, transparent)", borderRadius: 6, padding: "4px 8px", marginLeft: 0 },
  exName: { fontSize: 14, fontWeight: 600, color: "var(--text)" },
  exDetail: { fontSize: 12, color: "var(--text-dim)", marginTop: 2 },
};
