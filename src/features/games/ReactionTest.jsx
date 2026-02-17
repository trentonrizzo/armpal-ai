import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";

export default function ReactionTest({ game }) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState("idle");
  const [reaction, setReaction] = useState(null);
  const [saving, setSaving] = useState(false);
  const readyAtRef = React.useRef(null);

  const startRound = useCallback(() => {
    setPhase("red");
    setReaction(null);
  }, []);

  React.useEffect(() => {
    if (phase !== "red") return;
    const delay = 1000 + Math.random() * 2000;
    const t = setTimeout(() => {
      readyAtRef.current = performance.now();
      setPhase("green");
    }, delay);
    return () => clearTimeout(t);
  }, [phase]);

  async function handleClick() {
    if (phase === "green" && readyAtRef.current != null) {
      const reactionMs = Math.round(performance.now() - readyAtRef.current);
      setReaction(reactionMs);
      setPhase("result");
      setSaving(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          await supabase.from("user_game_scores").insert({
            user_id: user.id,
            game_id: game.id,
            score: reactionMs,
          });
        }
      } catch (e) {
        console.error("Save score failed", e);
      }
      setSaving(false);
    }
  }

  return (
    <div style={styles.wrap}>
      <button
        type="button"
        onClick={() => navigate("/games")}
        style={styles.backBtn}
      >
        ← Games
      </button>
      <h2 style={styles.title}>{game?.title ?? "Reaction Test"}</h2>

      {phase === "idle" && (
        <div style={styles.section}>
          <p style={styles.instruction}>
            Screen will turn red, then green after 1–3 seconds. Click as soon as it turns green.
          </p>
          <button type="button" onClick={startRound} style={styles.primaryBtn}>
            Start
          </button>
        </div>
      )}

      {(phase === "red" || phase === "green") && (
        <button
          type="button"
          onClick={handleClick}
          style={{
            ...styles.screen,
            background: phase === "red" ? "#c00" : "#0a0",
            cursor: phase === "green" ? "pointer" : "default",
          }}
        >
          {phase === "red" ? "Wait…" : "CLICK NOW"}
        </button>
      )}

      {phase === "result" && (
        <div style={styles.section}>
          <p style={styles.resultLabel}>Reaction time</p>
          <p style={styles.resultValue}>{reaction} ms</p>
          {saving && <p style={styles.hint}>Saving score…</p>}
          <button type="button" onClick={startRound} style={styles.primaryBtn}>
            Play again
          </button>
          <button type="button" onClick={() => navigate("/games")} style={styles.secondaryBtn}>
            Back to Games
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: {
    padding: "16px 16px 90px",
    maxWidth: "400px",
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
    margin: "0 0 24px",
    color: "var(--text)",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
  },
  instruction: {
    color: "var(--text-dim)",
    fontSize: 14,
    textAlign: "center",
    margin: 0,
  },
  primaryBtn: {
    padding: "14px 28px",
    borderRadius: 12,
    border: "none",
    background: "var(--accent)",
    color: "var(--text)",
    fontWeight: 700,
    fontSize: 16,
    cursor: "pointer",
  },
  screen: {
    display: "block",
    width: "100%",
    minHeight: 220,
    borderRadius: 14,
    border: "none",
    color: "#fff",
    fontSize: 18,
    fontWeight: 800,
  },
  resultLabel: {
    margin: 0,
    fontSize: 14,
    color: "var(--text-dim)",
  },
  resultValue: {
    margin: "4px 0 0",
    fontSize: 28,
    fontWeight: 800,
    color: "var(--text)",
  },
  hint: {
    margin: 0,
    fontSize: 12,
    color: "var(--text-dim)",
  },
  secondaryBtn: {
    padding: "12px 20px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text)",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
};
