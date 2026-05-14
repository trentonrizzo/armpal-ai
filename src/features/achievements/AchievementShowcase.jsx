import React, { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FaTrophy } from "react-icons/fa";
import { ACHIEVEMENTS, ACHIEVEMENT_IDS, RARITY } from "./definitions";
import { listAchievementUnlocks } from "./persistence";
import { rarityPulseStyle } from "./feedback";
import { ACHIEVEMENT_UNLOCK_EVENT } from "./runner";

/**
 * Profile badges: earned + locked preview, tap for description.
 */
export default function AchievementShowcase({ userId }) {
  const [unlocked, setUnlocked] = useState(() => new Map());
  const [detail, setDetail] = useState(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      const rows = await listAchievementUnlocks(userId);
      const m = new Map();
      for (const r of rows) {
        m.set(r.id, r.unlocked_at);
      }
      setUnlocked(m);
    } catch {
      /* ignore */
    }
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fn = () => {
      reload();
    };
    window.addEventListener(ACHIEVEMENT_UNLOCK_EVENT, fn);
    return () => window.removeEventListener(ACHIEVEMENT_UNLOCK_EVENT, fn);
  }, [reload]);

  if (!userId) return null;

  const total = ACHIEVEMENT_IDS.length;
  const earned = unlocked.size;

  return (
    <div style={{ marginTop: 4 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 900, color: "var(--text)" }}>Achievements</div>
        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-dim)" }}>
          {earned} / {total} unlocked
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))",
          gap: 10,
        }}
      >
        {ACHIEVEMENT_IDS.map((id) => {
          const def = ACHIEVEMENTS[id];
          const has = unlocked.has(id);
          const pulse = has ? rarityPulseStyle(def.rarity) : {};
          const isLegendary = def.rarity === "legendary" && has;

          return (
            <motion.button
              key={id}
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => setDetail(def)}
              style={{
                aspectRatio: "1",
                borderRadius: 14,
                border: has
                  ? "1px solid color-mix(in srgb, var(--accent) 45%, transparent)"
                  : "1px solid var(--border)",
                background: has
                  ? "linear-gradient(160deg, var(--card-2), color-mix(in srgb, var(--card) 92%, var(--bg)))"
                  : "color-mix(in srgb, var(--card) 55%, var(--bg))",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                cursor: "pointer",
                opacity: has ? 1 : 0.38,
                color: has ? "var(--text)" : "color-mix(in srgb, var(--text-dim) 70%, var(--text))",
                padding: 6,
                ...pulse,
              }}
              aria-label={`${def.title}${has ? ", unlocked" : ", locked"}`}
            >
              {isLegendary ? (
                <motion.span
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 2.4, repeat: Infinity }}
                  style={{ color: "var(--accent-soft)" }}
                >
                  <FaTrophy size={22} />
                </motion.span>
              ) : (
                <span style={{ color: has ? "var(--accent)" : "inherit" }}>
                  <FaTrophy size={22} />
                </span>
              )}
              <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: 0.3, textAlign: "center", lineHeight: 1.1 }}>
                {def.title.split(" ").slice(0, 2).join(" ")}
              </span>
            </motion.button>
          );
        })}
      </div>

      {detail && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 12000,
            background: "color-mix(in srgb, var(--bg) 22%, black 78%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setDetail(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 360,
              width: "100%",
              borderRadius: 16,
              padding: 20,
              background: "var(--card)",
              border: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)",
              color: "var(--text)",
              boxShadow: [
                "0 20px 50px color-mix(in srgb, var(--bg) 50%, black)",
                "inset 0 1px 0 color-mix(in srgb, var(--text) 6%, transparent)",
              ].join(", "),
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-dim)", marginBottom: 6 }}>
              {detail.category} · {RARITY[detail.rarity]?.label || "Common"}
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 10, color: "var(--text)" }}>
              {detail.title}
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.5,
                color: "color-mix(in srgb, var(--text) 82%, var(--text-dim))",
              }}
            >
              {detail.description}
            </p>
            {unlocked.has(detail.id) ? (
              <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--text-dim)" }}>
                Unlocked {new Date(unlocked.get(detail.id)).toLocaleString()}
              </p>
            ) : (
              <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--text-dim)" }}>
                Keep going — not unlocked yet.
              </p>
            )}
            <button
              type="button"
              onClick={() => setDetail(null)}
              style={{
                marginTop: 16,
                width: "100%",
                padding: "12px 14px",
                borderRadius: 12,
                border: "none",
                background: "var(--accent)",
                color: "var(--text)",
                fontWeight: 900,
                cursor: "pointer",
                boxShadow: "0 0 16px color-mix(in srgb, var(--accent) 45%, transparent)",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
