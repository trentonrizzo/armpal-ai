// src/pages/Analytics.jsx
// ============================================================
// ARM PAL — SMART ANALYTICS (BODYWEIGHT + GOALS OVERLAY)
// FULL FILE REPLACEMENT — NO TRUNCATION
// ============================================================

import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function Analytics() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("bodyweight");

  // bodyweight logs
  const [weights, setWeights] = useState([]);

  // bodyweight goals
  const [bwGoals, setBwGoals] = useState([]);

  // interaction
  const [activePoint, setActivePoint] = useState(null); // { type, index }
  const [loading, setLoading] = useState(true);

  /* ============================================================
     LOAD DATA
  ============================================================ */
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
      setBwGoals([]);
      setLoading(false);
      return;
    }

    // bodyweight logs
    const { data: bw } = await supabase
      .from("bodyweight_logs")
      .select("weight, logged_at")
      .eq("user_id", user.id)
      .order("logged_at", { ascending: true });

    // bodyweight goals
    const { data: goals } = await supabase
      .from("goals")
      .select("id, title, target_value, updated_at")
      .eq("user_id", user.id)
      .eq("type", "bodyweight");

    setWeights(bw || []);
    setBwGoals(goals || []);
    setActivePoint(null);
    setLoading(false);
  }

  const latestWeight = weights.length
    ? weights[weights.length - 1].weight
    : null;

  /* ============================================================
     GRAPH SETUP
  ============================================================ */
  const W = 360;
  const H = 220;
  const PAD = 44;

  const allValues = useMemo(() => {
    const vals = weights.map((w) => w.weight);
    bwGoals.forEach((g) => {
      if (typeof g.target_value === "number") vals.push(g.target_value);
    });
    return vals;
  }, [weights, bwGoals]);

  const maxW = allValues.length ? Math.max(...allValues) : 0;
  const minW = allValues.length ? Math.min(...allValues) : 0;

  function xByIndex(i, total) {
    if (total <= 1) return PAD;
    return PAD + (i / (total - 1)) * (W - PAD * 2);
  }

  function yByValue(v) {
    if (maxW === minW) return H / 2;
    return (
      H -
      PAD -
      ((v - minW) / (maxW - minW)) * (H - PAD * 2)
    );
  }

  const linePath =
    weights.length > 1
      ? weights
          .map(
            (w, i) =>
              `${i === 0 ? "M" : "L"} ${xByIndex(
                i,
                weights.length
              )} ${yByValue(w.weight)}`
          )
          .join(" ")
      : "";

  const areaPath = linePath
    ? `${linePath} L ${xByIndex(
        weights.length - 1,
        weights.length
      )} ${H - PAD} L ${xByIndex(0, weights.length)} ${H - PAD} Z`
    : "";

  /* ============================================================
     RENDER
  ============================================================ */
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
        style={backBtn}
      >
        ← Back
      </button>

      <div style={titleStyle}>Smart Analytics</div>

      {/* TABS */}
      <div style={tabsWrap}>
        {[
          ["bodyweight", "Bodyweight"],
          ["measurements", "Measurements"],
          ["prs", "PRs"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              ...tabBtn,
              background: tab === key ? "#ff2f2f" : "rgba(255,255,255,0.04)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* BODYWEIGHT TAB */}
      {tab === "bodyweight" && (
        <div style={card}>
          {loading ? (
            <p style={{ opacity: 0.7 }}>Loading bodyweight…</p>
          ) : weights.length === 0 ? (
            <p style={{ opacity: 0.7 }}>No bodyweight logged yet.</p>
          ) : (
            <>
              <div style={{ fontSize: 13, opacity: 0.75 }}>
                Current Bodyweight
              </div>
              <div style={bigValue}>{latestWeight} lb</div>

              {/* GRAPH */}
              <svg
                width="100%"
                viewBox={`0 0 ${W} ${H}`}
                style={{ marginBottom: 16 }}
              >
                {/* Y AXIS LABELS */}
                <text x={6} y={PAD} fontSize="10" fill="#aaa">
                  {maxW} lb
                </text>
                <text x={6} y={H - PAD} fontSize="10" fill="#aaa">
                  {minW} lb
                </text>

                {/* AREA */}
                {areaPath && (
                  <path d={areaPath} fill="rgba(255,47,47,0.18)" />
                )}

                {/* LINE */}
                {linePath && (
                  <path
                    d={linePath}
                    fill="none"
                    stroke="#ff2f2f"
                    strokeWidth="3"
                  />
                )}

                {/* PAST + CURRENT DOTS */}
                {weights.map((w, i) => {
                  const isCurrent = i === weights.length - 1;
                  return (
                    <g key={`w-${i}`}>
                      <circle
                        cx={xByIndex(i, weights.length)}
                        cy={yByValue(w.weight)}
                        r={10}
                        fill="transparent"
                        onClick={() => setActivePoint({ type: "weight", index: i })}
                      />
                      <circle
                        cx={xByIndex(i, weights.length)}
                        cy={yByValue(w.weight)}
                        r={isCurrent ? 6 : 5}
                        fill={isCurrent ? "#2ecc71" : "#ff2f2f"}
                      />
                    </g>
                  );
                })}

                {/* GOAL DOTS */}
                {bwGoals.map((g, i) => (
                  <g key={`g-${g.id}`}>
                    <circle
                      cx={xByIndex(weights.length - 1 + i + 1, weights.length + bwGoals.length + 1)}
                      cy={yByValue(g.target_value)}
                      r={10}
                      fill="transparent"
                      onClick={() => setActivePoint({ type: "goal", index: i })}
                    />
                    <circle
                      cx={xByIndex(weights.length - 1 + i + 1, weights.length + bwGoals.length + 1)}
                      cy={yByValue(g.target_value)}
                      r={6}
                      fill="#f5c542"
                    />
                  </g>
                ))}

                {/* TOOLTIP */}
                {activePoint && (() => {
                  let label = "";
                  let value = "";
                  let date = "";
                  let cx = 0;
                  let cy = 0;

                  if (activePoint.type === "weight") {
                    const w = weights[activePoint.index];
                    label = activePoint.index === weights.length - 1 ? "Current" : "Past";
                    value = `${w.weight} lb`;
                    date = new Date(w.logged_at).toLocaleDateString();
                    cx = xByIndex(activePoint.index, weights.length);
                    cy = yByValue(w.weight);
                  } else {
                    const g = bwGoals[activePoint.index];
                    label = "Goal";
                    value = `${g.target_value} lb`;
                    date = "Target";
                    cx = xByIndex(weights.length - 1 + activePoint.index + 1, weights.length + bwGoals.length + 1);
                    cy = yByValue(g.target_value);
                  }

                  return (
                    <g>
                      <rect
                        x={cx - 46}
                        y={cy - 48}
                        width="92"
                        height="36"
                        rx="10"
                        fill="#15151a"
                        stroke="rgba(255,255,255,0.12)"
                      />
                      <text
                        x={cx}
                        y={cy - 28}
                        textAnchor="middle"
                        fontSize="11"
                        fill="#fff"
                        fontWeight="700"
                      >
                        {value}
                      </text>
                      <text
                        x={cx}
                        y={cy - 14}
                        textAnchor="middle"
                        fontSize="9"
                        fill="#aaa"
                      >
                        {label} {date}
                      </text>
                    </g>
                  );
                })()}
              </svg>

              {/* LOG LIST */}
              {weights
                .slice()
                .reverse()
                .map((w, i) => (
                  <div key={i} style={row}>
                    <span>{new Date(w.logged_at).toLocaleDateString()}</span>
                    <span>{w.weight} lb</span>
                  </div>
                ))}
            </>
          )}
        </div>
      )}

      {/* PLACEHOLDERS */}
      {tab !== "bodyweight" && (
        <div style={{ ...card, opacity: 0.7 }}>
          {tab === "measurements" && "Measurements analytics coming next"}
          {tab === "prs" && "PR analytics coming next"}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   STYLES
============================================================ */
const backBtn = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.15)",
  color: "#fff",
  padding: "10px 12px",
  borderRadius: 12,
};

const titleStyle = {
  marginTop: 14,
  fontSize: 22,
  fontWeight: 900,
};

const tabsWrap = {
  display: "flex",
  gap: 10,
  marginTop: 14,
};

const tabBtn = {
  flex: 1,
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#fff",
  fontWeight: 800,
};

const card = {
  marginTop: 14,
  padding: 16,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "#101014",
};

const bigValue = {
  fontSize: 34,
  fontWeight: 900,
  marginBottom: 12,
};

const row = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 13,
  padding: "6px 0",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};
