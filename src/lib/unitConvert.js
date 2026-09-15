const LB_PER_KG = 2.2046226218;

export function normalizeUnit(unit) {
  const u = String(unit || "lb").trim().toLowerCase();
  if (["kg", "kgs", "kilo", "kilos", "kilogram", "kilograms"].includes(u)) {
    return "kg";
  }
  return "lb";
}

export function toPounds(weight, unit) {
  const w = Number(weight);
  if (!Number.isFinite(w)) return null;
  return normalizeUnit(unit) === "kg" ? w * LB_PER_KG : w;
}

export function displayUnit(unit) {
  return normalizeUnit(unit) === "kg" ? "kg" : "lb";
}
