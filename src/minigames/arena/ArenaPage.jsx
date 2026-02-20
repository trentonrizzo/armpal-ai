/**
 * ArmPal Arena — Page wrapper: auth, lobby vs game, leaderboard
 */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import ArenaLobby from "./ArenaLobby";
import ArenaGame from "./ArenaGame";
import { getMatch, getArenaLeaderboard } from "./arenaDb";

const PAGE_WRAP = {
  minHeight: "100vh",
  background: "var(--bg)",
  color: "var(--text)",
  paddingBottom: 24,
};

export default function ArenaPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [match, setMatch] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (alive) {
        setUser(u ?? null);
        setLoading(false);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (alive) setUser(s?.user ?? null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await getArenaLeaderboard(25);
        if (alive) setLeaderboard(list || []);
      } catch (_) {}
    })();
    return () => { alive = false; };
  }, []);

  // Poll: keep match state in sync (e.g. slot2 filled, status active) so host sees Start button
  useEffect(() => {
    if (!match?.id || match.status === "active") return;
    const iv = setInterval(async () => {
      try {
        const updated = await getMatch(match.id);
        if (updated) setMatch(updated);
      } catch (_) {}
    }, 1500);
    return () => clearInterval(iv);
  }, [match?.id, match?.status]);

  // Realtime: when arena_matches row updates (guest joined, host started), sync UI immediately
  useEffect(() => {
    if (!match?.id) return;
    const channel = supabase
      .channel(`arena-match:${match.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "arena_matches", filter: `id=eq.${match.id}` },
        (payload) => {
          if (payload?.new) setMatch(payload.new);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [match?.id]);

  const handleMatchJoined = (m) => setMatch(m);
  const handleMatchStarted = (m) => setMatch(m);
  const handleExit = () => {
    setMatch(null);
  };
  const handleMatchEnd = () => {
    setMatch(null);
  };

  if (user === null && loading) {
    return (
      <div style={PAGE_WRAP}>
        <p style={{ padding: 24, color: "var(--text-dim)" }}>Loading…</p>
      </div>
    );
  }
  if (!user) {
    return (
      <div style={PAGE_WRAP}>
        <div style={{ padding: 24, textAlign: "center" }}>
          <p style={{ marginBottom: 16, color: "var(--text-dim)" }}>Sign in to play ArmPal Arena.</p>
          <button
            type="button"
            onClick={() => navigate("/")}
            style={{
              padding: "12px 24px",
              borderRadius: 12,
              border: "none",
              background: "var(--accent)",
              color: "var(--text)",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Go to app
          </button>
        </div>
      </div>
    );
  }

  const isActive = match?.status === "active";
  const mySlot = match?.slot1_user_id === user.id ? 1 : match?.slot2_user_id === user.id ? 2 : null;
  const opponentUserId =
    mySlot === 1 ? match?.slot2_user_id : mySlot === 2 ? match?.slot1_user_id : null;

  return (
    <div style={PAGE_WRAP}>
      {!match ? (
        <ArenaLobby
          user={user}
          onMatchJoined={handleMatchJoined}
          onMatchStarted={handleMatchStarted}
        />
      ) : isActive && mySlot && opponentUserId ? (
        <ArenaGame
          matchId={match.id}
          myUserId={user.id}
          mySlot={mySlot}
          opponentUserId={opponentUserId}
          onExit={handleExit}
          onMatchEnd={handleMatchEnd}
        />
      ) : (
        <ArenaLobby
          user={user}
          match={match}
          onMatchJoined={handleMatchJoined}
          onMatchStarted={handleMatchStarted}
        />
      )}

      <section style={{ maxWidth: 420, margin: "0 auto", padding: "0 16px", marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12, color: "var(--text)" }}>
          Arena Leaderboard
        </h2>
        <div
          style={{
            background: "var(--card-2)",
            borderRadius: 12,
            border: "1px solid var(--border)",
            overflow: "hidden",
          }}
        >
          {leaderboard.length === 0 ? (
            <p style={{ padding: 16, color: "var(--text-dim)", fontSize: 14 }}>No entries yet.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {leaderboard.map((row, i) => (
                <li
                  key={row.user_id || i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderBottom: i < leaderboard.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <span style={{ fontWeight: 700, color: "var(--text)" }}>
                    #{i + 1} {row.display_name || row.username || "Player"}
                  </span>
                  <span style={{ fontSize: 13, color: "var(--text-dim)" }}>
                    {row.rating ?? 0} · W/L {row.wins ?? 0}-{row.losses ?? 0} · K/D{" "}
                    {row.kd_ratio != null ? Number(row.kd_ratio) : (row.kills ?? 0) / Math.max(1, row.deaths ?? 1)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
