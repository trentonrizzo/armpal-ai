/**
 * Center crosshair — dot / cross / circle from settings
 */
import React from "react";

const wrap = {
  position: "absolute",
  left: "50%",
  top: "50%",
  transform: "translate(-50%, -50%)",
  pointerEvents: "none",
  zIndex: 25,
};

const dot = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.9)",
  boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
};

const cross = {
  width: 20,
  height: 20,
  position: "relative",
};
const crossLine = {
  position: "absolute",
  background: "rgba(255,255,255,0.9)",
  boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
};
const crossH = { ...crossLine, width: 12, height: 2, left: 4, top: 9 };
const crossV = { ...crossLine, width: 2, height: 12, left: 9, top: 4 };

const circle = {
  width: 16,
  height: 16,
  borderRadius: "50%",
  border: "2px solid rgba(255,255,255,0.9)",
  boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
  background: "transparent",
};

export default function Crosshair({ style: crosshairStyle = "cross" }) {
  return (
    <div style={wrap}>
      {crosshairStyle === "dot" && <div style={dot} />}
      {crosshairStyle === "cross" && (
        <div style={cross}>
          <div style={crossH} />
          <div style={crossV} />
        </div>
      )}
      {crosshairStyle === "circle" && <div style={circle} />}
    </div>
  );
}
