/**
 * Canonical ArmPal estimated 1RM (Epley).
 * reps === 1 uses the true inputted weight (do not inflate a real max).
 */
export function estimateOneRepMax(weight, reps) {
  const w = Number(weight);
  const r = Number(reps);
  if (!Number.isFinite(w) || w <= 0) return null;
  if (!Number.isFinite(r) || r <= 0) return null;
  if (r === 1) return Math.round(w);
  return Math.round(w * (1 + r / 30));
}
