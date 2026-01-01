import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function Analytics() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("bodyweight");

  const [weights, setWeights] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tab === "bodyweight") loadBodyweight();
  }, [tab]);

  async function loadBodyweight() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setWeights([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("bodyweight")
      .select("weight, date")
      .eq("user_id", user.id)
      .order("date", { ascending: true });

    if (error) {
      setWeights([]);
    } else {
      setWeights(data || []);
    }

    setLoading(false);
  }

  const latest = weights.length ? weights[weights.length - 1].weight : null;

  /* ---------- GRAPH HELPERS ---------- */
  const maxW = Math.max(...weights.map((w) => w.weight), 0);
  const minW = Math.min(...weights.map((w) => w.weight), maxW);

  function getX(i) {
    return (i / Math.max(weights.length - 1, 1)) * 280 + 10;
  }

  function getY(w) {
    if (maxW === minW) return 80;
    return 150 - ((w - minW) / (maxW - minW)) * 120;
  }

  const path =
    weights.length > 1
      ? weights
          .map((w, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(w.weight)}`)
          .join(" ")
      : "";

  return (
    <div style={{ minHeight: "100vh", background: "#0b0b0f", color: "#fff", padding: 16 }}>
      <button
        onClick={() => navigate(-1)}
        style={{
          background: "transparent",
          border: "1px solid rgba(255,255,255,0.15)",
          color: "#fff",
          padding: "10px 12px",
          borderRadius: 12,
        }}
      >
        ← Back
      </button>

      <div style={{ marginTop: 14, fontSize: 22, fontWeight: 800 }}>
        Smart Analytics
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        {[
          ["bodyweight", "Bodyweight"],
          ["measurements", "Measurements"],
          ["prs", "PRs"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.12)",
              background:
                tab === key
                  ? "linear-gradient(90deg, #ff2f2f, #ff6b4a)"
                  : "rgba(255,255,255,0.04)",
              color: "#fff",
              fontWeight: 800,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* BODYWEIGHT ANALYTICS */}
      {tab === "bodyweight" && (
        <div
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.04)",
          }}
        >
          {loading ? (
            <p style={{ opacity: 0.7 }}>Loading bodyweight…</p>
          ) : weights.length === 0 ? (
            <p style={{ opacity: 0.7 }}>
              No bodyweight logged yet. Start tracking to see analytics.
            </p>
          ) : (
            <>
              <div style={{ fontSize: 14, opacity: 0.8 }}>Current Bodyweight</div>
              <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 10 }}>
                {latest} lb
              </div>

              {/* GRAPH */}
              <svg width="100%" height="160" viewBox="0 0 300 160">
                <path
                  d={path}
                  fill="none"
                  stroke="#ff2f2f"
                  strokeWidth="3"
                />
                {weights.map((w, i) => (
                  <circle
                    key={i}
                    cx={getX(i)}
                    cy={getY(w.weight)}
                    r="3"
                    fill="#fff"
                  />
                ))}
              </svg>

              {/* LIST */}
              <div style={{ marginTop: 12 }}>
                {weights
                  .slice()
                  .reverse()
                  .map((w, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 13,
                        padding: "4px 0",
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <span>{new Date(w.date).toLocaleDateString()}</span>
                      <span>{w.weight} lb</span>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* PLACEHOLDERS */}
      {tab !== "bodyweight" && (
        <div
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.04)",
            opacity: 0.7,
          }}
        >
          {tab === "measurements" && "Measurements analytics coming next"}
          {tab === "prs" && "PR analytics coming next"}
        </div>
      )}
    </div>
  );
}
