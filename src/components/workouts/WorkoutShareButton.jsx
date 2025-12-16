import { useLocation } from "react-router-dom";
import { FaShare } from "react-icons/fa";

export default function WorkoutShareButton({ onClick }) {
  const location = useLocation();

  if (location.pathname !== "/workouts") return null;

  return (
    <button
      onClick={onClick}
      style={{
        position: "fixed",
        top: 14,
        right: 14,
        zIndex: 9999,
        width: 44,
        height: 44,
        borderRadius: 999,
        background: "#111",
        border: "1px solid rgba(255,255,255,0.15)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        cursor: "pointer",
        boxShadow: "0 0 14px rgba(255,47,47,0.35)",
      }}
      aria-label="Share workouts"
    >
      <FaShare />
    </button>
  );
}
