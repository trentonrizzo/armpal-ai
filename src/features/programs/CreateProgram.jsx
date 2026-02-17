import React, { useState } from "react";
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
  const [saving, setSaving] = useState(false);

  async function handleConvertWithAI() {
    if (!rawContent.trim()) return;
    setLoadingAI(true);
    try {
      const res = await fetch("/api/parseProgram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawContent: rawContent.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Parse failed");
      setParsedProgram(data);
    } catch (e) {
      console.error(e);
      alert(e.message || "Failed to convert with AI");
    } finally {
      setLoadingAI(false);
    }
  }

  async function handleSaveProgram() {
    if (!title.trim()) {
      alert("Enter a title.");
      return;
    }
    if (!parsedProgram) {
      alert("Convert with AI first.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("programs").insert({
        title: title.trim(),
        preview_description: description.trim() || null,
        raw_content: rawContent.trim() || null,
        parsed_program: parsedProgram,
        is_ai_parsed: true,
      });
      if (error) throw error;
      navigate("/programs");
    } catch (e) {
      console.error(e);
      alert(e.message || "Failed to save program");
    } finally {
      setSaving(false);
    }
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

      <h1 style={styles.title}>Create Program</h1>

      <label style={styles.label}>Title</label>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Program name"
        style={styles.input}
      />

      <label style={styles.label}>Description (optional)</label>
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Short preview description"
        style={styles.input}
      />

      <label style={styles.label}>Raw program content</label>
      <textarea
        value={rawContent}
        onChange={(e) => setRawContent(e.target.value)}
        placeholder="Paste your training program text here…"
        style={styles.textarea}
        rows={8}
      />

      <div style={styles.actions}>
        <button
          type="button"
          onClick={handleConvertWithAI}
          disabled={loadingAI || !rawContent.trim()}
          style={styles.convertBtn}
        >
          {loadingAI ? "Converting…" : "Convert With AI ⚡"}
        </button>
        <button
          type="button"
          onClick={handleSaveProgram}
          disabled={saving || !parsedProgram}
          style={styles.saveBtn}
        >
          {saving ? "Saving…" : "Save Program"}
        </button>
      </div>

      {parsedProgram && (
        <section style={styles.previewSection}>
          <h2 style={styles.previewTitle}>Preview</h2>
          <ProgramViewer
            previewProgram={{
              title: title || "Preview",
              preview_description: description || null,
              parsed_program: parsedProgram,
            }}
          />
        </section>
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
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-dim)",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    marginBottom: 14,
    background: "var(--card-2)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    color: "var(--text)",
    fontSize: 14,
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    marginBottom: 14,
    background: "var(--card-2)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    color: "var(--text)",
    fontSize: 14,
    resize: "vertical",
    boxSizing: "border-box",
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
  },
  convertBtn: {
    padding: "12px 18px",
    borderRadius: 12,
    border: "none",
    background: "var(--accent)",
    color: "var(--text)",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  saveBtn: {
    padding: "12px 18px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--card-2)",
    color: "var(--text)",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  previewSection: {
    marginTop: 8,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: 700,
    margin: "0 0 12px",
    color: "var(--text)",
  },
};
