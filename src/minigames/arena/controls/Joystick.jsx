/**
 * Left-side movement joystick via nipplejs
 */
import React, { useEffect, useRef } from "react";

const OPTIONS = {
  zone: null,
  mode: "static",
  position: { left: "80px", bottom: "120px" },
  color: "rgba(255,255,255,0.3)",
  size: 100,
  threshold: 0.1,
  fadeTime: 200,
};

export default function Joystick({ onMove, containerRef }) {
  const zoneRef = useRef(null);
  const joystickRef = useRef(null);

  useEffect(() => {
    if (!zoneRef.current || !onMove) return;
    let nipple = null;
    import("nipplejs").then(({ default: Nipple }) => {
      if (!zoneRef.current) return;
      const opts = {
        ...OPTIONS,
        zone: zoneRef.current,
      };
      nipple = Nipple.create(opts);
      joystickRef.current = nipple;
      nipple.on("move", (evt, data) => {
        const v = data.vector || { x: 0, y: 0 };
        onMove(v.x, v.y);
      });
      nipple.on("end", () => onMove(0, 0));
    });
    return () => {
      if (joystickRef.current) {
        joystickRef.current.destroy();
        joystickRef.current = null;
      }
    };
  }, [onMove]);

  return (
    <div
      ref={zoneRef}
      style={{
        position: "absolute",
        left: 12,
        bottom: 100,
        width: 120,
        height: 120,
        touchAction: "none",
        zIndex: 10,
      }}
      aria-hidden
    />
  );
}
