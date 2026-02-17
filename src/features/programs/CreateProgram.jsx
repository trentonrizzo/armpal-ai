import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import ProgramViewer from "./ProgramViewer";

export default function CreateProgram() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rawContent, setRawContent] = useState("");
  const [parsedProgram, setParsedProgram] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [price, setPrice] = useState(15.99);

  async function convertAI() {
    setLoadingAI(true);
    try {
      const res = await fetch("/api/parseProgram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Convert failed");
      setParsedProgram(data);
    } catch (e) {
      console.error(e);
      alert(e.message || "Convert failed");
    } finally {
      setLoadingAI(false);
    }
  }

  async function saveProgram() {
    if (!title.trim()) {
      alert("Enter a title.");
      return;
    }
    if (!parsedProgram) {
      alert("Convert with AI first.");
      return;
    }
    try {
      await supabase.from("programs").insert({
        title,
        preview_description: description || null,
        raw_content: rawContent || null,
        parsed_program: parsedProgram,
        is_ai_parsed: true,
        price,
      });
      alert("Program created");
      navigate("/programs");
    } catch (e) {
      console.error(e);
      alert(e.message || "Save failed");
    }
  }

  return (
    <div style={{ padding: "16px 16px 90px", maxWidth: 560, margin: "0 auto" }}>
      <button type="button" onClick={() => navigate("/programs")} style={{ marginBottom: 16, background: "none", border: "none", color: "var(--text-dim)", fontSize: 14, cursor: "pointer" }}>
        ← Programs
      </button>

      <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 16px", color: "var(--text)" }}>Create Program</h2>

      <input
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 12, background: "var(--card-2)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 14, boxSizing: "border-box" }}
      />

      <input
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 12, background: "var(--card-2)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 14, boxSizing: "border-box" }}
      />

      <input
        type="number"
        step="0.01"
        value={price}
        onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
        placeholder="Price"
        style={{ width: "100%", padding: 10, marginBottom: 12, background: "var(--card-2)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 14, boxSizing: "border-box" }}
      />

      {(() => {
        const platformFeePercent = 0.20;
        const stripePercent = 0.029;
        const stripeFixed = 0.30;
        const p = Number(price) || 0;
        const stripeFee = p * stripePercent + stripeFixed;
        const platformFee = p * platformFeePercent;
        const creatorEarnings = p - stripeFee - platformFee;
        return (
          <div style={{ marginBottom: 24, padding: 14, background: "var(--card-2)", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14 }}>
            <p style={{ margin: "0 0 6px", color: "var(--text)" }}>You set price: ${p.toFixed(2)}</p>
            <p style={{ margin: "0 0 6px", color: "var(--text-dim)" }}>ArmPal fee (20%): ${platformFee.toFixed(2)}</p>
            <p style={{ margin: "0 0 6px", color: "var(--text-dim)" }}>Stripe fee (est): ${stripeFee.toFixed(2)}</p>
            <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "10px 0" }} />
            <p style={{ margin: 0, color: "var(--text)" }}><strong>You earn ≈ ${creatorEarnings.toFixed(2)} per sale</strong></p>
          </div>
        );
      })()}

      <textarea
        placeholder="Paste program here..."
        value={rawContent}
        onChange={(e) => setRawContent(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 12, minHeight: 120, background: "var(--card-2)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 14, boxSizing: "border-box", resize: "vertical" }}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
        <button onClick={convertAI} disabled={loadingAI || !rawContent.trim()} style={{ padding: "12px 18px", borderRadius: 12, border: "none", background: "var(--accent)", color: "var(--text)", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          {loadingAI ? "Converting..." : "Convert With AI ⚡"}
        </button>
        <button onClick={saveProgram} disabled={!parsedProgram} style={{ padding: "12px 18px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--card-2)", color: "var(--text)", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          Save Program
        </button>
      </div>

      {parsedProgram && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px", color: "var(--text)" }}>Live Preview</h3>
          <ProgramViewer program={{ title: title || "Preview", parsed_program: parsedProgram }} />
        </div>
      )}
    </div>
  );
}
