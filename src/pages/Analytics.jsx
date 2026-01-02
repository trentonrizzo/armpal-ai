// src/pages/Analytics.jsx
// ============================================================
// ARM PAL — SMART ANALYTICS
// BODYWEIGHT (NOW) + MEASUREMENTS (WIRED) + FUTURE GOAL DOT + TRUE CAMERA ZOOM
// FULL FILE REPLACEMENT — LONG FORM (NO CRAMMED STYLE BLOCKS)
// ============================================================
// WHAT THIS FILE DOES:
// ✅ Bodyweight chart renders with a clean ArmPal look
// ✅ Points are chronological (left→right)
// ✅ Line follows dots perfectly
// ✅ Gold dot shows FUTURE bodyweight goal (target_date)
// ✅ Bottom list shows newest→oldest entries
// ✅ TRUE CAMERA ZOOM (pinch) — dots/line scale larger
// ✅ TRUE PAN (drag) — once zoomed, pan left/right AND up/down
// ✅ No "invisible ceiling" / border that blocks vertical movement
// ✅ Reset returns to default view
//
// ✅ Measurements tab NOW SHOWS REAL MEASUREMENT ANALYTICS (multi-select overlay)
// ✅ Uses your same TRUE CAMERA ENGINE (pinch + pan)
// ✅ Pulls from public.measurements schema
// ✅ Selector chips, multi-series lines + dots, bottom list
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
   MEASUREMENT COLOR PALETTE (ORDER MATTERS)
============================================================ */
const MEAS_LINE_COLORS = [
  "#ff2f2f", // red (ArmPal primary)
  "#3b82f6", // blue
  "#22c55e", // green
  "#a855f7", // purple
  "#f97316", // orange
  "#06b6d4", // cyan
];

