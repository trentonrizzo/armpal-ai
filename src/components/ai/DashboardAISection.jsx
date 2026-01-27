import { useEffect, useMemo, useState } from "react";
import VulgarDisclaimerOverlay from "./VulgarDisclaimerOverlay";

/**
 * DashboardAISection (FINAL MODES)
 * - All personalities: Savage, Coach, Motivation, Recovery, Science, Vulgar/Unhinged
 * - Vulgar requires confirmation overlay
 * - Stores settings in localStorage
 * - Uses CSS vars so it matches your theme colors
 */

const MODES = [
  { key: "savage", label: "SAVAGE" },
  { key: "coach", label: "COACH" },
  { key: "motivation", label: "MOTIVATION" },
  { key: "recovery", label: "RECOVERY" },
  { key: "science", label: "SCIENCE" },
  { key: "vulgar", label: "VULGAR" },
];

export default function DashboardAISection() {
  const [enabled, setEnabled] = useState(
    localStorage.getItem("armpal_ai_enabled") !== "false"
  );

  const [mode, setMode] = useState(
    localStorage.getItem("armpal_ai_mode") || "savage"
  );

  const [rules, setRules] = useState(
    localStorage.getItem("armpal_ai_rules") || ""
  );

  const [showVulgarConfirm, setShowVulgarConfirm] = useState(false);

  const vulgarAccepted =
    localStorage.getItem("armpal_ai_vulgar_ack") === "true";

  const activeMode = useMemo(() => {
    return MODES.find((m) => m.key === mode)?.key || "savage";
  }, [mode]);

  useEffect(() => {
    localStorage.setItem("armpal_ai_enabled", String(enabled));
  }, [enabled]);

  useEffect(() => {
    localStorage.setItem("armpal_ai_mode", mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem("armpal_ai_rules", rules);
  }, [rules]);

  function handleSelectMode(next) {
    if (next === "vulgar" && !vulgarAccepted) {
      setShowVulgarConfirm(true);
      return;
    }
    setMode(next);
  }

  function acceptVulgar() {
    localStorage.setItem("armpal_ai_vulgar_ack", "true");
    setShowVulgarConfirm(false);
    setMode("vulgar");
  }

  function cancelVulgar() {
    setShowVulgarConfirm(false);
  }

  const chip = (label, value) => (
    <button
      onClick={() => setRules((prev) => (prev ? prev + "; " + value : value))}
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid var(--border)",
        background: "var(--card-2)",
        color: "var(--text)",
        fontSize: 12,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <>
      <div
        style={{
          background: "var(--card-2)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 14,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h3 style={{ margin: 0 }}>AI Coach</h3>
          <span style={{ fontSize: 12, opacity: 0.75 }}>
            Mode: <b>{activeMode.toUpperCase()}</b>
          </span>
        </div>

        {/* Mode buttons */}
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          {MODES.map((m) => {
            const isActive = activeMode === m.key;
            const isVulgar = m.key === "vulgar";

            // Use accent as primary highlight; for vulgar add a hint of red using color-mix if supported.
            const activeBg = isVulgar
              ? "color-mix(in srgb, var(--accent) 55%, red)"
              : "var(--accent)";

            return (
              <button
                key={m.key}
                onClick={() => handleSelectMode(m.key)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: isActive ? "1px solid transparent" : "1px solid var(--border)",
                  background: isActive ? activeBg : "var(--card)",
                  color: "var(--text)",
                  fontSize: 12,
                  cursor: "pointer",
                  fontWeight: 800,
                  letterSpacing: 0.3,
                  opacity: enabled ? 1 : 0.55,
                }}
                disabled={!enabled}
                title={isVulgar ? "Requires confirmation first" : undefined}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Enable toggle */}
        <label style={{ fontSize: 13, display: "block", marginTop: 10 }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={() => setEnabled((e) => !e)}
            style={{ marginRight: 6 }}
          />
          Enable AI Coach overlay
        </label>

        {/* Custom rules */}
        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.9 }}>
          Custom rules (how the AI should coach you)
        </div>

        <textarea
          value={rules}
          onChange={(e) => setRules(e.target.value)}
          placeholder="e.g. Be harsher on legs, focus bench PRs, short messages, use science mode for numbers"
          style={{
            width: "100%",
            minHeight: 72,
            marginTop: 6,
            padding: 10,
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--card)",
            color: "var(--text)",
            fontSize: 12,
            outline: "none",
          }}
          disabled={!enabled}
        />

        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          {chip("Focus Bench", "focus bench PRs")}
          {chip("Go Hard on Legs", "be harsher on leg days")}
          {chip("Short & Brutal", "short, brutal messages")}
          {chip("Recovery Aware", "consider recovery and fatigue")}
          {chip("Science Mode", "give numbers, RPE, sets/reps")}
        </div>
      </div>

      {showVulgarConfirm && (
        <VulgarDisclaimerOverlay onAccept={acceptVulgar} onCancel={cancelVulgar} />
      )}
    </>
  );
}
