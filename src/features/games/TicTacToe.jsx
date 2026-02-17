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
    if (v && v === board[b] && v === board[c]) return v;
  }
  return null;
}

export default function TicTacToe({ game, session: initialSession }) {
  const navigate = useNavigate();
  const [session, setSession] = useState(initialSession);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (alive) setUser(u ?? null);
    });
    return () => { alive = false; };
  }, []);

  const board = Array.isArray(session?.state?.board) ? session.state.board : Array(9).fill(null);
  const myId = user?.id;
  const isMyTurn = session?.current_turn === myId;
  const amPlayerOne = session?.player_one === myId;
  const myMark = amPlayerOne ? "X" : "O";
  const winnerMark = checkWinner(board);
  const winnerId = winnerMark === "X" ? session?.player_one : session?.player_two;
  const isComplete = session?.status === "complete" || winnerMark;

  async function makeMove(index) {
    if (!session || !myId || board[index] || !isMyTurn || isComplete) return;
    const newBoard = [...board];
    newBoard[index] = myMark;
    const nextTurn = session.current_turn === session.player_one ? session.player_two : session.player_one;
    const win = checkWinner(newBoard);
    const newState = { ...session.state, board: newBoard };
    const updates = {
      state: newState,
      current_turn: nextTurn,
    };
    if (win) {
      updates.winner = win === "X" ? session.player_one : session.player_two;
      updates.status = "complete";
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

  return (
    <div style={styles.wrap}>
      <button type="button" onClick={() => navigate("/games")} style={styles.backBtn}>
        ← Games
      </button>
      <h2 style={styles.title}>{game?.title ?? "Tic Tac Toe"}</h2>
      <p style={styles.turn}>
        {isComplete
          ? winnerId === myId
            ? "You win!"
            : winnerId
              ? "You lost"
              : "Draw"
          : isMyTurn
            ? "Your turn"
            : "Opponent's turn"}
      </p>
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
            }}
          >
            {cell ?? ""}
          </button>
        ))}
      </div>
      {isComplete && (
        <button type="button" onClick={() => navigate("/games")} style={styles.primaryBtn}>
          Back to Games
        </button>
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
  turn: {
    fontSize: 14,
    color: "var(--text-dim)",
    margin: "0 0 16px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 8,
    marginBottom: 24,
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
  },
  cellFilled: {
    cursor: "default",
  },
  cellActive: {
    cursor: "pointer",
    borderColor: "var(--accent)",
    background: "color-mix(in srgb, var(--accent) 12%, var(--card-2))",
  },
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
};
