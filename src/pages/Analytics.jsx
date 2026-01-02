// src/pages/Analytics.jsx
// ============================================================
// ARM PAL — SMART ANALYTICS
// BODYWEIGHT ANALYTICS — TRUE CAMERA ZOOM (SVG-UNIT CORRECT)
// LONG FORM — NO COMPRESSION — SAFE FOR YOUR PROJECT
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
   COMPONENT
============================================================ */
export default function Analytics() {
  const navigate = useNavigate();

  /* ============================================================
     STATE
  ============================================================ */
  const [tab, setTab] = useState("bodyweight");

  const [weights, setWeights] = useState([]);
  const [goal, setGoal] = useState(null);

  const [loading, setLoading] = useState(true);
  const [activePoint, setActivePoint] = useState(null);

  /* ============================================================
     GRAPH CONSTANTS
  ============================================================ */
  const GRAPH_WIDTH = 360;
  const GRAPH_HEIGHT = 220;
  const PAD = 44;

  /* ============================================================
     SVG REFS
  ============================================================ */
  const svgRef = useRef(null);
  const cameraGroupRef = useRef(null);

  /* ============================================================
     CAMERA STATE (kept in refs for smooth touch)
     NOTE: THESE ARE SVG-UNIT TRANSLATIONS (viewBox units)
  ============================================================ */
  const camRef = useRef({
    scale: 1,
    tx: 0,
    ty: 0,
  });

  const pinchRef = useRef({
    active: false,
    lastDist: null,
    anchorSvgX: 0,
    anchorSvgY: 0,
  });

  const panRef = useRef({
    active: false,
    lastX: null,
    lastY: null,
  });

  /* ============================================================
     LOAD DATA
  ============================================================ */
  useEffect(() => {
    if (tab === "bodyweight") {
      loadBodyweight();
    }
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

    const { data: bw } = await supabase
      .from("bodyweight_logs")
      .select("weight, logged_at")
      .eq("user_id", user.id)
      .order("logged_at", { ascending: true });

    // pull your bodyweight goal (future date like 2026-07-11)
    const { data: goalData } = await supabase
      .from("goals")
      .select("target_value, target_date")
      .eq("user_id", user.id)
      .eq("type", "bodyweight")
      .maybeSingle();

    setWeights(bw || []);
    setGoal(goalData || null);
    setActivePoint(null);
    setLoading(false);

    // whenever data reloads, reset camera so you don't get "lost"
    requestAnimationFrame(() => {
      resetCamera();
    });
  }

  const latestWeight =
    weights.length > 0 ? weights[weights.length - 1].weight : null;

  /* ============================================================
     CANONICAL POINTS
  ============================================================ */
  const points = useMemo(() => {
    return (weights || []).map((w) => {
      const d = new Date(w.logged_at);
      return {
        type: "weight",
        ts: d.getTime(),
        date: d,
        value: w.weight,
      };
    });
  }, [weights]);

  const goalPoint = useMemo(() => {
    if (!goal || !goal.target_date) return null;
    const d = new Date(goal.target_date);
    return {
      type: "goal",
      ts: d.getTime(),
      date: d,
      value: goal.target_value,
    };
  }, [goal]);

  /* ============================================================
     STATIC DOMAIN (includes future goal ts/value)
     - This keeps your gold dot on the chart always.
  ============================================================ */
  const minTs = points.length ? points[0].ts : Date.now();
  const maxTs = Math.max(
    points.length ? points[points.length - 1].ts : Date.now(),
    goalPoint ? goalPoint.ts : 0
  );

  const allValues = [
    ...points.map((p) => p.value),
    ...(goalPoint ? [goalPoint.value] : []),
  ];

  const minVal = allValues.length ? Math.min(...allValues) : 0;
  const maxVal = allValues.length ? Math.max(...allValues) : 1;
  const yPad = (maxVal - minVal) * 0.15 || 5;

  function xByTime(ts) {
    return (
      PAD +
      ((ts - minTs) / (maxTs - minTs || 1)) *
        (GRAPH_WIDTH - PAD * 2)
    );
  }

  function yByValue(v) {
    return (
      GRAPH_HEIGHT -
      PAD -
      ((v - (minVal - yPad)) /
        ((maxVal + yPad) - (minVal - yPad))) *
        (GRAPH_HEIGHT - PAD * 2)
    );
  }

  /* ============================================================
     PATHS
  ============================================================ */
  const linePath = useMemo(() => {
    if (points.length <= 1) return "";
    return points
      .map((p, i) => {
        const x = xByTime(p.ts);
        const y = yByValue(p.value);
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  }, [points, minTs, maxTs, minVal, maxVal, yPad]);

  const areaPath = useMemo(() => {
    if (!linePath) return "";
    const baseY = GRAPH_HEIGHT - PAD;
    return `${linePath} L ${xByTime(maxTs)} ${baseY} L ${xByTime(minTs)} ${baseY} Z`;
  }, [linePath, minTs, maxTs]);

  /* ============================================================
     TIMELINE LABELS (X AXIS)
  ============================================================ */
  const xTicks = useMemo(() => {
    const ticks = [];
    const count = 4;
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1);
      const ts = minTs + t * (maxTs - minTs);
      ticks.push({
        x: PAD + t * (GRAPH_WIDTH - PAD * 2),
        label: new Date(ts).toLocaleDateString(),
      });
    }
    return ticks;
  }, [minTs, maxTs]);

  /* ============================================================
     SVG COORDINATE CONVERSION (THIS IS THE CRITICAL FIX)
     Convert clientX/Y -> SVG viewBox coordinates so zoom is stable.
  ============================================================ */
  function clientToSvg(clientX, clientY) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };

    // Use SVGPoint + screen CTM inverse (reliable for viewBox)
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;

    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };

    const inv = ctm.inverse();
    const sp = pt.matrixTransform(inv);
    return { x: sp.x, y: sp.y };
  }

  /* ============================================================
     CAMERA APPLY + CLAMP
     You said: NO weird drifting on axes.
     So:
     - Allow zoom everywhere
     - Pan only when zoomed
     - Pan only LEFT/RIGHT (horizontal)
     - Lock vertical movement (ty = 0)
     - Clamp tx so you can't fling it into infinity
  ============================================================ */
  function clampCamera() {
    const cam = camRef.current;

    // clamp scale so it feels sane
    const MIN_SCALE = 1;
    const MAX_SCALE = 8;
    cam.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, cam.scale));

    // lock vertical drift (you hated up/down)
    cam.ty = 0;

    // clamp horizontal so chart doesn't "fly away"
    // When scaled, content width = GRAPH_WIDTH * scale.
    // Keep it within the viewBox:
    // tx max = 0 (fully left aligned)
    // tx min = GRAPH_WIDTH - GRAPH_WIDTH*scale (fully right aligned)
    const minTx = GRAPH_WIDTH - GRAPH_WIDTH * cam.scale;
    const maxTx = 0;

    cam.tx = Math.max(minTx, Math.min(maxTx, cam.tx));

    camRef.current = cam;
  }

  function applyCamera() {
    if (!cameraGroupRef.current) return;
    clampCamera();
    const cam = camRef.current;
    cameraGroupRef.current.setAttribute(
      "transform",
      `translate(${cam.tx}, ${cam.ty}) scale(${cam.scale})`
    );
  }

  function resetCamera() {
    camRef.current.scale = 1;
    camRef.current.tx = 0;
    camRef.current.ty = 0;
    applyCamera();
  }

  /* ============================================================
     TRUE PINCH ZOOM (ANCHOR LOCKED IN SVG UNITS)
     This ensures:
     - Dot under your pinch gets bigger
     - Nothing "slides away"
     - It zooms INTO where you're pinching
  ============================================================ */
  function onTouchStart(e) {
    if (!e.touches) return;

    // pinch
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];

      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;
      const anchor = clientToSvg(midX, midY);

      pinchRef.current.active = true;
      pinchRef.current.lastDist = dist;
      pinchRef.current.anchorSvgX = anchor.x;
      pinchRef.current.anchorSvgY = anchor.y;

      panRef.current.active = false;
      panRef.current.lastX = null;
      panRef.current.lastY = null;

      return;
    }

    // pan (only when zoomed)
    if (e.touches.length === 1) {
      panRef.current.active = true;
      panRef.current.lastX = e.touches[0].clientX;
      panRef.current.lastY = e.touches[0].clientY;

      pinchRef.current.active = false;
      pinchRef.current.lastDist = null;
    }
  }

  function onTouchMove(e) {
    if (!e.touches) return;
    e.preventDefault();

    // pinch zoom
    if (e.touches.length === 2 && pinchRef.current.active) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];

      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const prev = pinchRef.current.lastDist || dist;

      // Smooth factor (keep gradual)
      // >1 means zoom in, <1 zoom out
      let factor = dist / prev;
      factor = Math.max(0.92, Math.min(1.08, factor)); // gradual like you want

      const cam = camRef.current;
      const anchorX = pinchRef.current.anchorSvgX;
      const anchorY = pinchRef.current.anchorSvgY;

      // IMPORTANT:
      // We are in SVG units, so this is stable:
      // New transform keeps anchor point visually fixed.
      cam.tx = anchorX - factor * (anchorX - cam.tx);
      cam.ty = anchorY - factor * (anchorY - cam.ty);
      cam.scale = cam.scale * factor;

      camRef.current = cam;
      applyCamera();

      pinchRef.current.lastDist = dist;
      return;
    }

    // pan (horizontal only, only if zoomed)
    if (e.touches.length === 1 && panRef.current.active) {
      const cam = camRef.current;

      // only pan if zoomed in (otherwise it feels like "axis moving")
      if (cam.scale <= 1.01) {
        panRef.current.lastX = e.touches[0].clientX;
        panRef.current.lastY = e.touches[0].clientY;
        return;
      }

      const currX = e.touches[0].clientX;
      const prevX = panRef.current.lastX;

      // convert client dx -> SVG units dx
      const a = clientToSvg(prevX, 0);
      const b = clientToSvg(currX, 0);
      const dxSvg = b.x - a.x;

      // horizontal pan only
      cam.tx += dxSvg;
      cam.ty = 0;

      camRef.current = cam;
      applyCamera();

      panRef.current.lastX = currX;
      panRef.current.lastY = e.touches[0].clientY;
    }
  }

  function onTouchEnd() {
    pinchRef.current.active = false;
    pinchRef.current.lastDist = null;

    panRef.current.active = false;
    panRef.current.lastX = null;
    panRef.current.lastY = null;
  }

  /* ============================================================
     CLICK TOOLTIP (optional)
     This stays as your simple tap tooltip.
  ============================================================ */
  function formatDate(d) {
    try {
      return d.toLocaleDateString();
    } catch {
      return "";
    }
  }

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
        ].map(([key, label]) => (
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
              background:
                tab === key
                  ? "#ff2f2f"
                  : "rgba(255,255,255,0.05)",
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
            <p style={{ opacity: 0.7 }}>Loading…</p>
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
                  Pinch to zoom • Drag to pan (only when zoomed)
                </div>
              </div>

              {/* SVG */}
              <svg
                ref={svgRef}
                width="100%"
                viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                style={{
                  touchAction: "none",
                  userSelect: "none",
                }}
              >
                {/* Y LABELS */}
                <text x={6} y={PAD} fontSize="10" fill="#aaa">
                  {Math.round(maxVal)} lb
                </text>
                <text x={6} y={GRAPH_HEIGHT - PAD} fontSize="10" fill="#aaa">
                  {Math.round(minVal)} lb
                </text>

                {/* X LABELS (timeline) */}
                {xTicks.map((t, i) => (
                  <text
                    key={i}
                    x={t.x}
                    y={GRAPH_HEIGHT - 10}
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
                    <path
                      d={areaPath}
                      fill="rgba(255,47,47,0.18)"
                    />
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

                  {/* WEIGHT DOTS */}
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
                          onClick={() => {
                            setActivePoint({
                              type: "weight",
                              value: p.value,
                              date: p.date,
                              cx,
                              cy,
                            });
                          }}
                        />
                        {/* visible dot */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={6}
                          fill={isLatest ? "#2ecc71" : "#ff2f2f"}
                        />
                      </g>
                    );
                  })}

                  {/* GOAL DOT (GOLD) */}
                  {goalPoint && (
                    <g>
                      <circle
                        cx={xByTime(goalPoint.ts)}
                        cy={yByValue(goalPoint.value)}
                        r={9}
                        fill="#f5c542"
                        onClick={() => {
                          setActivePoint({
                            type: "goal",
                            value: goalPoint.value,
                            date: goalPoint.date,
                            cx: xByTime(goalPoint.ts),
                            cy: yByValue(goalPoint.value),
                          });
                        }}
                      />
                    </g>
                  )}

                  {/* TOOLTIP (scales with camera; you can keep or remove) */}
                  {activePoint && (
                    <g>
                      <rect
                        x={activePoint.cx - 52}
                        y={activePoint.cy - 52}
                        width="104"
                        height="40"
                        rx="10"
                        fill="#15151a"
                        stroke="rgba(255,255,255,0.12)"
                      />
                      <text
                        x={activePoint.cx}
                        y={activePoint.cy - 32}
                        textAnchor="middle"
                        fontSize="11"
                        fill="#fff"
                        fontWeight="700"
                      >
                        {activePoint.value} lb
                      </text>
                      <text
                        x={activePoint.cx}
                        y={activePoint.cy - 16}
                        textAnchor="middle"
                        fontSize="9"
                        fill="#aaa"
                      >
                        {activePoint.type === "goal"
                          ? `Goal: ${formatDate(activePoint.date)}`
                          : formatDate(activePoint.date)}
                      </text>
                    </g>
                  )}
                </g>
              </svg>

              {/* LIST (NEWEST -> OLDEST) */}
              <div style={{ marginTop: 14 }}>
                {[...points].reverse().map((p, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderBottom:
                        "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <span>{formatDate(p.date)}</span>
                    <strong>{p.value} lb</strong>
                  </div>
                ))}
              </div>

              {/* SMALL NOTE ABOUT GOAL */}
              {goalPoint && (
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 12,
                    opacity: 0.7,
                  }}
                >
                  Goal shown in gold ({formatDate(goalPoint.date)}).
                  Zoom out to see future spacing.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* PLACEHOLDERS */}
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
          Coming next…
        </div>
      )}
    </div>
  );
}
