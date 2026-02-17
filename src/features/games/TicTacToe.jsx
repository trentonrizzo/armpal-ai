import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function checkWinner(board) {
  for (const [a, b, c] of WIN_LINES) {
    const v = board[a];
    if (v && v === board[b] && v === board[c]) return { mark: v, line: [a, b, c] };
  }
  return null;
}

function isDraw(board) {
  return board.every(Boolean) && !checkWinner(board);
}

export default function TicTacToe({ game, session: initialSession }) {
  const navigate = useNavigate();
  const [session, setSession] = useState(initialSession);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastPlaced, setLastPlaced] = useState(null);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (alive) setUser(u ?? null);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!session?.id) return;
    const channel = supabase
      .channel(`game-session-${session.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_sessions", filter: `id=eq.${session.id}` },
        (payload) => setSession(payload.new)
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [session?.id]);

  const state = session?.state || {};
  const board = Array.isArray(state.board) ? state.board : Array(9).fill(null);
  const score = state.score && typeof state.score === "object"
    ? { player_one: Number(state.score.player_one) || 0, player_two: Number(state.score.player_two) || 0 }
    : { player_one: 0, player_two: 0 };
  const myId = user?.id;
  const isMyTurn = session?.current_turn === myId;
  const amPlayerOne = session?.player_one === myId;
  const myMark = amPlayerOne ? "X" : "O";
  const winResult = checkWinner(board);
  const draw = isDraw(board);
  const winnerMark = winResult?.mark ?? null;
  const winnerId = winnerMark === "X" ? session?.player_one : session?.player_two;
  const isComplete = session?.status === "complete" || winnerMark || draw;

  async function makeMove(index) {
    if (!session || !myId || board[index] || !isMyTurn || isComplete || loading) return;
    const newBoard = [...board];
    newBoard[index] = myMark;
    setLastPlaced(index);
    const nextTurnId = session.current_turn === session.player_one ? session.player_two : session.player_one;
    const nextTurnKey = nextTurnId === session.player_one ? "player_one" : "player_two";
    const winResultNew = checkWinner(newBoard);
    const drawNew = isDraw(newBoard);
    const newScore = { ...score };
    if (winResultNew) {
      const key = winResultNew.mark === "X" ? "player_one" : "player_two";
      newScore[key] = (newScore[key] || 0) + 1;
    }
    const newState = {
      ...state,
      board: newBoard,
      turn: nextTurnKey,
      winner: winResultNew ? (winResultNew.mark === "X" ? "player_one" : "player_two") : null,
      score: newScore,
    };
    const updates = {
      state: newState,
      current_turn: nextTurnId,
      ...(session.status === "pending" && { status: "active" }),
    };
    if (winResultNew || drawNew) {
      updates.status = "complete";
      if (winResultNew) updates.winner = winResultNew.mark === "X" ? session.player_one : session.player_two;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("game_sessions")
      .update(updates)
      .eq("id", session.id)
      .select()
      .single();
    setLoading(false);
    if (!error && data) {
      setSession(data);
      if (updates.winner) {
        await supabase.from("user_game_scores").insert({
          user_id: updates.winner,
          game_id: game.id,
          score: 1,
        });
      }
    }
  }

  async function rematch() {
    if (!session || loading) return;
    const newState = {
      ...state,
      board: [null, null, null, null, null, null, null, null, null],
      turn: "player_one",
      winner: null,
      score: state.score || { player_one: 0, player_two: 0 },
    };
    setLoading(true);
    const { data, error } = await supabase
      .from("game_sessions")
      .update({
        state: newState,
        current_turn: session.player_one,
        status: "active",
        winner: null,
      })
      .eq("id", session.id)
      .select()
      .single();
    setLoading(false);
    setLastPlaced(null);
    if (!error && data) setSession(data);
  }

  const winLine = winResult?.line;

  return (
    <div style={styles.wrap}>
      <button type="button" onClick={() => navigate("/games")} style={styles.backBtn}>
        ← Games
      </button>
      <h2 style={styles.title}>{game?.title ?? "Tic Tac Toe"}</h2>

      <div style={styles.scoreboard}>
        <span style={amPlayerOne ? styles.scoreHighlight : {}}>You {score.player_one}</span>
        <span style={styles.scoreSep}>–</span>
        <span style={!amPlayerOne ? styles.scoreHighlight : {}}>Opponent {score.player_two}</span>
      </div>

      <p style={styles.turn}>
        {!isComplete && (isMyTurn ? "Your turn" : "Opponent's turn")}
      </p>

      <div style={styles.gridWrap}>
        {winLine && (() => {
          const [a, b, c] = winLine;
          const isRow0 = a === 0 && c === 2;
          const isRow1 = a === 3 && c === 5;
          const isRow2 = a === 6 && c === 8;
          const isCol0 = a === 0 && c === 6;
          const isCol1 = a === 1 && c === 7;
          const isCol2 = a === 2 && c === 8;
          const isDiagBack = a === 0 && c === 8;
          const isDiagFwd = a === 2 && c === 6;
          const base = { ...styles.winLine };
          if (isRow0) Object.assign(base, { top: "16.66%", left: "5%", width: "90%", height: 4 });
          else if (isRow1) Object.assign(base, { top: "50%", left: "5%", width: "90%", height: 4, transform: "translateY(-50%)" });
          else if (isRow2) Object.assign(base, { top: "83.33%", left: "5%", width: "90%", height: 4, transform: "translateY(-100%)" });
          else if (isCol0) Object.assign(base, { top: "5%", left: "16.66%", width: 4, height: "90%" });
          else if (isCol1) Object.assign(base, { top: "5%", left: "50%", width: 4, height: "90%", transform: "translateX(-50%)" });
          else if (isCol2) Object.assign(base, { top: "5%", left: "83.33%", width: 4, height: "90%", transform: "translateX(-100%)" });
          else if (isDiagBack) Object.assign(base, { top: "50%", left: "50%", width: "120%", height: 4, transform: "translate(-50%, -50%) rotate(45deg)" });
          else if (isDiagFwd) Object.assign(base, { top: "50%", left: "50%", width: "120%", height: 4, transform: "translate(-50%, -50%) rotate(-45deg)" });
          return <div style={base} />;
        })()}
        <div style={styles.grid}>
          {board.map((cell, i) => (
            <button
              key={i}
              type="button"
              onClick={() => makeMove(i)}
              disabled={!!cell || !isMyTurn || isComplete || loading}
              style={{
                ...styles.cell,
                ...(cell ? styles.cellFilled : {}),
                ...(isMyTurn && !cell && !isComplete ? styles.cellActive : {}),
                ...(winLine && winLine.includes(i) ? styles.cellWon : {}),
              }}
            >
              <span
                style={{
                  ...styles.cellMark,
                  ...(lastPlaced === i ? styles.cellMarkPlaced : {}),
                }}
              >
                {cell ?? ""}
              </span>
            </button>
          ))}
        </div>
      </div>

      {isComplete && (
        <div style={styles.resultBanner}>
          {winnerId === myId && <span style={styles.bannerText}>You win!</span>}
          {winnerId && winnerId !== myId && <span style={styles.bannerText}>You lost</span>}
          {draw && <span style={styles.bannerText}>Draw</span>}
          <div style={styles.resultActions}>
            <button type="button" onClick={rematch} style={styles.primaryBtn} disabled={loading}>
              Rematch
            </button>
            <button type="button" onClick={() => navigate("/games")} style={styles.secondaryBtn}>
              Back to Games
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: {
    padding: "16px 16px 90px",
    maxWidth: "340px",
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
    margin: "0 0 8px",
    color: "var(--text)",
  },
  scoreboard: {
    fontSize: 14,
    fontWeight: 700,
    color: "var(--text-dim)",
    marginBottom: 8,
  },
  scoreHighlight: { color: "var(--accent)" },
  scoreSep: { margin: "0 6px", opacity: 0.7 },
  turn: {
    fontSize: 14,
    color: "var(--text-dim)",
    margin: "0 0 16px",
  },
  gridWrap: { position: "relative", marginBottom: 24 },
  winLine: {
    position: "absolute",
    borderRadius: 2,
    background: "var(--accent)",
    pointerEvents: "none",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 8,
    position: "relative",
  },
  cell: {
    aspectRatio: "1",
    background: "var(--card-2)",
    border: "2px solid var(--border)",
    borderRadius: 12,
    color: "var(--text)",
    fontSize: 28,
    fontWeight: 800,
    cursor: "default",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cellMark: { transition: "transform 0.2s ease" },
  cellMarkPlaced: { animation: "tictactoePop 0.25s ease" },
  cellFilled: { cursor: "default" },
  cellActive: {
    cursor: "pointer",
    borderColor: "var(--accent)",
    background: "color-mix(in srgb, var(--accent) 12%, var(--card-2))",
  },
  cellWon: {
    background: "color-mix(in srgb, var(--accent) 18%, var(--card-2))",
    borderColor: "var(--accent)",
  },
  resultBanner: {
    textAlign: "center",
    padding: 20,
    background: "var(--card-2)",
    borderRadius: 14,
    border: "1px solid var(--border)",
  },
  bannerText: {
    display: "block",
    fontSize: 22,
    fontWeight: 900,
    color: "var(--text)",
    marginBottom: 16,
  },
  resultActions: { display: "flex", flexDirection: "column", gap: 10 },
  primaryBtn: {
    padding: "12px 24px",
    borderRadius: 12,
    border: "none",
    background: "var(--accent)",
    color: "var(--text)",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
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

