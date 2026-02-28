import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import { getDisplayText } from "../../utils/displayText";

function workoutsToProgramModel(workouts) {
  // Flatten workouts into weeks/days; if no explicit week/day info,
  // map sequentially.
  const weeks = [];
  let currentWeek = { weekNumber: 1, days: [] };
  workouts.forEach((w, index) => {
    const day = {
      dayNumber: index + 1,
      title: w.title || w.day_label || `Day ${index + 1}`,
      workout_card: {
        title: w.title || w.day_label || `Day ${index + 1}`,
        exercises: Array.isArray(w.exercises) ? w.exercises.map((ex) => ({ ...ex })) : [],
      },
    };
    currentWeek.days.push(day);
  });
  if (currentWeek.days.length) weeks.push(currentWeek);
  return { weeks };
}

export default function CreateProgram() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rawContent, setRawContent] = useState("");
  const [programModel, setProgramModel] = useState(null);
  const [convertError, setConvertError] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [priceInput, setPriceInput] = useState("15.99");
  const [userId, setUserId] = useState(null);
  const [difficulty, setDifficulty] = useState("Intermediate");
  const [saving, setSaving] = useState(false);
  const LEVELS = ["Beginner", "Intermediate", "Advanced", "Elite"];

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.id) setUserId(user.id);
    });
  }, []);

  async function convertAI() {
    try {
      setIsConverting(true);
      setConvertError("");
      setProgramModel(null);

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
      const model = workoutsToProgramModel(workouts);
      setProgramModel(model);
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

  async function saveProgram(asPublish = false) {
    if (!title.trim()) { alert("Enter a title."); return; }
    if (!programModel || !Array.isArray(programModel.weeks) || programModel.weeks.length === 0) {
      alert("Convert with AI first."); return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) { alert("Sign in to save."); return; }

    const price = Number(priceInput) || 0;
    const programJsonWithMeta = {
      ...programModel,
      meta: { difficulty, tags: programModel.meta?.tags ?? [] },
    };

    setSaving(true);
    try {
      const { data: inserted, error: insErr } = await supabase.from("programs").insert({
        title,
        preview_description: description || null,
        parsed_program: null,
        program_json: programJsonWithMeta,
        is_ai_parsed: true,
        price,
        creator_id: uid,
        is_published: asPublish === true,
      }).select("*").single();
      if (insErr) throw insErr;
      window.dispatchEvent(new CustomEvent("ap_toast", {
        detail: {
          title: asPublish ? "Program published" : "Draft saved",
          body: "View in My Programs",
          action: { label: "Open", href: "/programs/my" },
        },
      }));
      navigate("/programs/my");
    } catch (e) {
      console.error("[CreateProgram] Save failed:", e?.message ?? e, e);
      alert(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const weeks = programModel?.weeks ?? [];

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
      <div style={S.levelRow}>
        <span style={S.levelLabel}>Level</span>
        <div style={S.levelOptions}>
          {LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setDifficulty(l)}
              style={{ ...S.levelBtn, ...(difficulty === l ? S.levelBtnActive : {}) }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
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
          {isConverting ? "Converting…" : "Convert With AI ⚡"}
        </button>
        <button
          type="button"
          onClick={() => saveProgram(false)}
          disabled={!programModel?.weeks?.length || saving}
          style={{ ...S.secondaryBtn, opacity: !programModel?.weeks?.length ? 0.5 : 1 }}
        >
          {saving ? "Saving…" : "Save Draft"}
        </button>
        <button
          type="button"
          onClick={() => saveProgram(true)}
          disabled={!programModel?.weeks?.length || saving}
          style={{ ...S.primaryBtn, opacity: !programModel?.weeks?.length ? 0.5 : 1 }}
        >
          {saving ? "Saving…" : "Publish"}
        </button>
      </div>

      {isConverting && (
        <div style={S.convertingOverlay}>
          <div style={S.convertingBox}>
            <p style={S.convertingText}>Converting…</p>
            <p style={S.convertingSub}>AI is structuring your program</p>
          </div>
        </div>
      )}

      {convertError && (
        <p style={{ margin: "0 0 12px", color: "var(--danger, #f55)", fontSize: 13 }}>
          {convertError}
        </p>
      )}

      {programModel && weeks.length > 0 && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px", color: "var(--text)" }}>
            Live Preview — {weeks.reduce((acc, w) => acc + w.days.length, 0)} workout day(s)
          </h3>

          {weeks.map((week) => (
            <div key={week.weekNumber} style={{ marginBottom: 20 }}>
              <div style={S.weekLabel}>Week {week.weekNumber}</div>
              {week.days.map((day, idx) => (
                <div key={idx} style={S.dayCard}>
                  <h4 style={S.dayTitle}>{day.title}</h4>
                  {Array.isArray(day.workout_card?.exercises) && day.workout_card.exercises.length > 0 ? (
                    day.workout_card.exercises.map((ex, i) => (
                      <div key={i} style={S.exRow}>
                        <div style={S.exName}>{getDisplayText(ex)}</div>
                      </div>
                    ))
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
  levelRow: { marginBottom: 16 },
  levelLabel: { display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-dim)", marginBottom: 8 },
  levelOptions: { display: "flex", flexWrap: "wrap", gap: 8 },
  levelBtn: { padding: "8px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--card-2)", color: "var(--text)", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  levelBtnActive: { background: "var(--accent)", borderColor: "var(--accent)" },
  convertingOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 },
  convertingBox: { background: "var(--card)", borderRadius: 16, padding: 24, border: "1px solid var(--border)", textAlign: "center", minWidth: 200 },
  convertingText: { margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "var(--text)" },
  convertingSub: { margin: 0, fontSize: 13, color: "var(--text-dim)" },
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