/* ============================================================
   MEASUREMENTS TAB PANEL (EMBEDDED)
   - This is NOT a separate page.
   - It renders cleanly inside Analytics tabs.
============================================================ */
function MeasurementsTabPanel() {
  /* ============================================================
     STATE
  ============================================================ */
  const [loading, setLoading] = useState(true);
  const [allRows, setAllRows] = useState([]); // raw measurements
  const [names, setNames] = useState([]); // distinct measurement names
  const [selected, setSelected] = useState([]); // selected measurement names
  const [activePoint, setActivePoint] = useState(null);

  /* ============================================================
     GRAPH CONSTANTS (MATCH BODYWEIGHT)
  ============================================================ */
  const GRAPH_W = 360;
  const GRAPH_H = 220;
  const PAD = 44;

  /* ============================================================
     SVG + CAMERA REFS
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

    const distinctNames = [
      ...new Set(rows.map((r) => r.name).filter(Boolean)),
    ];
    setNames(distinctNames);

    // Optional: auto-select first measurement if none selected
    // (keeps the tab from feeling empty the first time)
    if (distinctNames.length && selected.length === 0) {
      setSelected([distinctNames[0]]);
    }

    setLoading(false);

    requestAnimationFrame(() => {
      resetCamera();
    });
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
        name: row.name,
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
     CAMERA HELPERS (MATCH BODYWEIGHT BEHAVIOR)
  ============================================================ */
  function clamp(v, min, max) {
    return Math.min(Math.max(v, min), max);
  }

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

    return pt.matrixTransform(ctm.inverse());
  }

  /* ============================================================
     TOUCH HANDLERS
  ============================================================ */
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

      pinchRef.current = {
        active: true,
        lastDist: dist,
        ax: p.x,
        ay: p.y,
      };

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

      let factor = dist / (pinchRef.current.lastDist || dist);
      factor = clamp(factor, 0.92, 1.08);

      const cam = camRef.current;

      cam.tx = pinchRef.current.ax - factor * (pinchRef.current.ax - cam.tx);
      cam.ty = pinchRef.current.ay - factor * (pinchRef.current.ay - cam.ty);
      cam.scale *= factor;

      pinchRef.current.lastDist = dist;
      applyCamera();
      return;
    }

    // PAN (ONLY WHEN ZOOMED)
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

  /* ============================================================
     RENDER HELPERS
  ============================================================ */
  function formatDate(d) {
    try {
      return d.toLocaleDateString();
    } catch {
      return "";
    }
  }

  function onChipToggle(name) {
    setSelected((prev) => {
      const on = prev.includes(name);
      if (on) return prev.filter((x) => x !== name);
      return [...prev, name];
    });
    setActivePoint(null);
    requestAnimationFrame(() => resetCamera());
  }

  /* ============================================================
     UI
  ============================================================ */
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
      {/* HEADER */}
      <div style={{ fontSize: 13, opacity: 0.75 }}>
        Measurements (multi-select)
      </div>

      <div
        style={{
          marginTop: 6,
          fontSize: 12,
          color: "rgba(255,255,255,0.55)",
          fontWeight: 700,
        }}
      >
        Select measurements • Pinch to zoom • Drag to pan (when zoomed)
      </div>

      {/* SELECTOR */}
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
              onClick={() => onChipToggle(n)}
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
              {/* BASIC LABELS */}
              <text x={6} y={PAD} fontSize="10" fill="#aaa">
                {Math.round(maxVal)}
              </text>
              <text x={6} y={GRAPH_H - PAD} fontSize="10" fill="#aaa">
                {Math.round(minVal)}
              </text>

              <g ref={cameraGroupRef}>
                {Object.entries(grouped).map(([name, pts], idx) => {
                  const color = MEAS_LINE_COLORS[idx % MEAS_LINE_COLORS.length];
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
                                  name,
                                  value: p.value,
                                  unit: p.unit,
                                  date: p.date,
                                  cx,
                                  cy,
                                  color,
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
                      {activePoint.value}{" "}
                      {activePoint.unit ? activePoint.unit : ""}
                    </text>
                    <text
                      x={activePoint.cx}
                      y={activePoint.cy - 16}
                      textAnchor="middle"
                      fontSize="11"
                      fill="rgba(255,255,255,0.70)"
                      fontWeight="800"
                    >
                      {formatDate(activePoint.date)}
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
                    {formatDate(p.date)}
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

  const latestWeight = weights.length
    ? weights[weights.length - 1].weight
    : null;

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
        value: Number(w.weight),
      };
    });
  }, [weights]);

  const goalPoint = useMemo(() => {
    if (!goal || !goal.target_date) return null;
    const d = new Date(goal.target_date);
    // Guard: invalid date
    if (Number.isNaN(d.getTime())) return null;
    return {
      type: "goal",
      ts: d.getTime(),
      date: d,
      value: Number(goal.target_value),
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
     DATE HELPERS
  ============================================================ */
  function formatDate(d) {
    try {
      return d.toLocaleDateString();
    } catch {
      return "";
    }
  }

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
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function applyCamera() {
    if (!cameraGroupRef.current) return;

    const cam = camRef.current;

    // Clamp scale
    const MIN_SCALE = 1;
    const MAX_SCALE = 8;
    cam.scale = clamp(cam.scale, MIN_SCALE, MAX_SCALE);

    // If not zoomed, lock to default
    if (cam.scale <= 1.01) {
      cam.scale = 1;
      cam.tx = 0;
      cam.ty = 0;
    }

    // VIEWPORT in SVG units
    const viewportW = GRAPH_W;
    const viewportH = GRAPH_H;

    // CONTENT size after scaling
    const contentW = GRAPH_W * cam.scale;
    const contentH = GRAPH_H * cam.scale;

    const minTx = viewportW - contentW;
    const maxTx = 0;

    const minTy = viewportH - contentH;
    const maxTy = 0;

    cam.tx = clamp(cam.tx, minTx, maxTx);
    cam.ty = clamp(cam.ty, minTy, maxTy);

    camRef.current = cam;

    cameraGroupRef.current.setAttribute(
      "transform",
      `translate(${cam.tx}, ${cam.ty}) scale(${cam.scale})`
    );
  }

  function resetCamera() {
    camRef.current = {
      scale: 1,
      tx: 0,
      ty: 0,
    };
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

      camRef.current = cam;
      applyCamera();

      pinchRef.current.lastDist = dist;
      return;
    }

    // PAN (ONLY WHEN ZOOMED)
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

      const dxSvg = currSvg.x - prevSvg.x;
      const dySvg = currSvg.y - prevSvg.y;

      cam.tx += dxSvg;
      cam.ty += dySvg;

      camRef.current = cam;
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
     TAP HANDLERS (TOOLTIP)
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
                background: isActive
                  ? "#ff2f2f"
                  : "rgba(255,255,255,0.05)",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ============================================================
          BODYWEIGHT TAB
      ============================================================ */}
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
                          {/* tap target */}
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

                          {/* visible */}
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
                            ? `Goal • ${formatDate(activePoint.date)}`
                            : formatDate(activePoint.date)}
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
                      {formatDate(p.date)}
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
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 12,
                    opacity: 0.7,
                  }}
                >
                  Goal shown in gold ({formatDate(goalPoint.date)}). Zoom out to
                  see future spacing.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ============================================================
          MEASUREMENTS TAB (REAL)
      ============================================================ */}
      {tab === "measurements" && <MeasurementsTabPanel />}

      {/* ============================================================
          PRs TAB (placeholder for now)
      ============================================================ */}
      {tab === "prs" && (
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
          PR analytics coming next
        </div>
      )}

      {/* SPACER */}
      <div style={{ height: 40 }} />
    </div>
  );
}
