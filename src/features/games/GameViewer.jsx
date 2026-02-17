import React from "react";
import ReactionTest from "./ReactionTest";
import TapStrength from "./TapStrength";
import TicTacToe from "./TicTacToe";

export default function GameViewer({ game, session }) {
  if (!game) return null;

  if (game.game_type === "reaction_test") {
    return <ReactionTest game={game} />;
  }

  if (game.game_type === "tap_strength") {
    return <TapStrength game={game} />;
  }

  if (game.game_type === "tictactoe" && session) {
    return <TicTacToe game={game} session={session} />;
  }

  return (
    <div style={{ padding: 16, color: "var(--text-dim)" }}>
      Unknown game type: {game.game_type}
    </div>
  );
}
