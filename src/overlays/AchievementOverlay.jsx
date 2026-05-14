// src/overlays/AchievementOverlay.jsx
import React, { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaTrophy } from "react-icons/fa";
import { ACHIEVEMENT_UNLOCK_EVENT } from "../features/achievements/runner";
import { rarityPulseStyle } from "../features/achievements/feedback";
import { RARITY } from "../features/achievements/definitions";

export default function AchievementOverlay() {
  const [queue, setQueue] = useState([]);
  const [active, setActive] = useState(null);

  const onUnlock = useCallback((e) => {
    const a = e?.detail?.achievement;
    if (!a?.id) return;
    setQueue((q) => [...q, a]);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.addEventListener(ACHIEVEMENT_UNLOCK_EVENT, onUnlock);
    return () => window.removeEventListener(ACHIEVEMENT_UNLOCK_EVENT, onUnlock);
  }, [onUnlock]);

  useEffect(() => {
    if (!active && queue.length > 0) {
      setActive(queue[0]);
      setQueue((q) => q.slice(1));
    }
  }, [queue, active]);

  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => setActive(null), 4200);
    return () => window.clearTimeout(t);
  }, [active]);

  const rarity = active?.rarity && RARITY[active.rarity] ? active.rarity : "common";
  const pulse = rarityPulseStyle(rarity);
  const isClub1000 = active?.id === "club_1000";

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10050,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        paddingTop: "calc(12px + env(safe-area-inset-top, 0px))",
      }}
    >
      <AnimatePresence mode="wait">
        {active && (
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: -28, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -18, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            style={{
              pointerEvents: "none",
              maxWidth: 420,
              width: "calc(100% - 32px)",
            }}
          >
            <div
              style={{
                background:
                  "linear-gradient(145deg, color-mix(in srgb, var(--card) 92%, var(--bg)) 0%, var(--card-2) 52%, color-mix(in srgb, var(--card) 88%, var(--bg)) 100%)",
                border: "1px solid color-mix(in srgb, var(--accent) 42%, transparent)",
                borderRadius: 16,
                padding: "16px 18px",
                boxShadow: [
                  "0 18px 50px color-mix(in srgb, var(--bg) 55%, black)",
                  "inset 0 1px 0 color-mix(in srgb, var(--text) 8%, transparent)",
                ].join(", "),
                ...pulse,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <motion.div
                  animate={
                    isClub1000
                      ? { scale: [1, 1.06, 1], filter: ["brightness(1)", "brightness(1.15)", "brightness(1)"] }
                      : { scale: [1, 1.03, 1] }
                  }
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background:
                      "radial-gradient(circle at 30% 25%, color-mix(in srgb, var(--text) 14%, transparent), transparent 55%), var(--card)",
                    border: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: isClub1000
                      ? "color-mix(in srgb, var(--accent-soft) 75%, #d4af37 25%)"
                      : "var(--accent)",
                    flexShrink: 0,
                  }}
                  aria-hidden
                >
                  <FaTrophy size={26} />
                </motion.div>
                <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: 1.2,
                      textTransform: "uppercase",
                      color: "var(--text-dim)",
                      marginBottom: 4,
                    }}
                  >
                    Achievement unlocked
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 900,
                      letterSpacing: -0.3,
                      color: "var(--text)",
                      lineHeight: 1.2,
                      marginBottom: 6,
                    }}
                  >
                    {active.title}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "color-mix(in srgb, var(--text) 78%, var(--text-dim))",
                      lineHeight: 1.45,
                    }}
                  >
                    {active.description}
                  </div>
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: 0.8,
                        textTransform: "uppercase",
                        padding: "3px 8px",
                        borderRadius: 999,
                        background: "color-mix(in srgb, var(--accent) 18%, transparent)",
                        color: "var(--accent-soft)",
                        border: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)",
                      }}
                    >
                      {RARITY[rarity]?.label || "Common"}
                    </span>
                    {isClub1000 ? (
                      <span
                        style={{
                          fontSize: 11,
                          color: "color-mix(in srgb, var(--accent-soft) 88%, #d4af37 12%)",
                          fontWeight: 700,
                        }}
                      >
                        Welcome to the club.
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
