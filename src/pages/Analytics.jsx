// src/pages/Analytics.jsx
// ============================================================
// ARM PAL — SMART ANALYTICS
// BODYWEIGHT ANALYTICS WITH TRUE CAMERA ZOOM
// LONG FORM FILE — NO COMPRESSION — PRODUCTION SAFE
// ============================================================

import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
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
      setLoading(false);
      return;
    }

    const { data: bw } = await supabase
      .from("bodyweight_logs")
      .select("weight, logged_at")
      .eq("user_id", user.id)
      .order("logged_at", { ascending: true });

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
  }

  const latestWeight =
    weights.length > 0
      ? weights[weights.length - 1].weight
      : null;

  /* ============================================================
     GRAPH CONSTANTS
  ============================================================ */
  const GRAPH_WIDTH = 360;
  const GRAPH_HEIGHT = 220;
  const GRAPH_PADDING = 44;

  /* ============================================================
     CANONICAL DATA
  ============================================================ */
  const points = useMemo(() => {
    return weights.map((w) => {
      const d = new Date(w.logged_at);
      return {
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
      ts: d.getTime(),
      date: d,
      value: goal.target_value,
    };
  }, [goal]);

  /* ============================================================
     STATIC SCALE DOMAIN (NEVER CHANGES)
  ============================================================ */
  const allYValues = [
    ...points.map((p) => p.value),
    ...(goalPoint ? [goalPoint.value] : []),
  ];

  const minYValue = Math.min(...allYValues);
  const maxYValue = Math.max(...allYValues);
  const yPadding = (maxYValue - minYValue) * 0.15 || 5;

  const minTimestamp =
    points.length > 0 ? points[0].ts : Date.now();

  const maxTimestamp = Math.max(
    points.length > 0
      ? points[points.length - 1].ts
      : Date.now(),
    goalPoint ? goalPoint.ts : 0
  );

  function xByTime(ts) {
    return (
      GRAPH_PADDING +
      ((ts - minTimestamp) /
        (maxTimestamp - minTimestamp || 1)) *
        (GRAPH_WIDTH - GRAPH_PADDING * 2)
    );
  }

  function yByValue(val) {
    return (
      GRAPH_HEIGHT -
      GRAPH_PADDING -
      ((val - (minYValue - yPadding)) /
        ((maxYValue + yPadding) -
          (minYValue - yPadding))) *
        (GRAPH_HEIGHT - GRAPH_PADDING * 2)
    );
  }

  /* ============================================================
     PATHS
  ============================================================ */
  const linePath =
    points.length > 1
      ? points
          .map((p, i) => {
            const x = xByTime(p.ts);
            const y = yByValue(p.value);
            return `${i === 0 ? "M" : "L"} ${x} ${y}`;
          })
          .join(" ")
      : "";

  const areaPath = linePath
    ? `${linePath}
       L ${xByTime(maxTimestamp)} ${GRAPH_HEIGHT - GRAPH_PADDING}
       L ${xByTime(minTimestamp)} ${GRAPH_HEIGHT - GRAPH_PADDING}
       Z`
    : "";

  /* ============================================================
     CAMERA TRANSFORM (THE IMPORTANT PART)
  ============================================================ */
  const svgRef = useRef(null);

  const camera = useRef({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });

  const lastTouches = useRef(null);
  const lastPan = useRef(null);

  function applyCameraTransform() {
    if (!svgRef.current) return;
    const g = svgRef.current.querySelector("#camera-layer");
    if (!g) return;

    const { scale, translateX, translateY } = camera.current;

    g.setAttribute(
      "transform",
      `translate(${translateX}, ${translateY}) scale(${scale})`
    );
  }

  function distance(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /* ============================================================
     TOUCH HANDLERS (TRUE CAMERA ZOOM)
  ============================================================ */
  function onTouchStart(e) {
    if (e.touches.length === 2) {
      const d = distance(e.touches[0], e.touches[1]);
      lastTouches.current = {
        distance: d,
        centerX:
          (e.touches[0].clientX + e.touches[1].clientX) / 2,
        centerY:
          (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
      lastPan.current = null;
    }

    if (e.touches.length === 1) {
      lastPan.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
      lastTouches.current = null;
    }
  }

  function onTouchMove(e) {
    e.preventDefault();

    // PINCH ZOOM
    if (e.touches.length === 2 && lastTouches.current) {
      const newDistance = distance(
        e.touches[0],
        e.touches[1]
      );
      const zoomFactor =
        newDistance / lastTouches.current.distance;

      const rect = svgRef.current.getBoundingClientRect();
      const cx =
        lastTouches.current.centerX - rect.left;
      const cy =
        lastTouches.current.centerY - rect.top;

      camera.current.translateX =
        cx -
        zoomFactor * (cx - camera.current.translateX);
      camera.current.translateY =
        cy -
        zoomFactor * (cy - camera.current.translateY);
      camera.current.scale *= zoomFactor;

      applyCameraTransform();

      lastTouches.current.distance = newDistance;
      return;
    }

    // PAN
    if (e.touches.length === 1 && lastPan.current) {
      const dx = e.touches[0].clientX - lastPan.current.x;
      const dy = e.touches[0].clientY - lastPan.current.y;

      camera.current.translateX += dx;
      camera.current.translateY += dy;

      applyCameraTransform();

      lastPan.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
  }

  function onTouchEnd() {
    lastTouches.current = null;
    lastPan.current = null;
  }

  function resetCamera() {
    camera.current.scale = 1;
    camera.current.translateX = 0;
    camera.current.translateY = 0;
    applyCameraTransform();
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
        {["bodyweight", "measurements", "prs"].map(
          (key) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 14,
                border:
                  "1px solid rgba(255,255,255,0.12)",
                color: "#fff",
                fontWeight: 800,
                background:
                  tab === key
                    ? "#ff2f2f"
                    : "rgba(255,255,255,0.05)",
              }}
            >
              {key === "prs"
                ? "PRs"
                : key[0].toUpperCase() +
                  key.slice(1)}
            </button>
          )
        )}
      </div>

      {/* BODYWEIGHT TAB */}
      {tab === "bodyweight" && (
        <div
          style={{
            marginTop: 14,
            padding: 16,
            borderRadius: 18,
            border:
              "1px solid rgba(255,255,255,0.10)",
            background: "#101014",
          }}
        >
          {loading ? (
            <p style={{ opacity: 0.7 }}>
              Loading bodyweight…
            </p>
          ) : (
            <>
              {/* CURRENT */}
              <div
                style={{
                  fontSize: 13,
                  opacity: 0.75,
                }}
              >
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

              {/* RESET */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <button
                  onClick={resetCamera}
                  style={{
                    height: 36,
                    padding: "0 14px",
                    borderRadius: 12,
                    border:
                      "1px solid rgba(255,255,255,0.12)",
                    background:
                      "rgba(255,255,255,0.06)",
                    color: "#fff",
                    fontWeight: 800,
                  }}
                >
                  Reset
                </button>

                <div
                  style={{
                    marginLeft: 12,
                    fontSize: 11,
                    color:
                      "rgba(255,255,255,0.55)",
                    fontWeight: 700,
                  }}
                >
                  Pinch to zoom • Drag to pan
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
                {/* Y AXIS LABELS */}
                <text
                  x={6}
                  y={GRAPH_PADDING}
                  fontSize="10"
                  fill="#aaa"
                >
                  {Math.round(maxYValue)} lb
                </text>

                <text
                  x={6}
                  y={GRAPH_HEIGHT - GRAPH_PADDING}
                  fontSize="10"
                  fill="#aaa"
                >
                  {Math.round(minYValue)} lb
                </text>

                {/* CAMERA LAYER */}
                <g id="camera-layer">
                  {areaPath && (
                    <path
                      d={areaPath}
                      fill="rgba(255,47,47,0.18)"
                    />
                  )}

                  {linePath && (
                    <path
                      d={linePath}
                      fill="none"
                      stroke="#ff2f2f"
                      strokeWidth="3"
                    />
                  )}

                  {points.map((p, i) => {
                    const cx = xByTime(p.ts);
                    const cy = yByValue(p.value);
                    const isLatest =
                      i === points.length - 1;

                    return (
                      <g key={i}>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={12}
                          fill="transparent"
                          onClick={() =>
                            setActivePoint(p)
                          }
                        />
                        <circle
                          cx={cx}
                          cy={cy}
                          r={6}
                          fill={
                            isLatest
                              ? "#2ecc71"
                              : "#ff2f2f"
                          }
                        />
                      </g>
                    );
                  })}

                  {goalPoint && (
                    <circle
                      cx={xByTime(goalPoint.ts)}
                      cy={yByValue(goalPoint.value)}
                      r={8}
                      fill="#f5c542"
                    />
                  )}
                </g>
              </svg>

              {/* LIST */}
              <div style={{ marginTop: 14 }}>
                {[...points].reverse().map(
                  (p, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        padding: "8px 0",
                        borderBottom:
                          "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <span>
                        {p.date.toLocaleDateString()}
                      </span>
                      <strong>
                        {p.value} lb
                      </strong>
                    </div>
                  )
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
