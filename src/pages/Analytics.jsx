// src/pages/Analytics.jsx
// ============================================================
// ARM PAL — SMART ANALYTICS (BODYWEIGHT + ZOOM / PAN)
// FULL FILE REPLACEMENT — STABLE
// ============================================================

import React, { useEffect, useState, useMemo, useRef } from "react";
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
     CANONICAL DATA
  ============================================================ */
  const points = useMemo(() => {
    return weights.map((w) => ({
      date: new Date(w.logged_at),
      ts: new Date(w.logged_at).getTime(),
      value: w.weight,
    }));
  }, [weights]);

  const fullStart = points.length ? points[0].ts : 0;
  const fullEnd = points.length ? points[points.length - 1].ts : 1;

  /* ============================================================
     ZOOM STATE (TIME WINDOW)
  ============================================================ */
  const [viewStart, setViewStart] = useState(fullStart);
  const [viewEnd, setViewEnd] = useState(fullEnd);

  useEffect(() => {
    setViewStart(fullStart);
    setViewEnd(fullEnd);
  }, [fullStart, fullEnd]);

  const zoomRef = useRef(null);
  const lastTouchDist = useRef(null);
  const lastPanX = useRef(null);

  /* ============================================================
     FILTERED POINTS IN VIEW
  ============================================================ */
  const visiblePoints = points.filter(
    (p) => p.ts >= viewStart && p.ts <= viewEnd
  );

  const values = visiblePoints.map((p) => p.value);
  const minY = values.length ? Math.min(...values) : 0;
  const maxY = values.length ? Math.max(...values) : 1;

  /* ============================================================
     SCALES
  ============================================================ */
  const xByTime = (ts) =>
    PAD + ((ts - viewStart) / (viewEnd - viewStart || 1)) * (W - PAD * 2);

  const yByValue = (v) =>
    H - PAD - ((v - minY) / (maxY - minY || 1)) * (H - PAD * 2);

  /* ============================================================
     LINE PATH
  ============================================================ */
  const linePath =
    visiblePoints.length > 1
      ? visiblePoints
          .map(
            (p, i) =>
              `${i === 0 ? "M" : "L"} ${xByTime(p.ts)} ${yByValue(p.value)}`
          )
          .join(" ")
      : "";

  const areaPath = linePath
    ? `${linePath} L ${xByTime(viewEnd)} ${H - PAD} L ${xByTime(
        viewStart
      )} ${H - PAD} Z`
    : "";

  /* ============================================================
     ZOOM + PAN HANDLERS
  ============================================================ */
  function onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1.1 : 0.9;
    zoom(delta);
  }

  function zoom(factor) {
    const center = (viewStart + viewEnd) / 2;
    let span = (viewEnd - viewStart) * factor;

    const minSpan = 1000 * 60 * 60 * 24 * 2; // 2 days
    const maxSpan = fullEnd - fullStart;

    span = Math.max(minSpan, Math.min(span, maxSpan));

    let start = center - span / 2;
    let end = center + span / 2;

    if (start < fullStart) {
      start = fullStart;
      end = start + span;
    }
    if (end > fullEnd) {
      end = fullEnd;
      start = end - span;
    }

    setViewStart(start);
    setViewEnd(end);
  }

  function onMouseDown(e) {
    lastPanX.current = e.clientX;
  }

  function onMouseMove(e) {
    if (lastPanX.current == null) return;
    const dx = e.clientX - lastPanX.current;
    pan(dx);
    lastPanX.current = e.clientX;
  }

  function onMouseUp() {
    lastPanX.current = null;
  }

  function pan(dx) {
    const span = viewEnd - viewStart;
    const shift = (-dx / (W - PAD * 2)) * span;

    let start = viewStart + shift;
    let end = viewEnd + shift;

    if (start < fullStart) {
      start = fullStart;
      end = start + span;
    }
    if (end > fullEnd) {
      end = fullEnd;
      start = end - span;
    }

    setViewStart(start);
    setViewEnd(end);
  }

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

              <svg
                width="100%"
                viewBox={`0 0 ${W} ${H}`}
                ref={zoomRef}
                onWheel={onWheel}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                style={{ cursor: "grab" }}
              >
                <text x={6} y={PAD} fontSize="10" fill="#aaa">
                  {maxY} lb
                </text>
                <text x={6} y={H - PAD} fontSize="10" fill="#aaa">
                  {minY} lb
                </text>

                {areaPath && <path d={areaPath} fill="rgba(255,47,47,0.18)" />}
                {linePath && (
                  <path d={linePath} fill="none" stroke="#ff2f2f" strokeWidth="3" />
                )}

                {visiblePoints.map((p, i) => {
                  const cx = xByTime(p.ts);
                  const cy = yByValue(p.value);
                  const isLatest = p.ts === fullEnd;

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
            </>
          )}
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
