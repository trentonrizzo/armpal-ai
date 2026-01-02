// src/pages/Analytics.jsx
// ============================================================
// ARM PAL — SMART ANALYTICS
// BODYWEIGHT + MEASUREMENTS + PRs (ALL WIRED)
// FULL FILE REPLACEMENT — LONG FORM (NO CRAMMING)
// ============================================================
// BODYWEIGHT TAB:
// ✅ Bodyweight chart renders with clean ArmPal look
// ✅ Points are chronological (left→right)
// ✅ Line follows dots perfectly
// ✅ Gold dot shows FUTURE bodyweight goal (target_date)
// ✅ Bottom list shows newest→oldest entries
// ✅ TRUE CAMERA ZOOM (pinch)
// ✅ TRUE PAN (drag) when zoomed
// ✅ No invisible ceiling — vertical pan works
// ✅ Reset returns to default view
//
// MEASUREMENTS TAB:
// ✅ Multi-select any number of measurement names
// ✅ Each selection renders its own line + dots (color cycled)
// ✅ Same TRUE CAMERA engine
// ✅ Bottom list updates based on selected
//
// PRs TAB:
// ✅ Mirrors Measurements analytics 1:1
// ✅ Multi-select lift_name(s)
// ✅ Y-axis = weight (higher = higher)
// ✅ X-axis = date
// ✅ Line only if 2+ points for that lift
// ✅ Same TRUE CAMERA engine + tooltips + bottom list
//
// NOTE: PRs table is public."PRs" with fields:
// id, user_id, lift_name, weight, unit, date, reps, notes, order_index
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

/* ============================================================
   COLOR PALETTES
============================================================ */
const SERIES_COLORS = [
  "#ff2f2f", // ArmPal red
  "#3b82f6", // blue
  "#22c55e", // green
  "#a855f7", // purple
  "#f97316", // orange
  "#06b6d4", // cyan
];

/* ============================================================
   SHARED SMALL HELPERS
============================================================ */
function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

function safeNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function safeText(t) {
  if (t === null || t === undefined) return "";
  return String(t);
}

