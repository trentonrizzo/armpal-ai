// src/utils/achievementBus.js
// ============================================================
// ARM PAL — ACHIEVEMENT BUS (DEBUG-EXPOSED)
// ============================================================
// Exposes window.__achievementBus for deterministic testing.
// ============================================================

export const achievementBus = {
  listeners: [],

  emit(event) {
    try {
      this.listeners.forEach((fn) => fn(event));
    } catch (e) {
      console.error("achievementBus.emit error:", e);
    }
  },

  subscribe(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  },
};

// ✅ DEBUG: allow manual emit from DevTools console
if (typeof window !== "undefined") {
  window.__achievementBus = achievementBus;
}
