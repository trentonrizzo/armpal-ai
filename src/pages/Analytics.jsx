// src/pages/Analytics.jsx
// ============================================================
// ARM PAL — SMART ANALYTICS (BODYWEIGHT — CANONICAL & TIME-BASED)
// FULL FILE REPLACEMENT — NO TRUNCATION
// ============================================================

import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function Analytics() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("bodyweight");
  const [weights, setWeights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePoint, setActivePoint] = useState(null);

  /* ============================================================
     LOAD BODYWEIGHT
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
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("bodyweight_logs")
      .select("weight, logged_at")
      .eq("user_id", user.id)
      .order("logged_at", { ascending: true });

    setWeights(data || []);
    setActivePoint(null);
    setLoading(false);
  }

  const latestWeight =
    weights.length > 0 ? weights[weights.length - 1].weight : null;

  /* ============================================================
     GRAPH CONSTANTS
  ============================================================ */
  const W = 360;
  const H = 220;
  const PAD = 44;

  /* ============================================================
     CANONICAL SORTED DATA (OLD → NEW)
  ============================================================ */
  const points = useMemo(() => {
    return weights.map((w) => ({
      date: new Date(w.logged_at),
      ts: new Date(w.logged_at).getTime(),
      value: w.weight,
    }));
  }, [weights]);

  const minX = points.length ? points[0].ts : 0;
  const maxX = points.length ? points[points.length - 1].ts : 1;

  const values = points.map((p) => p.value);
  const minY = values.length ? Math.min(...values) : 0;
  const maxY = values.length ? Math.max(...values) : 1;

  /* ============================================================
     SCALES (TIME-BASED — CRITICAL FIX)
  ============================================================ */
  const xByTime = (ts) =>
    PAD + ((ts - minX) / (maxX - minX || 1)) * (W - PAD * 2);

  const yByValue = (v) =>
    H - PAD - ((v - minY) / (maxY - minY || 1)) * (H - PAD * 2);

  /* ============================================================
     LINE PATH (USES SAME POINTS AS DOTS)
  ============================================================ */
  const linePath =
    points.length > 1
      ? points
          .map(
            (p, i) =>
              `${i === 0 ? "M" : "L"} ${xByTime(p.ts)} ${yByValue(p.value)}`
          )
          .join(" ")
      : "";

  const areaPath = linePath
    ? `${linePath} L ${xByTime(maxX)} ${H - PAD} L ${xByTime(
        minX
      )} ${H - PAD} Z`
    : "";

  /* ============================================================
     RENDER
  ============================================================ */
  return (
    <div style={page}>
      <button onClick={() => navigate(-1)} style={backBtn}>
        ← Back
      </button>

      <div style={title}>Smart Analytics</div>

      <div style={tabs}>
        {["bodyweight", "measurements", "prs"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              ...tabBtn,
              background: tab === t ? "#ff2f2f" : "rgba(255,255,255,0.04)",
            }}
          >
            {t === "bodyweight" ? "Bodyweight" : t === "prs" ? "PRs" : "Measurements"}
          </button>
        ))}
      </div>

      {tab === "bodyweight" && (
        <div style={card}>
          {loading ? (
            <p style={{ opacity: 0.7 }}>Loading bodyweight…</p>
          ) : (
            <>
              <div style={label}>Current Bodyweight</div>
              <div style={big}>{latestWeight} lb</div>

              <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
                {/* Y AXIS */}
                <text x={6} y={PAD} fontSize="10" fill="#aaa">
                  {maxY} lb
                </text>
                <text x={6} y={H - PAD} fontSize="10" fill="#aaa">
                  {minY} lb
                </text>

                {/* AREA + LINE */}
                {areaPath && <path d={areaPath} fill="rgba(255,47,47,0.18)" />}
                {linePath && (
                  <path d={linePath} fill="none" stroke="#ff2f2f" strokeWidth="3" />
                )}

                {/* DOTS */}
                {points.map((p, i) => {
                  const cx = xByTime(p.ts);
                  const cy = yByValue(p.value);
                  const isLatest = i === points.length - 1;

                  return (
                    <g key={i}>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={12}
                        fill="transparent"
                        onClick={() => setActivePoint({ ...p, cx, cy })}
                      />
                      <circle
                        cx={cx}
                        cy={cy}
                        r={6}
                        fill={isLatest ? "#2ecc71" : "#ff2f2f"}
                      />
                    </g>
                  );
                })}

                {/* TOOLTIP */}
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
                      {activePoint.date.toLocaleDateString()}
                    </text>
                  </g>
                )}
              </svg>

              {/* CHRONOLOGICAL LIST (NEW → OLD) */}
              <div style={{ marginTop: 14 }}>
                {[...points].reverse().map((p, i) => (
                  <div key={i} style={row}>
                    <span>{p.date.toLocaleDateString()}</span>
                    <strong>{p.value} lb</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab !== "bodyweight" && (
        <div style={{ ...card, opacity: 0.6 }}>
          Coming next…
        </div>
      )}
    </div>
  );
}

/* ============================================================
   STYLES
============================================================ */
const page = {
  minHeight: "100vh",
  background: "#0b0b0f",
  color: "#fff",
  padding: 16,
};

const backBtn = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.15)",
  color: "#fff",
  padding: "10px 12px",
  borderRadius: 12,
};

const title = { marginTop: 14, fontSize: 22, fontWeight: 900 };
const tabs = { display: "flex", gap: 10, marginTop: 14 };
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

const label = { fontSize: 13, opacity: 0.75 };
const big = { fontSize: 34, fontWeight: 900, marginBottom: 12 };

const row = {
  display: "flex",
  justifyContent: "space-between",
  padding: "8px 0",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};
