// src/pages/Analytics.jsx
// ============================================================
// ARM PAL — SMART ANALYTICS (BODYWEIGHT + GOALS OVERLAY)
// FULL FILE REPLACEMENT — SAFE + TIMELINE-AWARE
// ============================================================

import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function Analytics() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("bodyweight");

  const [weights, setWeights] = useState([]);
  const [bwGoals, setBwGoals] = useState([]);

  const [activePoint, setActivePoint] = useState(null);
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

    const { data: bw } = await supabase
      .from("bodyweight_logs")
      .select("weight, logged_at")
      .eq("user_id", user.id)
      .order("logged_at", { ascending: true });

    const { data: goals } = await supabase
      .from("goals")
      .select("id, title, target_value, target_date")
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

  const timelinePoints = useMemo(() => {
    const weightPoints = weights.map((w) => ({
      type: "weight",
      date: new Date(w.logged_at),
      value: w.weight,
      raw: w,
    }));

    const goalPoints = bwGoals.map((g) => ({
      type: "goal",
      date: g.target_date ? new Date(g.target_date) : null,
      value: g.target_value,
      raw: g,
    }));

    const datedGoals = goalPoints.filter((g) => g.date);
    const undatedGoals = goalPoints.filter((g) => !g.date);

    const combined = [...weightPoints, ...datedGoals].sort(
      (a, b) => a.date - b.date
    );

    return [...combined, ...undatedGoals];
  }, [weights, bwGoals]);

  const allValues = timelinePoints.map((p) => p.value);
  const maxW = allValues.length ? Math.max(...allValues) : 0;
  const minW = allValues.length ? Math.min(...allValues) : 0;

  function xByIndex(i, total) {
    if (total <= 1) return PAD;
    return PAD + (i / (total - 1)) * (W - PAD * 2);
  }

  function yByValue(v) {
    if (maxW === minW) return H / 2;
    return H - PAD - ((v - minW) / (maxW - minW)) * (H - PAD * 2);
  }

  const weightLine = timelinePoints.filter((p) => p.type === "weight");

  const linePath =
    weightLine.length > 1
      ? weightLine
          .map(
            (p, i) =>
              `${i === 0 ? "M" : "L"} ${xByIndex(
                i,
                weightLine.length
              )} ${yByValue(p.value)}`
          )
          .join(" ")
      : "";

  const areaPath = linePath
    ? `${linePath} L ${xByIndex(
        weightLine.length - 1,
        weightLine.length
      )} ${H - PAD} L ${xByIndex(0, weightLine.length)} ${H - PAD} Z`
    : "";

  /* ============================================================
     RENDER
  ============================================================ */
  return (
    <div style={{ minHeight: "100vh", background: "#0b0b0f", color: "#fff", padding: 16 }}>
      <button onClick={() => navigate(-1)} style={backBtn}>← Back</button>
      <div style={titleStyle}>Smart Analytics</div>

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

      {tab === "bodyweight" && (
        <div style={card}>
          {loading ? (
            <p style={{ opacity: 0.7 }}>Loading bodyweight…</p>
          ) : (
            <>
              <div style={{ fontSize: 13, opacity: 0.75 }}>Current Bodyweight</div>
              <div style={bigValue}>{latestWeight} lb</div>

              <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
                <text x={6} y={PAD} fontSize="10" fill="#aaa">{maxW} lb</text>
                <text x={6} y={H - PAD} fontSize="10" fill="#aaa">{minW} lb</text>

                {areaPath && <path d={areaPath} fill="rgba(255,47,47,0.18)" />}
                {linePath && <path d={linePath} fill="none" stroke="#ff2f2f" strokeWidth="3" />}

                {timelinePoints.map((p, i) => {
                  const cx = xByIndex(i, timelinePoints.length);
                  const cy = yByValue(p.value);
                  const color =
                    p.type === "goal"
                      ? "#f5c542"
                      : i === weightLine.length - 1
                      ? "#2ecc71"
                      : "#ff2f2f";

                  return (
                    <g key={i}>
                      <circle cx={cx} cy={cy} r={10} fill="transparent"
                        onClick={() => setActivePoint({ ...p, cx, cy })} />
                      <circle cx={cx} cy={cy} r={6} fill={color} />
                    </g>
                  );
                })}

                {activePoint && (
                  <g>
                    <rect
                      x={activePoint.cx - 46}
                      y={activePoint.cy - 48}
                      width="92"
                      height="36"
                      rx="10"
                      fill="#15151a"
                      stroke="rgba(255,255,255,0.12)"
                    />
                    <text
                      x={activePoint.cx}
                      y={activePoint.cy - 28}
                      textAnchor="middle"
                      fontSize="11"
                      fill="#fff"
                      fontWeight="700"
                    >
                      {activePoint.value} lb
                    </text>
                    <text
                      x={activePoint.cx}
                      y={activePoint.cy - 14}
                      textAnchor="middle"
                      fontSize="9"
                      fill="#aaa"
                    >
                      {activePoint.type === "goal"
                        ? activePoint.date
                          ? activePoint.date.toLocaleDateString()
                          : "No date"
                        : new Date(activePoint.raw.logged_at).toLocaleDateString()}
                    </text>
                  </g>
                )}
              </svg>
            </>
          )}
        </div>
      )}

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

const titleStyle = { marginTop: 14, fontSize: 22, fontWeight: 900 };
const tabsWrap = { display: "flex", gap: 10, marginTop: 14 };
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
const bigValue = { fontSize: 34, fontWeight: 900, marginBottom: 12 };
