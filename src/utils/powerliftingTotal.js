// Pure helpers for the PR page Powerlifting Total (SBD). Does not touch Supabase.

const KG_TO_LB = 2.2046226218;

export function normalizeLiftName(name) {
  if (!name || typeof name !== "string") return "";
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Returns which big-3 slot a lift name maps to, or null.
 * Aliases (case-insensitive, normalized spacing):
 *   Bench: bench, bench press, flat bench (+ common barbell bench press phrasing)
 *   Squat: squat, back squat
 *   Deadlift: deadlift, conventional deadlift, sumo deadlift
 */
export function slotForLiftName(liftName) {
  const n = normalizeLiftName(liftName);
  if (!n) return null;

  // Deadlift — exclude Romanian / RDL / stiff-leg from competition total
  if (/\b(romanian|rdl|stiff[-\s]?leg)\b/.test(n)) return null;
  if (
    n === "deadlift" ||
    n.includes("conventional deadlift") ||
    n.includes("sumo deadlift")
  ) {
    return "deadlift";
  }
  if (/\bdeadlift\b/.test(n)) return "deadlift";

  // Squat — only plain squat / back squat per spec
  if (n === "squat" || n === "back squat" || n.includes("back squat")) {
    if (/\b(front|goblet|hack|split|overhead|pistol|zercher)\b/.test(n))
      return null;
    return "squat";
  }

  // Bench — bench press, flat bench, lone "bench"; exclude obvious non-flat variants
  if (n === "bench" || n === "bench press" || n === "flat bench") return "bench";
  if (n.includes("flat bench")) return "bench";
  if (n.includes("bench press")) {
    if (/\b(incline|decline|close[-\s]?grip|narrow)\b/.test(n)) return null;
    return "bench";
  }

  return null;
}

function weightToLbs(weight, unit) {
  const w = Number(weight);
  if (!Number.isFinite(w) || w < 0) return null;
  const u = (unit || "lbs").toLowerCase();
  if (u === "kg" || u === "kilos" || u === "kgs") return w * KG_TO_LB;
  return w;
}

/**
 * @param {{ lift_name: string, entries: any[] }[]} groups
 * @returns {{
 *   bench: { liftName: string, weight: number, unit: string, wLbs: number } | null,
 *   squat: { liftName: string, weight: number, unit: string, wLbs: number } | null,
 *   deadlift: { liftName: string, weight: number, unit: string, wLbs: number } | null,
 *   totalLbs: number | null,
 * }}
 */
export function computePowerliftingFromGroups(groups) {
  const bestBySlot = {
    bench: null,
    squat: null,
    deadlift: null,
  };

  for (const g of groups || []) {
    const slot = slotForLiftName(g.lift_name);
    if (!slot || !g.entries?.length) continue;

    let top = null;
    for (const e of g.entries) {
      const wLbs = weightToLbs(e.weight, e.unit);
      if (wLbs == null) continue;
      if (!top || wLbs > top.wLbs) {
        top = {
          liftName: g.lift_name,
          weight: Number(e.weight),
          unit: e.unit || "lbs",
          wLbs,
        };
      }
    }
    if (!top) continue;

    const prev = bestBySlot[slot];
    if (!prev || top.wLbs > prev.wLbs) bestBySlot[slot] = top;
  }

  const parts = [bestBySlot.bench, bestBySlot.squat, bestBySlot.deadlift].filter(
    Boolean
  );
  const totalLbs =
    parts.length > 0
      ? Math.round(parts.reduce((s, p) => s + p.wLbs, 0))
      : null;

  return { ...bestBySlot, totalLbs };
}
