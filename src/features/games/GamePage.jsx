import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import GameViewer from "./GameViewer";

export default function GamePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      const { data, error } = await supabase.from("games").select("*").eq("id", id).single();
      if (!alive) return;
      if (error || !data) {
        setGame(null);
      } else {
        setGame(data);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: 16, color: "var(--text-dim)" }}>Loading game…</div>
    );
  }

  if (!game) {
    return (
      <div style={{ padding: 16 }}>
        <p style={{ color: "var(--text-dim)" }}>Game not found.</p>
        <button type="button" onClick={() => navigate("/games")} style={{ marginTop: 12, padding: "8px 16px", cursor: "pointer" }}>
          Back to Games
        </button>
      </div>
    );
  }

  return <GameViewer game={game} />;
}
