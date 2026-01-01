import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function Analytics() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("bodyweight");

  const [weights, setWeights] = useState([]);
  const [activeIndex, setActiveIndex] = useState(null);
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

    const { data } = await supabase
      .from("bodyweight_logs")
      .select("weight, logged_at")
      .eq("user_id", user.id)
      .order("logged_at", { ascending: true });

    setWeights(data || []);
    setActiveIndex(null);
    setLoading(false);
  }

  const latest = weights.length
    ? weights[weights.length - 1].weight
    : null;

  /* ===== GRAPH CONSTANTS ===== */
  const W = 320;
  const H = 200;
  const PAD = 40;

  const maxW = Math.max(...weights.map((w) => w.weight), 0);
  const minW = Math.min(...weights.map((w) => w.weight), maxW);

  function x(i) {
    return (
      PAD +
      (i / Math.max(weights.length - 1, 1)) * (W - PAD * 2)
    );
  }

  function y(w) {
    if (maxW === minW) return H / 2;
    return (
      H -
      PAD -
      ((w - minW) / (maxW - minW)) * (H - PAD * 2)
    );
  }

  const linePath =
    weights.length > 1
      ? weights
          .map(
            (w, i) =>
              `${i === 0 ? "M" : "L"} ${x(i)} ${y(w.weight)}`
          )
          .join(" ")
      : "";

  const areaPath =
    linePath +
    ` L ${x(weights.length - 1)} ${H - PAD} L ${x(0)} ${
      H - PAD
    } Z`;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b0b0f",
        color: "#fff",
        padding: 16,
      }}
    >
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

      <div style={{ marginTop: 14, fontSize: 22, fontWeight: 900 }}>
        Smart Analytics
      </div>

      {/* TABS */}
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
                  ? "linear-gradient(90deg, #ff2f2f, #ff3b3b)"
                  : "rgba(255,255,255,0.04)",
              color: "#fff",
              fontWeight: 800,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* BODYWEIGHT */}
      {tab === "bodyweight" && (
        <div
          style={{
            marginTop: 14,
            padding: 16,
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "#101014",
          }}
        >
          {loading ? (
            <p style={{ opacity: 0.7 }}>Loading bodyweight…</p>
          ) : weights.length === 0 ? (
            <p style={{ opacity: 0.7 }}>
              No bodyweight logged yet.
            </p>
          ) : (
            <>
              <div style={{ fontSize: 13, opacity: 0.75 }}>
                Current Bodyweight
              </div>
              <div
                style={{
                  fontSize: 34,
                  fontWeight: 900,
                  marginBottom: 12,
                }}
              >
                {latest} lb
              </div>

              {/* GRAPH */}
              <svg
                width="100%"
                viewBox={`0 0 ${W} ${H}`}
                style={{ marginBottom: 12 }}
              >
                {/* Y AXIS LABELS */}
                <text
                  x={4}
                  y={PAD}
                  fontSize="10"
                  fill="#aaa"
                >
                  {maxW} lb
                </text>
                <text
                  x={4}
                  y={H - PAD}
                  fontSize="10"
                  fill="#aaa"
                >
                  {minW} lb
                </text>

                {/* AREA */}
                <path
                  d={areaPath}
                  fill="rgba(255,47,47,0.15)"
                />

                {/* LINE */}
                <path
                  d={linePath}
                  fill="none"
                  stroke="#ff2f2f"
                  strokeWidth="3"
                />

                {/* DOTS */}
                {weights.map((w, i) => (
                  <circle
                    key={i}
                    cx={x(i)}
                    cy={y(w.weight)}
                    r={activeIndex === i ? 6 : 4}
                    fill="#ff2f2f"
                    onClick={() => setActiveIndex(i)}
                  />
                ))}

                {/* TOOLTIP */}
                {activeIndex !== null && (
                  <>
                    <rect
                      x={x(activeIndex) - 42}
                      y={y(weights[activeIndex].weight) - 40}
                      width="84"
                      height="32"
                      rx="8"
                      fill="#1a1a1f"
                      stroke="rgba(255,255,255,0.12)"
                    />
                    <text
                      x={x(activeIndex)}
                      y={y(weights[activeIndex].weight) - 22}
                      textAnchor="middle"
                      fontSize="11"
                      fill="#fff"
                      fontWeight="700"
                    >
                      {weights[activeIndex].weight} lb
                    </text>
                    <text
                      x={x(activeIndex)}
                      y={y(weights[activeIndex].weight) - 10}
                      textAnchor="middle"
                      fontSize="9"
                      fill="#aaa"
                    >
                      {new Date(
                        weights[activeIndex].logged_at
                      ).toLocaleDateString()}
                    </text>
                  </>
                )}
              </svg>

              {/* LIST */}
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
                      padding: "6px 0",
                      borderBottom:
                        "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <span>
                      {new Date(w.logged_at).toLocaleDateString()}
                    </span>
                    <span>{w.weight} lb</span>
                  </div>
                ))}
            </>
          )}
        </div>
      )}

      {tab !== "bodyweight" && (
        <div
          style={{
            marginTop: 14,
            padding: 16,
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "#101014",
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
