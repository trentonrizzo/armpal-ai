import React from "react";
import ReactionSpeed from "./ReactionSpeed";
import TapStrength from "./TapStrength";
import TicTacToe from "./TicTacToe";
import FlappyArm from "./FlappyArm";

export default function GameViewer({ game, session }) {
  if (!game) return null;

  if (game.game_type === "reaction_test" || game.game_type === "reaction_speed") {
    return <ReactionSpeed game={game} />;
  }

  if (game.game_type === "tap_strength") {
    return <TapStrength game={game} />;
  }

  if (game.game_type === "flappy_arm") {
    return <FlappyArm game={game} />;
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
