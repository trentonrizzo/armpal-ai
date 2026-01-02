// src/pages/Analytics.jsx
// ============================================================
// ARM PAL — SMART ANALYTICS (BODYWEIGHT + TRUE MIDPOINT PINCH ZOOM)
// FULL FILE REPLACEMENT — STABLE, MOBILE-CORRECT
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
    const { data: { user } } = await supabase.auth.getUser();
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
     CANONICAL POINTS (OLD → NEW)
  ============================================================ */
  const points = useMemo(() => {
    return weights.map((w) => {
      const d = new Date(w.logged_at);
      return {
        date: d,
        ts: d.getTime(),
        value: w.weight,
      };
    });
  }, [weights]);

  const fullStart = points.length ? points[0].ts : 0;
  const fullEnd = points.length ? points[points.length - 1].ts : 1;

  /* ============================================================
     VIEW WINDOW (ZOOM DOMAIN)
  ============================================================ */
  const [viewStart, setViewStart] = useState(fullStart);
  const [viewEnd, setViewEnd] = useState(fullEnd);

  useEffect(() => {
    setViewStart(fullStart);
    setViewEnd(fullEnd);
  }, [fullStart, fullEnd]);

  const svgRef = useRef(null);

  /* ============================================================
     ZOOM STATE (ANCHOR LOCK)
  ============================================================ */
  const pinchAnchorTs = useRef(null);
  const pinchAnchorRatio = useRef(0.5);
  const lastPinchDist = useRef(null);
  const lastPanX = useRef(null);

  const MAX_SPAN = Math.max(1, fullEnd - fullStart);
  const MIN_SPAN = Math.min(
    MAX_SPAN,
    1000 * 60 * 60 * 24 * 2 // 2 days
  );

  /* ============================================================
     HELPERS
  ============================================================ */
  function clampWindow(start, end) {
    let s = start;
    let e = end;
    let span = e - s;

    if (span < MIN_SPAN) {
      const c = s + (e - s) * pinchAnchorRatio.current;
      s = c - MIN_SPAN * pinchAnchorRatio.current;
      e = s + MIN_SPAN;
      span = e - s;
    }

    if (span > MAX_SPAN) {
      s = fullStart;
      e = fullEnd;
      span = e - s;
    }

    if (s < fullStart) {
      s = fullStart;
      e = s + span;
    }
    if (e > fullEnd) {
      e = fullEnd;
      s = e - span;
    }

    setViewStart(s);
    setViewEnd(e);
  }

  function getSvgX(clientX) {
    const el = svgRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    return (x / rect.width) * W;
  }

  function tsFromSvgX(vx) {
    const t = (vx - PAD) / Math.max(1, W - PAD * 2);
    const clamped = Math.max(0, Math.min(1, t));
    return viewStart + clamped * (viewEnd - viewStart);
  }

  function distance(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /* ============================================================
     VISIBLE POINTS + Y STABILITY
  ============================================================ */
  const visiblePoints = useMemo(
    () => points.filter((p) => p.ts >= viewStart && p.ts <= viewEnd),
    [points, viewStart, viewEnd]
  );

  const values = visiblePoints.map((p) => p.value);
  const rawMinY = values.length ? Math.min(...values) : 0;
  const rawMaxY = values.length ? Math.max(...values) : 1;
  const padY = Math.max(1, (rawMaxY - rawMinY) * 0.15);
  const minY = rawMinY - padY;
  const maxY = rawMaxY + padY;

  /* ============================================================
     SCALES
  ============================================================ */
  const xByTime = (ts) =>
    PAD + ((ts - viewStart) / (viewEnd - viewStart || 1)) * (W - PAD * 2);

  const yByValue = (v) =>
    H - PAD - ((v - minY) / (maxY - minY || 1)) * (H - PAD * 2);

  /* ============================================================
     PATHS
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
     TOUCH: TRUE MIDPOINT-ANCHORED PINCH
  ============================================================ */
  function onTouchStart(e) {
    if (e.touches.length === 2) {
      const d = distance(e.touches[0], e.touches[1]);
      lastPinchDist.current = d;

      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const vx = getSvgX(midX);
      const anchorTs =
        vx == null ? (viewStart + viewEnd) / 2 : tsFromSvgX(vx);

      pinchAnchorTs.current = anchorTs;
      pinchAnchorRatio.current =
        (anchorTs - viewStart) / Math.max(1, viewEnd - viewStart);

      lastPanX.current = null;
    }

    if (e.touches.length === 1) {
      lastPanX.current = e.touches[0].clientX;
      lastPinchDist.current = null;
    }
  }

  function onTouchMove(e) {
    e.preventDefault();

    if (e.touches.length === 2 && lastPinchDist.current != null) {
      const d = distance(e.touches[0], e.touches[1]);
      const prev = lastPinchDist.current;

      const factor = Math.max(0.9, Math.min(1.1, prev / d));
      const span = viewEnd - viewStart;
      const newSpan = span * factor;

      const anchor = pinchAnchorTs.current ?? (viewStart + viewEnd) / 2;
      const ratio = pinchAnchorRatio.current ?? 0.5;

      const s = anchor - newSpan * ratio;
      const e2 = s + newSpan;

      clampWindow(s, e2);
      lastPinchDist.current = d;
      return;
    }

    if (e.touches.length === 1 && lastPanX.current != null) {
      if (viewEnd - viewStart >= MAX_SPAN) return;
      const dx = e.touches[0].clientX - lastPanX.current;
      const span = viewEnd - viewStart;
      const shift = (-dx / Math.max(1, W - PAD * 2)) * span;
      clampWindow(viewStart + shift, viewEnd + shift);
      lastPanX.current = e.touches[0].clientX;
    }
  }

  function onTouchEnd() {
    lastPinchDist.current = null;
    lastPanX.current = null;
    pinchAnchorTs.current = null;
  }

  /* ============================================================
     DESKTOP SUPPORT (SAFE)
  ============================================================ */
  const lastMouseX = useRef(null);

  function onMouseDown(e) {
    lastMouseX.current = e.clientX;
  }

  function onMouseMove(e) {
    if (lastMouseX.current == null) return;
    if (viewEnd - viewStart >= MAX_SPAN) return;
    const dx = e.clientX - lastMouseX.current;
    const span = viewEnd - viewStart;
    const shift = (-dx / Math.max(1, W - PAD * 2)) * span;
    clampWindow(viewStart + shift, viewEnd + shift);
    lastMouseX.current = e.clientX;
  }

  function onMouseUp() {
    lastMouseX.current = null;
  }

  function onWheel(e) {
    e.preventDefault();
    const vx = getSvgX(e.clientX);
    const anchor =
      vx == null ? (viewStart + viewEnd) / 2 : tsFromSvgX(vx);
    const ratio = (anchor - viewStart) / Math.max(1, viewEnd - viewStart);
    pinchAnchorTs.current = anchor;
    pinchAnchorRatio.current = ratio;

    const factor = e.deltaY > 0 ? 1.08 : 0.92;
    const span = viewEnd - viewStart;
    const newSpan = span * factor;
    const s = anchor - newSpan * ratio;
    const e2 = s + newSpan;
    clampWindow(s, e2);
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

              <div style={zoomRow}>
                <button
                  style={zoomBtn}
                  onClick={() => {
                    const c = (viewStart + viewEnd) / 2;
                    const s = viewEnd - viewStart;
                    clampWindow(c - s * 0.45, c + s * 0.45);
                  }}
                >
                  +
                </button>
                <button
                  style={zoomBtn}
                  onClick={() => {
                    const c = (viewStart + viewEnd) / 2;
                    const s = viewEnd - viewStart;
                    clampWindow(c - s * 0.6, c + s * 0.6);
                  }}
                >
                  –
                </button>
                <button
                  style={resetBtn}
                  onClick={() => {
                    setActivePoint(null);
                    setViewStart(fullStart);
                    setViewEnd(fullEnd);
                  }}
                >
                  Reset
                </button>

                <div style={zoomHint}>Pinch to zoom • Drag to pan</div>
              </div>

              <svg
                ref={svgRef}
                width="100%"
                viewBox={`0 0 ${W} ${H}`}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                onWheel={onWheel}
                style={{ touchAction: "none", userSelect: "none" }}
              >
                <text x={6} y={PAD} fontSize="10" fill="#aaa">
                  {Math.round(maxY)} lb
                </text>
                <text x={6} y={H - PAD} fontSize="10" fill="#aaa">
                  {Math.round(minY)} lb
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
const zoomRow = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 10,
};
const zoomBtn = {
  width: 40,
  height: 36,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  fontWeight: 900,
  fontSize: 18,
};
const resetBtn = {
  height: 36,
  padding: "0 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  fontWeight: 800,
};
const zoomHint = {
  marginLeft: "auto",
  fontSize: 11,
  color: "rgba(255,255,255,0.55)",
  fontWeight: 700,
};
const row = {
  display: "flex",
  justifyContent: "space-between",
  padding: "8px 0",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};
