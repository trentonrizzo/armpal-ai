import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import GameViewer from "./GameViewer";

export default function SessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      const { data: sess, error: sessErr } = await supabase
        .from("game_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();
      if (!alive) return;
      if (sessErr || !sess) {
        setSession(null);
        setGame(null);
        setLoading(false);
        return;
      }
      setSession(sess);
      const { data: g, error: gErr } = await supabase
        .from("games")
        .select("*")
        .eq("id", sess.game_id)
        .single();
      if (!alive) return;
      setGame(gErr ? null : g);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [sessionId]);

  if (loading) {
    return (
      <div style={{ padding: 16, color: "var(--text-dim)" }}>Loading game…</div>
    );
  }

  if (!session || !game) {
    return (
      <div style={{ padding: 16 }}>
        <p style={{ color: "var(--text-dim)" }}>Session or game not found.</p>
        <button
          type="button"
          onClick={() => navigate("/games")}
          style={{ marginTop: 12, padding: "8px 16px", cursor: "pointer" }}
        >
          Back to Games
        </button>
      </div>
    );
  }

  return <GameViewer game={game} session={session} />;
}
