import React from "react";
import ReactionSpeed from "./ReactionSpeed";
import TapStrength from "./TapStrength";
import TicTacToe from "./TicTacToe";
import FlappyArmGame from "../../games/flappyarm/FlappyArmGame";

export default function GameViewer({ game, session }) {
  if (!game) return null;

  switch (game.game_type) {
    case "reaction_test":
    case "reaction_speed":
      return <ReactionSpeed game={game} />;
    case "tap_strength":
      return <TapStrength game={game} />;
    case "flappy_arm":
      return <FlappyArmGame game={game} />;
    case "tictactoe":
    case "tic_tac_toe":
      return session ? <TicTacToe game={game} session={session} /> : (
        <div style={{ padding: 16, color: "var(--text-dim)" }}>Open this game from a chat or session link.</div>
      );
    default:
      return (
        <div style={{ padding: 16, color: "var(--text-dim)" }}>
          Unknown game type: {game.game_type}
        </div>
      );
  }
}
