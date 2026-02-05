import React from "react";

export default function AIChatButtonOverlay({ onOpen }) {
  return (
    <button
      onClick={onOpen}
      style={{
        position: "fixed",
        bottom: 90,
        right: 18,
        zIndex: 999,

        width: 64,
        height: 64,
        borderRadius: "50%",
        border: "none",

        background:
          "linear-gradient(145deg, var(--accent), #ff1a1a)",

        color: "#fff",
        fontWeight: 900,
        fontSize: 18,
        letterSpacing: 1,

        display: "flex",
        alignItems: "center",
        justifyContent: "center",

        cursor: "pointer",

        boxShadow: `
          0 0 0 0 rgba(255,0,0,0.7),
          0 8px 25px rgba(0,0,0,0.6),
          inset 0 -3px 8px rgba(0,0,0,0.4)
        `,

        transition: "all 0.18s ease",
        animation: "armPalPulse 2.4s infinite",
      }}

      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.12)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      AI

      <style>{`
        @keyframes armPalPulse {
          0% {
            box-shadow:
              0 0 0 0 rgba(255,0,0,0.6),
              0 8px 25px rgba(0,0,0,0.6),
              inset 0 -3px 8px rgba(0,0,0,0.4);
          }
          70% {
            box-shadow:
              0 0 0 14px rgba(255,0,0,0),
              0 8px 25px rgba(0,0,0,0.6),
              inset 0 -3px 8px rgba(0,0,0,0.4);
          }
          100% {
            box-shadow:
              0 0 0 0 rgba(255,0,0,0),
              0 8px 25px rgba(0,0,0,0.6),
              inset 0 -3px 8px rgba(0,0,0,0.4);
          }
        }
      `}</style>
    </button>
  );
}
