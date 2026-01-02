// src/pages/MeasurementAnalytics.jsx
// ============================================================
// ARM PAL — MEASUREMENT ANALYTICS (MULTI‑SELECT OVERLAY)
// FULL FILE — SEPARATE PAGE (DOES NOT TOUCH Analytics.jsx)
// ============================================================
// FEATURES
// - Multi‑select measurements (any number)
// - Each selection renders its own line + dots
// - Color‑coded lines (1st = red, then blue, green, purple, orange…)
// - Reuses TRUE CAMERA ZOOM (pinch to zoom, drag to pan)
// - Works with existing public.measurements schema
// - Bottom list updates based on selected measurements
// ============================================================

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

/* ============================================================
   COLOR PALETTE (ORDER MATTERS)
============================================================ */
const LINE_COLORS = [
  "#ff2f2f", // red (ArmPal primary)
  "#3b82f6", // blue
  "#22c55e", // green
  "#a855f7", // purple
  "#f97316", // orange
  "#06b6d4", // cyan
];

export default function MeasurementAnalytics() {
  const navigate = useNavigate();

  /* ============================================================
     STATE
  ============================================================ */
  const [loading, setLoading] = useState(true);
  const [allRows, setAllRows] = useState([]); // raw measurements
  const [names, setNames] = useState([]); // distinct measurement names
  const [selected, setSelected] = useState([]); // selected measurement names
  const [activePoint, setActivePoint] = useState(null);

  /* ============================================================
     GRAPH CONSTANTS
  ============================================================ */
  const GRAPH_W = 360;
  const GRAPH_H = 220;
  const PAD = 44;

  /* ============================================================
     SVG + CAMERA REFS (SAME ENGINE AS BODYWEIGHT)
  ============================================================ */
  const svgRef = useRef(null);
  const cameraGroupRef = useRef(null);

  const camRef = useRef({ scale: 1, tx: 0, ty: 0 });
  const pinchRef = useRef({ active: false, lastDist: null, ax: 0, ay: 0 });
  const panRef = useRef({ active: false, lastX: null, lastY: null });

  /* ============================================================
     LOAD MEASUREMENTS
  ============================================================ */
  useEffect(() => {
    loadMeasurements();
  }, []);

  async function loadMeasurements() {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setAllRows([]);
      setNames([]);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("measurements")
      .select("id, name, value, unit, date")
      .eq("user_id", user.id)
      .order("date", { ascending: true });

    const rows = data || [];
    setAllRows(rows);

    const distinctNames = [...new Set(rows.map(r => r.name).filter(Boolean))];
    setNames(distinctNames);

    setLoading(false);
    resetCamera();
  }

  /* ============================================================
     GROUP DATA BY NAME
  ============================================================ */
  const grouped = useMemo(() => {
    const map = {};
    for (const row of allRows) {
      if (!row.name || !selected.includes(row.name)) continue;
      if (!map[row.name]) map[row.name] = [];
      map[row.name].push({
        ts: new Date(row.date).getTime(),
        date: new Date(row.date),
        value: Number(row.value),
        unit: row.unit || "",
      });
    }
    return map;
  }, [allRows, selected]);

  /* ============================================================
     DOMAIN (ALL SELECTED SERIES)
  ============================================================ */
  const allPoints = useMemo(() => {
    return Object.values(grouped).flat();
  }, [grouped]);

  const minTs = useMemo(() => {
    if (!allPoints.length) return Date.now();
    return Math.min(...allPoints.map(p => p.ts));
  }, [allPoints]);

  const maxTs = useMemo(() => {
    if (!allPoints.length) return Date.now() + 1;
    return Math.max(...allPoints.map(p => p.ts));
  }, [allPoints]);

  const minVal = useMemo(() => {
    if (!allPoints.length) return 0;
    return Math.min(...allPoints.map(p => p.value));
  }, [allPoints]);

  const maxVal = useMemo(() => {
    if (!allPoints.length) return 1;
    return Math.max(...allPoints.map(p => p.value));
  }, [allPoints]);

  const yPad = useMemo(() => {
    const span = maxVal - minVal;
    return span * 0.15 || 1;
  }, [minVal, maxVal]);

  /* ============================================================
     SCALE HELPERS
  ============================================================ */
  function xByTime(ts) {
    const d = maxTs - minTs || 1;
    return PAD + ((ts - minTs) / d) * (GRAPH_W - PAD * 2);
  }

  function yByValue(v) {
    const dMin = minVal - yPad;
    const dMax = maxVal + yPad;
    const d = dMax - dMin || 1;
    return GRAPH_H - PAD - ((v - dMin) / d) * (GRAPH_H - PAD * 2);
  }

  /* ============================================================
     PATHS PER SERIES
  ============================================================ */
  const paths = useMemo(() => {
    const out = {};
    Object.entries(grouped).forEach(([name, pts]) => {
      if (pts.length < 2) return;
      let d = "";
      pts.forEach((p, i) => {
        const x = xByTime(p.ts);
        const y = yByValue(p.value);
        d += `${i === 0 ? "M" : "L"} ${x} ${y} `;
      });
      out[name] = d.trim();
    });
    return out;
  }, [grouped, minTs, maxTs, minVal, maxVal, yPad]);

  /* ============================================================
     CAMERA HELPERS
  ============================================================ */
  function clamp(v, min, max) {
    return Math.min(Math.max(v, min), max);
  }

  function applyCamera() {
    const cam = camRef.current;
    cam.scale = clamp(cam.scale, 1, 8);

    if (cam.scale <= 1.01) {
      cam.scale = 1;
      cam.tx = 0;
      cam.ty = 0;
    }

    const vw = GRAPH_W;
    const vh = GRAPH_H;
    const cw = GRAPH_W * cam.scale;
    const ch = GRAPH_H * cam.scale;

    cam.tx = clamp(cam.tx, vw - cw, 0);
    cam.ty = clamp(cam.ty, vh - ch, 0);

    cameraGroupRef.current.setAttribute(
      "transform",
      `translate(${cam.tx}, ${cam.ty}) scale(${cam.scale})`
    );
  }

  function resetCamera() {
    camRef.current = { scale: 1, tx: 0, ty: 0 };
    if (cameraGroupRef.current) applyCamera();
  }

  function clientToSvg(x, y) {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = x; pt.y = y;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  /* ============================================================
     TOUCH HANDLERS
  ============================================================ */
  function onTouchStart(e) {
    if (e.touches.length === 2) {
      const [a, b] = e.touches;
      const dx = a.clientX - b.clientX;
      const dy = a.clientY - b.clientY;
      const dist = Math.hypot(dx, dy);
      const midX = (a.clientX + b.clientX) / 2;
      const midY = (a.clientY + b.clientY) / 2;
      const p = clientToSvg(midX, midY);
      pinchRef.current = { active: true, lastDist: dist, ax: p.x, ay: p.y };
      panRef.current.active = false;
    }
    if (e.touches.length === 1) {
      panRef.current = { active: true, lastX: e.touches[0].clientX, lastY: e.touches[0].clientY };
      pinchRef.current.active = false;
    }
  }

  function onTouchMove(e) {
    e.preventDefault();

    if (e.touches.length === 2 && pinchRef.current.active) {
      const [a, b] = e.touches;
      const dx = a.clientX - b.clientX;
      const dy = a.clientY - b.clientY;
      const dist = Math.hypot(dx, dy);
      let factor = dist / pinchRef.current.lastDist;
      factor = clamp(factor, 0.92, 1.08);

      const cam = camRef.current;
      cam.tx = pinchRef.current.ax - factor * (pinchRef.current.ax - cam.tx);
      cam.ty = pinchRef.current.ay - factor * (pinchRef.current.ay - cam.ty);
      cam.scale *= factor;

      pinchRef.current.lastDist = dist;
      applyCamera();
    }

    if (e.touches.length === 1 && panRef.current.active && camRef.current.scale > 1.01) {
      const curr = clientToSvg(e.touches[0].clientX, e.touches[0].clientY);
      const prev = clientToSvg(panRef.current.lastX, panRef.current.lastY);
      camRef.current.tx += curr.x - prev.x;
      camRef.current.ty += curr.y - prev.y;
      panRef.current.lastX = e.touches[0].clientX;
      panRef.current.lastY = e.touches[0].clientY;
      applyCamera();
    }
  }

  function onTouchEnd() {
    pinchRef.current.active = false;
    panRef.current.active = false;
  }

  /* ============================================================
     RENDER
  ============================================================ */
  return (
    <div style={{ minHeight: "100vh", background: "#0b0b0f", color: "#fff", padding: 16 }}>
      <button onClick={() => navigate(-1)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", padding: "10px 12px", borderRadius: 12 }}>← Back</button>
      <div style={{ marginTop: 14, fontSize: 22, fontWeight: 900 }}>Measurement Analytics</div>

      {/* SELECTOR */}
      <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
        {names.map((n) => {
          const on = selected.includes(n);
          return (
            <button
              key={n}
              onClick={() => {
                setSelected(prev => on ? prev.filter(x => x !== n) : [...prev, n]);
                setActivePoint(null);
                resetCamera();
              }}
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.15)",
                background: on ? "#ff2f2f" : "rgba(255,255,255,0.05)",
                color: "#fff",
                fontWeight: 800,
                fontSize: 12,
              }}
            >
              {n}
            </button>
          );
        })}
      </div>

      {/* GRAPH */}
      <div style={{ marginTop: 14, padding: 12, borderRadius: 18, border: "1px solid rgba(255,255,255,0.10)", background: "#101014" }}>
        {loading ? (
          <p style={{ opacity: 0.7 }}>Loading measurements…</p>
        ) : selected.length === 0 ? (
          <div style={{ opacity: 0.6, fontSize: 14 }}>Select measurements to display</div>
        ) : (
          <>
            <button onClick={resetCamera} style={{ marginBottom: 8, padding: "6px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 800 }}>Reset</button>
            <svg ref={svgRef} width="100%" viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} style={{ touchAction: "none" }}>
              <g ref={cameraGroupRef}>
                {Object.entries(grouped).map(([name, pts], idx) => (
                  <g key={name}>
                    {paths[name] && <path d={paths[name]} fill="none" stroke={LINE_COLORS[idx % LINE_COLORS.length]} strokeWidth="3" />}
                    {pts.map((p, i) => (
                      <circle key={i} cx={xByTime(p.ts)} cy={yByValue(p.value)} r={6} fill={LINE_COLORS[idx % LINE_COLORS.length]} />
                    ))}
                  </g>
                ))}
              </g>
            </svg>
          </>
        )}
      </div>

      {/* LIST */}
      {selected.length > 0 && (
        <div style={{ marginTop: 14, borderRadius: 18, border: "1px solid rgba(255,255,255,0.10)", background: "#101014" }}>
          {[...allPoints].sort((a, b) => b.ts - a.ts).map((p, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div>{p.date.toLocaleDateString()}</div>
              <div style={{ fontWeight: 900 }}>{p.value} {p.unit}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
