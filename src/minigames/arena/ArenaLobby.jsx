/**
 * ArmPal Arena — Lobby: Create Match, Join by 4-digit code, status
 * Match UUID is not exposed; only join_code is shown and used for join.
 */
import React, { useState } from "react";
import { createMatch, joinByCode, setMatchActive } from "./arenaDb";
import { useToast } from "../../components/ToastProvider";

const wrap = {
  padding: "20px 16px 100px",
  maxWidth: 420,
  margin: "0 auto",
  minHeight: "100vh",
  background: "var(--bg)",
  color: "var(--text)",
};
const title = { fontSize: 24, fontWeight: 900, marginBottom: 8 };
const sub = { fontSize: 14, color: "var(--text-dim)", marginBottom: 24 };
const input = {
  width: "100%",
  boxSizing: "border-box",
  padding: "14px 16px",
  marginBottom: 12,
  border: "1px solid var(--border)",
  borderRadius: 12,
  background: "var(--card-2)",
  color: "var(--text)",
  fontSize: 16,
};
const btn = {
  width: "100%",
  padding: 14,
  borderRadius: 12,
  border: "none",
  background: "var(--accent)",
  color: "var(--text)",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
};
const btnSecondary = {
  ...btn,
  background: "var(--card-2)",
  border: "1px solid var(--border)",
  marginTop: 10,
};
const codeBox = {
  marginTop: 16,
  padding: 16,
  background: "var(--card-2)",
  borderRadius: 12,
  border: "1px solid var(--border)",
  textAlign: "center",
};
const codeLabel = { fontSize: 12, color: "var(--text-dim)", marginBottom: 4, display: "block" };
const codeValue = { fontSize: 28, fontWeight: 900, fontFamily: "monospace", letterSpacing: 4, color: "var(--text)" };
const statusBadge = {
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
  marginTop: 8,
};

export default function ArenaLobby({ user, match: controlledMatch, onMatchJoined, onMatchStarted }) {
  const toast = useToast();
  const [createLoading, setCreateLoading] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [internalMatch, setInternalMatch] = useState(null);
  const [startLoading, setStartLoading] = useState(false);
  const match = controlledMatch ?? internalMatch;

  async function handleCreate() {
    if (!user?.id || createLoading) return;
    setCreateLoading(true);
    try {
      const m = await createMatch(user.id);
      setInternalMatch(m);
      onMatchJoined && onMatchJoined(m);
      toast.success("Match created. Share code: " + m.join_code);
    } catch (e) {
      toast.error(e?.message || "Failed to create match");
    }
    setCreateLoading(false);
  }

  async function handleJoin() {
    const raw = (joinCode || "").trim();
    if (!user?.id || !raw || joinLoading) return;
    const code = parseInt(raw, 10);
    if (!Number.isInteger(code) || code < 1000 || code > 9999) {
      toast.error("Enter a 4-digit code (1000–9999).");
      return;
    }
    setJoinLoading(true);
    try {
      const m = await joinByCode(code, user.id);
      setInternalMatch(m);
      onMatchJoined && onMatchJoined(m);
      toast.success("Joined match!");
    } catch (e) {
      const msg = e?.message || "Could not join match";
      toast.error(msg);
    }
    setJoinLoading(false);
  }

  async function handleStart() {
    if (!match?.id || match.host_user_id !== user?.id || startLoading) return;
    setStartLoading(true);
    try {
      const m = await setMatchActive(match.id, user.id);
      setInternalMatch(m);
      onMatchStarted && onMatchStarted(m);
    } catch (e) {
      toast.error(e?.message || "Could not start");
    }
    setStartLoading(false);
  }

  const isHost = match && match.host_user_id === user?.id;
  const hasTwo = match && match.slot1_user_id && match.slot2_user_id;
  const canStart = isHost && hasTwo && match.status === "waiting";

  return (
    <div style={wrap}>
      <h1 style={title}>ArmPal Arena</h1>
      <p style={sub}>1v1 arena. First to 7 kills or 90 seconds.</p>

      {!match ? (
        <>
          <button type="button" onClick={handleCreate} disabled={createLoading} style={btn}>
            {createLoading ? "Creating…" : "Create Match"}
          </button>
          <div style={{ marginTop: 24 }}>
            <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
              Join by code
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="4-digit code"
              style={input}
            />
            <button type="button" onClick={handleJoin} disabled={joinLoading} style={btnSecondary}>
              {joinLoading ? "Joining…" : "Join"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={codeBox}>
            <span style={codeLabel}>Your match code</span>
            <span style={codeValue}>{match.join_code ?? "—"}</span>
          </div>
          <div
            style={{
              ...statusBadge,
              background:
                match.status === "active"
                  ? "var(--accent)"
                  : match.status === "ended"
                    ? "var(--text-dim)"
                    : "color-mix(in srgb, var(--accent) 30%, transparent)",
              color: "var(--text)",
            }}
          >
            {match.status === "waiting" && (hasTwo ? "Ready — start below" : "Waiting for player 2…")}
            {match.status === "active" && "Match in progress"}
            {match.status === "ended" && "Match ended"}
          </div>
          {canStart && (
            <button
              type="button"
              onClick={handleStart}
              disabled={startLoading}
              style={{ ...btn, marginTop: 16 }}
            >
              {startLoading ? "Starting…" : "Start Match"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
