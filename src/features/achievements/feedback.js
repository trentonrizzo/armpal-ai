import { RARITY } from "./definitions";

const LS_FEEDBACK = "armpal_achievement_feedback_on";

export function isAchievementFeedbackEnabled() {
  try {
    const v = localStorage.getItem(LS_FEEDBACK);
    if (v === null || v === undefined) return true;
    return v !== "0" && v !== "false";
  } catch {
    return true;
  }
}

/** Optional: settings UI can toggle later */
export function setAchievementFeedbackEnabled(on) {
  try {
    localStorage.setItem(LS_FEEDBACK, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function playWebChime() {
  const Ctx = typeof window !== "undefined" && window.AudioContext;
  const ctx = Ctx ? new Ctx() : null;
  if (!ctx) return;

  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 0.12;
  master.connect(ctx.destination);

  const freqs = [523.25, 659.25, 783.99];
  freqs.forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, now + i * 0.05);
    g.gain.exponentialRampToValueAtTime(0.35, now + i * 0.05 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.05 + 0.18);
    o.connect(g);
    g.connect(master);
    o.start(now + i * 0.05);
    o.stop(now + 0.45);
  });

  window.setTimeout(() => {
    try {
      ctx.close();
    } catch {
      /* ignore */
    }
  }, 600);
}

function vibratePattern(def) {
  try {
    if (typeof navigator === "undefined" || !navigator.vibrate) return;
    const isLegendary = def?.rarity === "legendary";
    if (isLegendary) navigator.vibrate([12, 40, 18, 35, 22]);
    else if (def?.rarity === "epic") navigator.vibrate([10, 30, 14]);
    else navigator.vibrate(18);
  } catch {
    /* ignore */
  }
}

/**
 * @param {{ rarity?: string } | null} def
 */
export function playAchievementFeedback(def) {
  if (!isAchievementFeedbackEnabled()) return;

  try {
    playWebChime();
  } catch {
    /* silent */
  }

  try {
    vibratePattern(def);
  } catch {
    /* silent */
  }
}

export function rarityPulseStyle(rarity) {
  const r = RARITY[rarity]?.order ?? 0;
  if (r >= 3) {
    return {
      boxShadow: [
        "0 0 0 1px color-mix(in srgb, var(--accent) 52%, transparent)",
        "0 0 28px color-mix(in srgb, var(--accent) 38%, transparent)",
        "0 0 48px color-mix(in srgb, var(--accent-soft) 32%, transparent)",
      ].join(", "),
    };
  }
  if (r >= 2) {
    return {
      boxShadow: [
        "0 0 0 1px color-mix(in srgb, var(--accent) 42%, transparent)",
        "0 0 22px color-mix(in srgb, var(--accent) 28%, transparent)",
      ].join(", "),
    };
  }
  return {};
}