function formatDateMaybe(d) {
  try {
    if (!d) return "";
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}

/* ============================================================
   MEASUREMENTS TAB PANEL (EMBEDDED)
   - This is NOT a separate page.
   - It renders inside Analytics tabs.
============================================================ */
function MeasurementsTabPanel() {
  /* ============================
     STATE
  ============================ */
  const [loading, setLoading] = useState(true);
  const [allRows, setAllRows] = useState([]);
  const [names, setNames] = useState([]);
  const [selected, setSelected] = useState([]);
  const [activePoint, setActivePoint] = useState(null);

  /* ============================
     GRAPH CONSTANTS
  ============================ */
  const GRAPH_W = 360;
  const GRAPH_H = 220;
  const PAD = 44;

  /* ============================
     SVG + CAMERA REFS
  ============================ */
  const svgRef = useRef(null);
  const cameraGroupRef = useRef(null);

  const camRef = useRef({ scale: 1, tx: 0, ty: 0 });
  const pinchRef = useRef({ active: false, lastDist: null, ax: 0, ay: 0 });
  const panRef = useRef({ active: false, lastX: null, lastY: null });

  /* ============================
     LOAD
  ============================ */
  useEffect(() => {
    loadMeasurements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMeasurements() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setAllRows([]);
      setNames([]);
      setSelected([]);
      setActivePoint(null);
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

    const distinct = [...new Set(rows.map((r) => r.name).filter(Boolean))];
    setNames(distinct);

    // Keep UX from feeling empty on first open
    if (distinct.length && selected.length === 0) {
      setSelected([distinct[0]]);
    }

    setLoading(false);

    requestAnimationFrame(() => {
      resetCamera();
    });
  }

  /* ============================
     GROUP BY NAME (selected only)
  ============================ */
  const grouped = useMemo(() => {
    const map = {};
    for (const row of allRows) {
      const nm = row?.name;
      if (!nm || !selected.includes(nm)) continue;

      if (!map[nm]) map[nm] = [];
      map[nm].push({
        ts: new Date(row.date).getTime(),
        date: new Date(row.date),
        value: safeNum(row.value, 0),
        unit: safeText(row.unit || ""),
        name: nm,
      });
    }
    return map;
  }, [allRows, selected]);

  const allPoints = useMemo(() => {
    return Object.values(grouped).flat();
  }, [grouped]);

  /* ============================
     DOMAIN (all selected)
  ============================ */
  const minTs = useMemo(() => {
    if (!allPoints.length) return Date.now();
    return Math.min(...allPoints.map((p) => p.ts));
  }, [allPoints]);

  const maxTs = useMemo(() => {
    if (!allPoints.length) return Date.now() + 1;
    return Math.max(...allPoints.map((p) => p.ts));
  }, [allPoints]);

  const minVal = useMemo(() => {
    if (!allPoints.length) return 0;
    return Math.min(...allPoints.map((p) => p.value));
  }, [allPoints]);

  const maxVal = useMemo(() => {
    if (!allPoints.length) return 1;
    return Math.max(...allPoints.map((p) => p.value));
  }, [allPoints]);

  const yPad = useMemo(() => {
    const span = maxVal - minVal;
    return span * 0.15 || 1;
  }, [minVal, maxVal]);

  /* ============================
     SCALE HELPERS
  ============================ */
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

  /* ============================
     PATHS PER SERIES
  ============================ */
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

  /* ============================
     CAMERA ENGINE
  ============================ */
  function applyCamera() {
    if (!cameraGroupRef.current) return;

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

    const minTx = vw - cw;
    const maxTx = 0;
    const minTy = vh - ch;
    const maxTy = 0;

    cam.tx = clamp(cam.tx, minTx, maxTx);
    cam.ty = clamp(cam.ty, minTy, maxTy);

    cameraGroupRef.current.setAttribute(
      "transform",
      `translate(${cam.tx}, ${cam.ty}) scale(${cam.scale})`
    );
  }

  function resetCamera() {
    camRef.current = { scale: 1, tx: 0, ty: 0 };
    applyCamera();
  }

  function clientToSvg(x, y) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };

    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };

    const pt = svg.createSVGPoint();
    pt.x = x;
    pt.y = y;
    const sp = pt.matrixTransform(ctm.inverse());
    return { x: sp.x, y: sp.y };
  }

  /* ============================
     TOUCH HANDLERS
  ============================ */
  function onTouchStart(e) {
    if (!e.touches) return;

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
      return;
    }

    if (e.touches.length === 1) {
      panRef.current = {
        active: true,
        lastX: e.touches[0].clientX,
        lastY: e.touches[0].clientY,
      };
      pinchRef.current.active = false;
    }
  }

  function onTouchMove(e) {
    if (!e.touches) return;
    e.preventDefault();

    // PINCH
    if (e.touches.length === 2 && pinchRef.current.active) {
      const [a, b] = e.touches;
      const dx = a.clientX - b.clientX;
      const dy = a.clientY - b.clientY;
      const dist = Math.hypot(dx, dy);

      const prev = pinchRef.current.lastDist || dist;
      let factor = dist / prev;
      factor = clamp(factor, 0.92, 1.08);

      const cam = camRef.current;
      cam.tx = pinchRef.current.ax - factor * (pinchRef.current.ax - cam.tx);
      cam.ty = pinchRef.current.ay - factor * (pinchRef.current.ay - cam.ty);
      cam.scale *= factor;

      pinchRef.current.lastDist = dist;
      applyCamera();
      return;
    }

    // PAN (only when zoomed)
    if (
      e.touches.length === 1 &&
      panRef.current.active &&
      camRef.current.scale > 1.01
    ) {
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

  /* ============================
     UI HELPERS
  ============================ */
  function toggleChip(name) {
    setSelected((prev) => {
      const on = prev.includes(name);
      if (on) return prev.filter((x) => x !== name);
      return [...prev, name];
    });
    setActivePoint(null);
    requestAnimationFrame(() => resetCamera());
  }

  /* ============================
     RENDER
  ============================ */
  return (
    <div
      style={{
        marginTop: 14,
        padding: 16,
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "#101014",
      }}
    >
      <div style={{ fontSize: 13, opacity: 0.75 }}>
        Measurements (multi-select)
      </div>

      <div
        style={{
          marginTop: 6,
          fontSize: 11,
          color: "rgba(255,255,255,0.55)",
          fontWeight: 700,
        }}
      >
        Select measurements • Pinch to zoom • Drag to pan (when zoomed)
      </div>

      {/* CHIPS */}
      <div
        style={{
          marginTop: 12,
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {names.map((n) => {
          const on = selected.includes(n);
          return (
            <button
              key={n}
              onClick={() => toggleChip(n)}
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
      <div
        style={{
          marginTop: 14,
          padding: 12,
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        {loading ? (
          <p style={{ opacity: 0.7 }}>Loading measurements…</p>
        ) : selected.length === 0 ? (
          <div style={{ opacity: 0.6, fontSize: 14 }}>
            Select measurements to display
          </div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <button
                onClick={() => {
                  resetCamera();
                  setActivePoint(null);
                }}
                style={{
                  height: 36,
                  padding: "0 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#fff",
                  fontWeight: 800,
                }}
              >
                Reset
              </button>

              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.55)",
                  fontWeight: 700,
                }}
              >
                {selected.length} selected
              </div>
            </div>

            <svg
              ref={svgRef}
              width="100%"
              viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              style={{
                touchAction: "none",
                userSelect: "none",
                display: "block",
                overflow: "visible",
              }}
            >
              {/* SIMPLE Y LABELS */}
              <text x={6} y={PAD} fontSize="10" fill="#aaa">
                {Math.round(maxVal)}
              </text>
              <text x={6} y={GRAPH_H - PAD} fontSize="10" fill="#aaa">
                {Math.round(minVal)}
              </text>

              <g ref={cameraGroupRef}>
                {Object.entries(grouped).map(([name, pts], idx) => {
                  const color = SERIES_COLORS[idx % SERIES_COLORS.length];
                  return (
                    <g key={name}>
                      {paths[name] && (
                        <path
                          d={paths[name]}
                          fill="none"
                          stroke={color}
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}

                      {pts.map((p, i) => {
                        const cx = xByTime(p.ts);
                        const cy = yByValue(p.value);
                        return (
                          <g key={i}>
                            <circle
                              cx={cx}
                              cy={cy}
                              r={12}
                              fill="transparent"
                              onClick={() =>
                                setActivePoint({
                                  type: "measurement",
                                  name,
                                  value: p.value,
                                  unit: p.unit,
                                  date: p.date,
                                  cx,
                                  cy,
                                })
                              }
                            />
                            <circle cx={cx} cy={cy} r={6} fill={color} />
                          </g>
                        );
                      })}
                    </g>
                  );
                })}

                {/* TOOLTIP */}
                {activePoint && (
                  <g>
                    <rect
                      x={activePoint.cx - 78}
                      y={activePoint.cy - 76}
                      width={156}
                      height={62}
                      rx={18}
                      fill="#141418"
                      stroke="rgba(255,255,255,0.10)"
                    />
                    <text
                      x={activePoint.cx}
                      y={activePoint.cy - 52}
                      textAnchor="middle"
                      fontSize="12"
                      fill="rgba(255,255,255,0.75)"
                      fontWeight="800"
                    >
                      {activePoint.name}
                    </text>
                    <text
                      x={activePoint.cx}
                      y={activePoint.cy - 32}
                      textAnchor="middle"
                      fontSize="16"
                      fill="#fff"
                      fontWeight="900"
                    >
                      {activePoint.value} {activePoint.unit}
                    </text>
                    <text
                      x={activePoint.cx}
                      y={activePoint.cy - 16}
                      textAnchor="middle"
                      fontSize="11"
                      fill="rgba(255,255,255,0.70)"
                      fontWeight="800"
                    >
                      {formatDateMaybe(activePoint.date)}
                    </text>
                  </g>
                )}
              </g>
            </svg>
          </>
        )}
      </div>

      {/* LIST */}
      {!loading && selected.length > 0 && (
        <div
          style={{
            marginTop: 14,
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.02)",
            overflow: "hidden",
          }}
        >
          {[...allPoints]
            .sort((a, b) => b.ts - a.ts)
            .map((p, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  borderBottom:
                    i === allPoints.length - 1
                      ? "none"
                      : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ fontSize: 14, fontWeight: 900, opacity: 0.95 }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.65 }}>
                    {formatDateMaybe(p.date)}
                  </div>
                </div>

                <div style={{ fontSize: 18, fontWeight: 900 }}>
                  {p.value} {p.unit}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   PRs TAB PANEL (EMBEDDED)
   - Mirrors Measurements 1:1
   - Source: public."PRs" (Supabase: from("PRs"))
   - Series key: lift_name
   - Value: weight
============================================================ */
function PRsTabPanel() {
  /* ============================
     STATE
  ============================ */
  const [loading, setLoading] = useState(true);
  const [allRows, setAllRows] = useState([]);
  const [names, setNames] = useState([]); // distinct lift_name
  const [selected, setSelected] = useState([]); // selected lift_name
  const [activePoint, setActivePoint] = useState(null);

  /* ============================
     GRAPH CONSTANTS
  ============================ */
  const GRAPH_W = 360;
  const GRAPH_H = 220;
  const PAD = 44;

  /* ============================
     SVG + CAMERA
  ============================ */
  const svgRef = useRef(null);
  const cameraGroupRef = useRef(null);

  const camRef = useRef({ scale: 1, tx: 0, ty: 0 });
  const pinchRef = useRef({ active: false, lastDist: null, ax: 0, ay: 0 });
  const panRef = useRef({ active: false, lastX: null, lastY: null });

  /* ============================
     LOAD PRs
  ============================ */
  useEffect(() => {
    loadPRs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPRs() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setAllRows([]);
      setNames([]);
      setSelected([]);
      setActivePoint(null);
      setLoading(false);
      return;
    }

    // IMPORTANT: table name is "PRs" (capital P R)
    // Supabase is usually case-sensitive for quoted identifiers.
    const { data } = await supabase
      .from("PRs")
      .select("id, lift_name, weight, unit, date, reps, notes, order_index")
      .eq("user_id", user.id)
      .order("date", { ascending: true });

    const rows = data || [];
    setAllRows(rows);

    const distinct = [
      ...new Set(rows.map((r) => r.lift_name).filter(Boolean)),
    ];
    setNames(distinct);

    // Auto-select first lift so the tab doesn't feel empty
    if (distinct.length && selected.length === 0) {
      setSelected([distinct[0]]);
    }

    setLoading(false);

    requestAnimationFrame(() => {
      resetCamera();
    });
  }

  /* ============================
     GROUP BY lift_name (selected only)
  ============================ */
  const grouped = useMemo(() => {
    const map = {};

    for (const row of allRows) {
      const nm = row?.lift_name;
      if (!nm || !selected.includes(nm)) continue;

      if (!map[nm]) map[nm] = [];

      // date column is DATE (no time) — still safe to new Date(...)
      const d = new Date(row.date);

      map[nm].push({
        ts: d.getTime(),
        date: d,
        value: safeNum(row.weight, 0),
        unit: safeText(row.unit || "lb"),
        name: nm,
        reps: row.reps ?? null,
        notes: safeText(row.notes || ""),
      });
    }

    return map;
  }, [allRows, selected]);

  const allPoints = useMemo(() => {
    return Object.values(grouped).flat();
  }, [grouped]);

  /* ============================
     DOMAIN (all selected)
  ============================ */
  const minTs = useMemo(() => {
    if (!allPoints.length) return Date.now();
    return Math.min(...allPoints.map((p) => p.ts));
  }, [allPoints]);

  const maxTs = useMemo(() => {
    if (!allPoints.length) return Date.now() + 1;
    return Math.max(...allPoints.map((p) => p.ts));
  }, [allPoints]);

  const minVal = useMemo(() => {
    if (!allPoints.length) return 0;
    return Math.min(...allPoints.map((p) => p.value));
  }, [allPoints]);

  const maxVal = useMemo(() => {
    if (!allPoints.length) return 1;
    return Math.max(...allPoints.map((p) => p.value));
  }, [allPoints]);

  const yPad = useMemo(() => {
    const span = maxVal - minVal;
    return span * 0.15 || 5;
  }, [minVal, maxVal]);

  /* ============================
     SCALE HELPERS
  ============================ */
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

  /* ============================
     PATHS PER SERIES
  ============================ */
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

  /* ============================
     CAMERA ENGINE (same as measurements)
  ============================ */
  function applyCamera() {
    if (!cameraGroupRef.current) return;

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

    const minTx = vw - cw;
    const maxTx = 0;
    const minTy = vh - ch;
    const maxTy = 0;

    cam.tx = clamp(cam.tx, minTx, maxTx);
    cam.ty = clamp(cam.ty, minTy, maxTy);

    cameraGroupRef.current.setAttribute(
      "transform",
      `translate(${cam.tx}, ${cam.ty}) scale(${cam.scale})`
    );
  }

  function resetCamera() {
    camRef.current = { scale: 1, tx: 0, ty: 0 };
    applyCamera();
  }

  function clientToSvg(x, y) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };

    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };

    const pt = svg.createSVGPoint();
    pt.x = x;
    pt.y = y;

    const sp = pt.matrixTransform(ctm.inverse());
    return { x: sp.x, y: sp.y };
  }

  /* ============================
     TOUCH HANDLERS
  ============================ */
  function onTouchStart(e) {
    if (!e.touches) return;

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
      return;
    }

    if (e.touches.length === 1) {
      panRef.current = {
        active: true,
        lastX: e.touches[0].clientX,
        lastY: e.touches[0].clientY,
      };
      pinchRef.current.active = false;
    }
  }

  function onTouchMove(e) {
    if (!e.touches) return;
    e.preventDefault();

    // PINCH
    if (e.touches.length === 2 && pinchRef.current.active) {
      const [a, b] = e.touches;
      const dx = a.clientX - b.clientX;
      const dy = a.clientY - b.clientY;
      const dist = Math.hypot(dx, dy);

      const prev = pinchRef.current.lastDist || dist;
      let factor = dist / prev;
      factor = clamp(factor, 0.92, 1.08);

      const cam = camRef.current;
      cam.tx = pinchRef.current.ax - factor * (pinchRef.current.ax - cam.tx);
      cam.ty = pinchRef.current.ay - factor * (pinchRef.current.ay - cam.ty);
      cam.scale *= factor;

      pinchRef.current.lastDist = dist;
      applyCamera();
      return;
    }

    // PAN (only when zoomed)
    if (
      e.touches.length === 1 &&
      panRef.current.active &&
      camRef.current.scale > 1.01
    ) {
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

  /* ============================
     UI HELPERS
  ============================ */
  function toggleChip(name) {
    setSelected((prev) => {
      const on = prev.includes(name);
      if (on) return prev.filter((x) => x !== name);
      return [...prev, name];
    });

    setActivePoint(null);
    requestAnimationFrame(() => resetCamera());
  }

  /* ============================
     RENDER
  ============================ */
  return (
    <div
      style={{
        marginTop: 14,
        padding: 16,
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "#101014",
      }}
    >
      <div style={{ fontSize: 13, opacity: 0.75 }}>PRs (multi-select)</div>

      <div
        style={{
          marginTop: 6,
          fontSize: 11,
          color: "rgba(255,255,255,0.55)",
          fontWeight: 700,
        }}
      >
        Select lifts • Pinch to zoom • Drag to pan (when zoomed)
      </div>

      {/* CHIPS */}
      <div
        style={{
          marginTop: 12,
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {names.map((n) => {
          const on = selected.includes(n);
          return (
            <button
              key={n}
              onClick={() => toggleChip(n)}
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
      <div
        style={{
          marginTop: 14,
          padding: 12,
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        {loading ? (
          <p style={{ opacity: 0.7 }}>Loading PRs…</p>
        ) : selected.length === 0 ? (
          <div style={{ opacity: 0.6, fontSize: 14 }}>Select lifts to display</div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <button
                onClick={() => {
                  resetCamera();
                  setActivePoint(null);
                }}
                style={{
                  height: 36,
                  padding: "0 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#fff",
                  fontWeight: 800,
                }}
              >
                Reset
              </button>

              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.55)",
                  fontWeight: 700,
                }}
              >
                {selected.length} selected
              </div>
            </div>

            <svg
              ref={svgRef}
              width="100%"
              viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              style={{
                touchAction: "none",
                userSelect: "none",
                display: "block",
                overflow: "visible",
              }}
            >
              {/* Y LABELS */}
              <text x={6} y={PAD} fontSize="10" fill="#aaa">
                {Math.round(maxVal)}
              </text>
              <text x={6} y={GRAPH_H - PAD} fontSize="10" fill="#aaa">
                {Math.round(minVal)}
              </text>

              <g ref={cameraGroupRef}>
                {Object.entries(grouped).map(([name, pts], idx) => {
                  const color = SERIES_COLORS[idx % SERIES_COLORS.length];

                  return (
                    <g key={name}>
                      {paths[name] && (
                        <path
                          d={paths[name]}
                          fill="none"
                          stroke={color}
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}

                      {pts.map((p, i) => {
                        const cx = xByTime(p.ts);
                        const cy = yByValue(p.value);

                        return (
                          <g key={i}>
                            {/* tap target */}
                            <circle
                              cx={cx}
                              cy={cy}
                              r={12}
                              fill="transparent"
                              onClick={() =>
                                setActivePoint({
                                  type: "pr",
                                  name,
                                  value: p.value,
                                  unit: p.unit,
                                  date: p.date,
                                  reps: p.reps,
                                  notes: p.notes,
                                  cx,
                                  cy,
                                })
                              }
                            />

                            {/* dot */}
                            <circle cx={cx} cy={cy} r={6} fill={color} />
                          </g>
                        );
                      })}
                    </g>
                  );
                })}

                {/* TOOLTIP */}
                {activePoint && (
                  <g>
                    <rect
                      x={activePoint.cx - 88}
                      y={activePoint.cy - 92}
                      width={176}
                      height={78}
                      rx={18}
                      fill="#141418"
                      stroke="rgba(255,255,255,0.10)"
                    />

                    <text
                      x={activePoint.cx}
                      y={activePoint.cy - 68}
                      textAnchor="middle"
                      fontSize="12"
                      fill="rgba(255,255,255,0.75)"
                      fontWeight="800"
                    >
                      {activePoint.name}
                    </text>

                    <text
                      x={activePoint.cx}
                      y={activePoint.cy - 48}
                      textAnchor="middle"
                      fontSize="18"
                      fill="#fff"
                      fontWeight="900"
                    >
                      {activePoint.value} {activePoint.unit}
                    </text>

                    <text
                      x={activePoint.cx}
                      y={activePoint.cy - 30}
                      textAnchor="middle"
                      fontSize="11"
                      fill="rgba(255,255,255,0.70)"
                      fontWeight="800"
                    >
                      {formatDateMaybe(activePoint.date)}
                      {activePoint.reps ? ` • ${activePoint.reps} reps` : ""}
                    </text>

                    {activePoint.notes ? (
                      <text
                        x={activePoint.cx}
                        y={activePoint.cy - 16}
                        textAnchor="middle"
                        fontSize="10"
                        fill="rgba(255,255,255,0.55)"
                        fontWeight="700"
                      >
                        {activePoint.notes.length > 22
                          ? activePoint.notes.slice(0, 22) + "…"
                          : activePoint.notes}
                      </text>
                    ) : null}
                  </g>
                )}
              </g>
            </svg>
          </>
        )}
      </div>

      {/* LIST */}
      {!loading && selected.length > 0 && (
        <div
          style={{
            marginTop: 14,
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.02)",
            overflow: "hidden",
          }}
        >
          {[...allPoints]
            .sort((a, b) => b.ts - a.ts)
            .map((p, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  borderBottom:
                    i === allPoints.length - 1
                      ? "none"
                      : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ fontSize: 14, fontWeight: 900, opacity: 0.95 }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.65 }}>
                    {formatDateMaybe(p.date)}
                    {p.reps ? ` • ${p.reps} reps` : ""}
                  </div>
                </div>

                <div style={{ fontSize: 18, fontWeight: 900 }}>
                  {p.value} {p.unit}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   MAIN ANALYTICS PAGE (BODYWEIGHT)
============================================================ */
export default function Analytics() {
  const navigate = useNavigate();

  /* ============================================================
     TAB STATE
  ============================================================ */
  const [tab, setTab] = useState("bodyweight");

  /* ============================================================
     DATA STATE
  ============================================================ */
  const [weights, setWeights] = useState([]); // bodyweight_logs rows
  const [goal, setGoal] = useState(null); // goals row for type bodyweight
  const [loading, setLoading] = useState(true);

  /* ============================================================
     INTERACTION STATE
  ============================================================ */
  const [activePoint, setActivePoint] = useState(null); // tooltip

  /* ============================================================
     GRAPH CONSTANTS (VIEWBOX UNITS)
  ============================================================ */
  const GRAPH_W = 360;
  const GRAPH_H = 220;
  const PAD = 44;

  /* ============================================================
     SVG + CAMERA REFS
  ============================================================ */
  const svgRef = useRef(null);
  const cameraGroupRef = useRef(null);

  // Camera transform is kept in refs for smooth touch interaction.
  // IMPORTANT: tx/ty are in SVG viewBox units (NOT screen pixels).
  const camRef = useRef({
    scale: 1,
    tx: 0,
    ty: 0,
  });

  // Pinch tracking
  const pinchRef = useRef({
    active: false,
    lastDist: null,
    anchorSvgX: 0,
    anchorSvgY: 0,
  });

  // Pan tracking
  const panRef = useRef({
    active: false,
    lastClientX: null,
    lastClientY: null,
  });

  /* ============================================================
     LOAD DATA
  ============================================================ */
  useEffect(() => {
    if (tab === "bodyweight") {
      loadBodyweight();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function loadBodyweight() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setWeights([]);
      setGoal(null);
      setActivePoint(null);
      setLoading(false);
      return;
    }

    // Bodyweight logs
    const { data: bw } = await supabase
      .from("bodyweight_logs")
      .select("weight, logged_at")
      .eq("user_id", user.id)
      .order("logged_at", { ascending: true });

    // Bodyweight goal (optional)
    const { data: goalRow } = await supabase
      .from("goals")
      .select("target_value, target_date")
      .eq("user_id", user.id)
      .eq("type", "bodyweight")
      .maybeSingle();

    setWeights(bw || []);
    setGoal(goalRow || null);
    setActivePoint(null);
    setLoading(false);

    // Reset camera after data load (prevents "lost" view)
    requestAnimationFrame(() => {
      resetCamera();
    });
  }

  const latestWeight = weights.length ? weights[weights.length - 1].weight : null;

  /* ============================================================
     NORMALIZE DATA
  ============================================================ */
  const points = useMemo(() => {
    return (weights || []).map((w) => {
      const d = new Date(w.logged_at);
      return {
        type: "weight",
        ts: d.getTime(),
        date: d,
        value: safeNum(w.weight, 0),
      };
    });
  }, [weights]);

  const goalPoint = useMemo(() => {
    if (!goal || !goal.target_date) return null;
    const d = new Date(goal.target_date);
    if (Number.isNaN(d.getTime())) return null;
    return {
      type: "goal",
      ts: d.getTime(),
      date: d,
      value: safeNum(goal.target_value, 0),
    };
  }, [goal]);

  /* ============================================================
     STATIC DOMAIN (INCLUDES FUTURE GOAL)
  ============================================================ */
  const minTs = useMemo(() => {
    if (points.length) return points[0].ts;
    return Date.now();
  }, [points]);

  const maxTs = useMemo(() => {
    const last = points.length ? points[points.length - 1].ts : Date.now();
    const g = goalPoint ? goalPoint.ts : 0;
    return Math.max(last, g);
  }, [points, goalPoint]);

  const allVals = useMemo(() => {
    const arr = [];
    for (let i = 0; i < points.length; i++) arr.push(points[i].value);
    if (goalPoint) arr.push(goalPoint.value);
    return arr;
  }, [points, goalPoint]);

  const minVal = useMemo(() => {
    if (!allVals.length) return 0;
    return Math.min(...allVals);
  }, [allVals]);

  const maxVal = useMemo(() => {
    if (!allVals.length) return 1;
    return Math.max(...allVals);
  }, [allVals]);

  const yPad = useMemo(() => {
    const span = maxVal - minVal;
    return span * 0.15 || 5;
  }, [minVal, maxVal]);

  /* ============================================================
     SCALE HELPERS
  ============================================================ */
  function xByTime(ts) {
    const denom = maxTs - minTs || 1;
    const t = (ts - minTs) / denom;
    return PAD + t * (GRAPH_W - PAD * 2);
  }

  function yByValue(v) {
    const domainMin = minVal - yPad;
    const domainMax = maxVal + yPad;
    const denom = domainMax - domainMin || 1;
    const t = (v - domainMin) / denom;
    return GRAPH_H - PAD - t * (GRAPH_H - PAD * 2);
  }

  /* ============================================================
     PATHS
  ============================================================ */
  const linePath = useMemo(() => {
    if (points.length <= 1) return "";

    let d = "";
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const x = xByTime(p.ts);
      const y = yByValue(p.value);
      d += `${i === 0 ? "M" : "L"} ${x} ${y} `;
    }

    return d.trim();
  }, [points, minTs, maxTs, minVal, maxVal, yPad]);

  const areaPath = useMemo(() => {
    if (!linePath) return "";
    const baseY = GRAPH_H - PAD;
    const leftX = xByTime(minTs);
    const rightX = xByTime(maxTs);
    return `${linePath} L ${rightX} ${baseY} L ${leftX} ${baseY} Z`;
  }, [linePath, minTs, maxTs]);

  /* ============================================================
     X AXIS TICKS
  ============================================================ */
  const xTicks = useMemo(() => {
    const ticks = [];
    const count = 4;
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1);
      const ts = minTs + t * (maxTs - minTs);
      ticks.push({
        x: PAD + t * (GRAPH_W - PAD * 2),
        label: new Date(ts).toLocaleDateString(),
      });
    }
    return ticks;
  }, [minTs, maxTs]);

  /* ============================================================
     CLIENT → SVG COORDINATES
  ============================================================ */
  function clientToSvg(clientX, clientY) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };

    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };

    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;

    const sp = pt.matrixTransform(ctm.inverse());
    return { x: sp.x, y: sp.y };
  }

  /* ============================================================
     CAMERA: CLAMP + APPLY
  ============================================================ */
  function applyCamera() {
    if (!cameraGroupRef.current) return;

    const cam = camRef.current;

    cam.scale = clamp(cam.scale, 1, 8);

    if (cam.scale <= 1.01) {
      cam.scale = 1;
      cam.tx = 0;
      cam.ty = 0;
    }

    const viewportW = GRAPH_W;
    const viewportH = GRAPH_H;
    const contentW = GRAPH_W * cam.scale;
    const contentH = GRAPH_H * cam.scale;

    const minTx = viewportW - contentW;
    const maxTx = 0;
    const minTy = viewportH - contentH;
    const maxTy = 0;

    cam.tx = clamp(cam.tx, minTx, maxTx);
    cam.ty = clamp(cam.ty, minTy, maxTy);

    cameraGroupRef.current.setAttribute(
      "transform",
      `translate(${cam.tx}, ${cam.ty}) scale(${cam.scale})`
    );
  }

  function resetCamera() {
    camRef.current = { scale: 1, tx: 0, ty: 0 };
    applyCamera();
  }

  /* ============================================================
     TOUCH LOGIC
  ============================================================ */
  function onTouchStart(e) {
    if (!e.touches) return;

    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];

      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      const dist = Math.hypot(dx, dy);

      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;
      const anchor = clientToSvg(midX, midY);

      pinchRef.current.active = true;
      pinchRef.current.lastDist = dist;
      pinchRef.current.anchorSvgX = anchor.x;
      pinchRef.current.anchorSvgY = anchor.y;

      panRef.current.active = false;
      panRef.current.lastClientX = null;
      panRef.current.lastClientY = null;
      return;
    }

    if (e.touches.length === 1) {
      panRef.current.active = true;
      panRef.current.lastClientX = e.touches[0].clientX;
      panRef.current.lastClientY = e.touches[0].clientY;

      pinchRef.current.active = false;
      pinchRef.current.lastDist = null;
      return;
    }
  }

  function onTouchMove(e) {
    if (!e.touches) return;
    e.preventDefault();

    // PINCH
    if (e.touches.length === 2 && pinchRef.current.active) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];

      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      const dist = Math.hypot(dx, dy);

      const prev = pinchRef.current.lastDist || dist;
      let factor = dist / prev;
      factor = clamp(factor, 0.92, 1.08);

      const cam = camRef.current;
      const ax = pinchRef.current.anchorSvgX;
      const ay = pinchRef.current.anchorSvgY;

      cam.tx = ax - factor * (ax - cam.tx);
      cam.ty = ay - factor * (ay - cam.ty);
      cam.scale = cam.scale * factor;

      applyCamera();
      pinchRef.current.lastDist = dist;
      return;
    }

    // PAN (only when zoomed)
    if (e.touches.length === 1 && panRef.current.active) {
      const cam = camRef.current;

      if (cam.scale <= 1.01) {
        panRef.current.lastClientX = e.touches[0].clientX;
        panRef.current.lastClientY = e.touches[0].clientY;
        return;
      }

      const currClientX = e.touches[0].clientX;
      const currClientY = e.touches[0].clientY;

      const prevClientX = panRef.current.lastClientX;
      const prevClientY = panRef.current.lastClientY;

      const prevSvg = clientToSvg(prevClientX, prevClientY);
      const currSvg = clientToSvg(currClientX, currClientY);

      cam.tx += currSvg.x - prevSvg.x;
      cam.ty += currSvg.y - prevSvg.y;

      applyCamera();

      panRef.current.lastClientX = currClientX;
      panRef.current.lastClientY = currClientY;
    }
  }

  function onTouchEnd() {
    pinchRef.current.active = false;
    pinchRef.current.lastDist = null;

    panRef.current.active = false;
    panRef.current.lastClientX = null;
    panRef.current.lastClientY = null;
  }

  /* ============================================================
     TOOLTIP TAP
  ============================================================ */
  function onDotTap(payload) {
    setActivePoint(payload);
  }

  /* ============================================================
     RENDER
  ============================================================ */
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b0b0f",
        color: "#ffffff",
        padding: 16,
      }}
    >
      {/* BACK */}
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

      {/* TITLE */}
      <div
        style={{
          marginTop: 14,
          fontSize: 22,
          fontWeight: 900,
        }}
      >
        Smart Analytics
      </div>

      {/* TABS */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 14,
        }}
      >
        {[
          ["bodyweight", "Bodyweight"],
          ["measurements", "Measurements"],
          ["prs", "PRs"],
        ].map(([key, label]) => {
          const isActive = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#fff",
                fontWeight: 800,
                background: isActive ? "#ff2f2f" : "rgba(255,255,255,0.05)",
              }}
            >
              {label}
            </button>
          );
        })}
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
          ) : (
            <>
              {/* CURRENT */}
              <div style={{ fontSize: 13, opacity: 0.75 }}>Current Bodyweight</div>

              <div
                style={{
                  fontSize: 34,
                  fontWeight: 900,
                  marginBottom: 12,
                }}
              >
                {latestWeight} lb
              </div>

              {/* CONTROLS */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 10,
                }}
              >
                <button
                  onClick={() => {
                    resetCamera();
                    setActivePoint(null);
                  }}
                  style={{
                    height: 36,
                    padding: "0 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.06)",
                    color: "#fff",
                    fontWeight: 800,
                  }}
                >
                  Reset
                </button>

                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.55)",
                    fontWeight: 700,
                  }}
                >
                  Pinch to zoom • Drag to pan (when zoomed)
                </div>
              </div>

              {/* GRAPH CARD */}
              <div
                style={{
                  borderRadius: 18,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.02)",
                  padding: 12,
                }}
              >
                <svg
                  ref={svgRef}
                  width="100%"
                  viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`}
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                  style={{
                    touchAction: "none",
                    userSelect: "none",
                    display: "block",
                    overflow: "visible",
                  }}
                >
                  {/* Y LABELS */}
                  <text x={6} y={PAD} fontSize="10" fill="#aaa">
                    {Math.round(maxVal)} lb
                  </text>
                  <text x={6} y={GRAPH_H - PAD} fontSize="10" fill="#aaa">
                    {Math.round(minVal)} lb
                  </text>

                  {/* X TICKS */}
                  {xTicks.map((t, i) => (
                    <text
                      key={i}
                      x={t.x}
                      y={GRAPH_H - 10}
                      textAnchor="middle"
                      fontSize="9"
                      fill="#aaa"
                    >
                      {t.label}
                    </text>
                  ))}

                  {/* CAMERA GROUP */}
                  <g id="camera-layer" ref={cameraGroupRef}>
                    {/* AREA */}
                    {areaPath && <path d={areaPath} fill="rgba(255,47,47,0.18)" />}

                    {/* LINE */}
                    {linePath && (
                      <path
                        d={linePath}
                        fill="none"
                        stroke="#ff2f2f"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
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
                            onClick={() =>
                              onDotTap({
                                type: "weight",
                                value: p.value,
                                date: p.date,
                                cx,
                                cy,
                              })
                            }
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

                    {/* GOAL DOT */}
                    {goalPoint && (
                      <g>
                        <circle
                          cx={xByTime(goalPoint.ts)}
                          cy={yByValue(goalPoint.value)}
                          r={9}
                          fill="#f5c542"
                          onClick={() =>
                            onDotTap({
                              type: "goal",
                              value: goalPoint.value,
                              date: goalPoint.date,
                              cx: xByTime(goalPoint.ts),
                              cy: yByValue(goalPoint.value),
                            })
                          }
                        />
                      </g>
                    )}

                    {/* TOOLTIP */}
                    {activePoint && (
                      <g>
                        <rect
                          x={activePoint.cx - 64}
                          y={activePoint.cy - 70}
                          width={128}
                          height={54}
                          rx={18}
                          fill="#141418"
                          stroke="rgba(255,255,255,0.10)"
                        />
                        <text
                          x={activePoint.cx}
                          y={activePoint.cy - 44}
                          textAnchor="middle"
                          fontSize="16"
                          fill="#fff"
                          fontWeight="900"
                        >
                          {activePoint.value} lb
                        </text>
                        <text
                          x={activePoint.cx}
                          y={activePoint.cy - 24}
                          textAnchor="middle"
                          fontSize="11"
                          fill="rgba(255,255,255,0.70)"
                          fontWeight="800"
                        >
                          {activePoint.type === "goal"
                            ? `Goal • ${formatDateMaybe(activePoint.date)}`
                            : formatDateMaybe(activePoint.date)}
                        </text>
                      </g>
                    )}
                  </g>
                </svg>
              </div>

              {/* LIST (NEWEST → OLDEST) */}
              <div
                style={{
                  marginTop: 14,
                  borderRadius: 18,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.02)",
                  overflow: "hidden",
                }}
              >
                {[...points].reverse().map((p, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                      borderBottom:
                        i === points.length - 1
                          ? "none"
                          : "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: "rgba(255,255,255,0.90)",
                      }}
                    >
                      {formatDateMaybe(p.date)}
                    </div>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 900,
                        letterSpacing: 0.2,
                      }}
                    >
                      {p.value} lb
                    </div>
                  </div>
                ))}
              </div>

              {/* GOAL NOTE */}
              {goalPoint && (
                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                  Goal shown in gold ({formatDateMaybe(goalPoint.date)}). Zoom out
                  to see future spacing.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* MEASUREMENTS */}
      {tab === "measurements" && <MeasurementsTabPanel />}

      {/* PRs */}
      {tab === "prs" && <PRsTabPanel />}

      {/* SPACER */}
      <div style={{ height: 40 }} />
    </div>
  );
}
