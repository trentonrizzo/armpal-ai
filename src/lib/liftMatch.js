const GROUPS = [
  {
    key: "bench",
    aliases: ["bench", "bench press", "flat bench", "bp", "barbell bench"],
  },
  {
    key: "incline_bench",
    aliases: ["incline", "incline bench", "incline bench press"],
  },
  {
    key: "decline_bench",
    aliases: ["decline", "decline bench", "decline bench press"],
  },
  {
    key: "ohp",
    aliases: [
      "ohp",
      "overhead press",
      "shoulder press",
      "military press",
      "strict press",
    ],
  },
  {
    key: "squat",
    aliases: ["squat", "back squat", "high bar squat", "low bar squat"],
  },
  {
    key: "front_squat",
    aliases: ["front squat"],
  },
  {
    key: "deadlift",
    aliases: ["deadlift", "dead lift", "dl", "conventional deadlift"],
  },
  {
    key: "sumo_deadlift",
    aliases: ["sumo", "sumo deadlift"],
  },
  {
    key: "rdl",
    aliases: ["rdl", "romanian deadlift"],
  },
  {
    key: "row",
    aliases: ["row", "barbell row", "bent over row"],
  },
  {
    key: "pullup",
    aliases: ["pullup", "pull-up", "pull up", "chinup", "chin-up"],
  },
  {
    key: "dip",
    aliases: ["dip", "dips", "chest dip"],
  },
  {
    key: "curl",
    aliases: ["curl", "barbell curl", "bicep curl"],
  },
];

export function normalizeLiftText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s) {
  return normalizeLiftText(s).split(" ").filter(Boolean);
}

export function scoreLiftName(query, liftName) {
  const q = normalizeLiftText(query);
  const n = normalizeLiftText(liftName);
  if (!q || !n) return 0;
  if (q === n) return 100;
  if (n.includes(q) || q.includes(n)) return 86;

  const qTokens = tokens(q);
  const nTokens = new Set(tokens(n));
  if (!qTokens.length) return 0;
  const overlap = qTokens.filter((t) => nTokens.has(t)).length;
  let score = Math.round((overlap / qTokens.length) * 70);

  for (const group of GROUPS) {
    const qHit = group.aliases.some(
      (a) => q === a || q.includes(a) || a.includes(q)
    );
    const nHit = group.aliases.some(
      (a) => n === a || n.includes(a) || a.includes(n)
    );
    if (qHit && nHit) score = Math.max(score, 78);
  }
  return score;
}

export function findMatchingPrs(prs, query, minScore = 62) {
  const list = Array.isArray(prs) ? prs : [];
  const scored = list
    .map((pr) => ({ pr, score: scoreLiftName(query, pr.lift_name) }))
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score || Number(b.pr.weight) - Number(a.pr.weight));
  return scored;
}

/**
 * Resolve a write target. Never silently pick among close competitors.
 */
export function resolvePrWrite(prs, { prId, liftQuery } = {}) {
  const list = Array.isArray(prs) ? prs : [];
  if (prId) {
    const hit = list.find((p) => p.id === prId);
    if (!hit) return { ok: false, error: "I couldn't find that PR." };
    return { ok: true, pr: hit };
  }
  const q = String(liftQuery || "").trim();
  if (!q) return { ok: false, error: "Which lift?" };
  const matches = findMatchingPrs(list, q);
  if (!matches.length) return { ok: false, error: `I couldn't find a ${q} PR.` };
  const best = matches[0];
  const close = matches.filter(
    (m) => m.score >= best.score - 8 && m.pr.id !== best.pr.id
  );
  const differentNames = new Set(
    [best.pr.lift_name, ...close.map((c) => c.pr.lift_name)].map((n) =>
      normalizeLiftText(n)
    )
  );
  if (differentNames.size > 1 && close.length) {
    return {
      ok: false,
      ambiguous: true,
      candidates: matches.slice(0, 5).map((m) => ({
        id: m.pr.id,
        lift_name: m.pr.lift_name,
        weight: m.pr.weight,
        reps: m.pr.reps,
        unit: m.pr.unit,
        date: m.pr.date,
      })),
    };
  }
  return { ok: true, pr: best.pr, matches: matches.map((m) => m.pr) };
}
