import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "nodejs" };

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const RECENT_WORKOUTS_LIMIT = 25;
const RECENT_PRS_LIMIT = 50;
const RECENT_MEASUREMENTS_LIMIT = 20;
const RECENT_BODYWEIGHT_LIMIT = 14;
const RECENT_NUTRITION_DAYS = 1;
const CONTEXT_JSON_MAX = 8000;

/** Canonical lift key -> display name for PR summary */
const CANONICAL_LIFT_DISPLAY = {
  bench_press: "Bench Press",
  shoulder_press: "Shoulder Press",
  deadlift: "Deadlift",
  squat: "Squat",
  curl: "Curl",
  row: "Row",
  pullup: "Pull-up",
  dip: "Dip",
  other: "Other",
};

/** Normalize raw lift name to canonical category for grouping and lookup */
function normalizeLiftName(raw) {
  if (!raw || typeof raw !== "string") return "other";
  const lower = raw.toLowerCase().trim();
  const normalized = lower.replace(/\s+/g, " ").replace(/[^a-z0-9\s]/g, "");

  const rules = [
    [/^(bench|bench press|bench pr|flat bench|barbell bench|bb bench|bp)\b/, "bench_press"],
    [/^(overhead press|ohp|shoulder press|barbell shoulder|strict press|military press)\b/, "shoulder_press"],
    [/^(deadlift|sumo deadlift|conventional deadlift|dl|dead)\b/, "deadlift"],
    [/^(squat|back squat|barbell squat|low bar|high bar|bs)\b/, "squat"],
    [/^(curl|barbell curl|cheat curl|bicep curl|hammer curl)\b/, "curl"],
    [/^(row|barbell row|bent over row|pendlay|db row)\b/, "row"],
    [/^(pull.?up|pullup|chin.?up|chinup)\b/, "pullup"],
    [/^(dip|dips)\b/, "dip"],
  ];

  for (const [pattern, canonical] of rules) {
    if (pattern.test(normalized)) return canonical;
  }
  return "other";
}

/**
 * Group PRs by normalized lift and take best weight per category.
 * Returns array of { canonical, displayName, weight, unit, date, reps }.
 */
function buildPRSummary(prs) {
  const byCanonical = new Map();

  for (const p of prs) {
    const canonical = normalizeLiftName(p.lift_name);
    const weight = Number(p.weight);
    if (!Number.isFinite(weight) || weight <= 0) continue;

    const existing = byCanonical.get(canonical);
    const better =
      !existing ||
      weight > existing.weight ||
      (weight === existing.weight && (p.reps != null && (existing.reps == null || Number(p.reps) > existing.reps)));

    if (better) {
      byCanonical.set(canonical, {
        canonical,
        weight,
        unit: p.unit || "lb",
        date: p.date,
        reps: p.reps,
        raw_lift: p.lift_name,
      });
    }
  }

  const order = ["bench_press", "squat", "deadlift", "shoulder_press", "row", "curl", "pullup", "dip", "other"];
  const result = [];
  for (const key of order) {
    const entry = byCanonical.get(key);
    if (!entry) continue;
    const displayName = CANONICAL_LIFT_DISPLAY[key] || entry.raw_lift || key;
    result.push({
      displayName,
      weight: entry.weight,
      unit: entry.unit,
      date: entry.date,
      reps: entry.reps,
    });
  }
  for (const [key, entry] of byCanonical) {
    if (order.includes(key)) continue;
    result.push({
      displayName: entry.raw_lift || key,
      weight: entry.weight,
      unit: entry.unit,
      date: entry.date,
      reps: entry.reps,
    });
  }
  return result;
}

/**
 * Fetch live user context from Supabase for context-aware AI chat.
 * Builds normalized PR summary, nutrition today, and a short athlete profile.
 */
async function fetchUserContext(userId) {
  const today = new Date().toISOString().slice(0, 10);

  const [
    workoutsRes,
    prsRes,
    measurementsRes,
    goalsRes,
    bodyweightRes,
    nutritionRes,
  ] = await Promise.all([
    supabase
      .from("workouts")
      .select("id, name, scheduled_for, created_at, exercises")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(RECENT_WORKOUTS_LIMIT),
    supabase
      .from("prs")
      .select("lift_name, weight, unit, date, reps, notes")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(RECENT_PRS_LIMIT),
    supabase
      .from("measurements")
      .select("name, value, unit, logged_at")
      .eq("user_id", userId)
      .order("logged_at", { ascending: false })
      .limit(RECENT_MEASUREMENTS_LIMIT),
    supabase
      .from("goals")
      .select("title, target_value, target_date, type, unit")
      .eq("user_id", userId),
    supabase
      .from("bodyweight_logs")
      .select("weight, unit, logged_at")
      .eq("user_id", userId)
      .order("logged_at", { ascending: false })
      .limit(RECENT_BODYWEIGHT_LIMIT),
    supabase
      .from("nutrition_entries")
      .select("date, calories, protein, carbs, fat")
      .eq("user_id", userId)
      .eq("date", today),
  ]);

  const workouts = workoutsRes.data || [];
  const prs = prsRes.data || [];
  const measurements = measurementsRes.data || [];
  const goals = goalsRes.data || [];
  const bodyweight = bodyweightRes.data || [];
  const nutritionEntries = nutritionRes.data || [];

  const prSummary = buildPRSummary(prs);

  let todayCalories = 0;
  let todayProtein = 0;
  let todayCarbs = 0;
  let todayFat = 0;
  for (const e of nutritionEntries) {
    todayCalories += Number(e.calories) || 0;
    todayProtein += Number(e.protein) || 0;
    todayCarbs += Number(e.carbs) || 0;
    todayFat += Number(e.fat) || 0;
  }

  const latestBw = bodyweight[0];
  const primaryGoal = goals[0];
  const recentWorkouts = workouts.slice(0, 7).map((w) => ({
    name: w.name,
    date: w.scheduled_for || w.created_at,
    exercise_count: Array.isArray(w.exercises) ? w.exercises.length : 0,
  }));
  const now = new Date();
  const inEightDays = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);
  const upcomingWorkouts = workouts.filter((w) => {
    if (!w.scheduled_for) return false;
    const scheduled = new Date(w.scheduled_for);
    return !isNaN(scheduled.getTime()) && scheduled >= now && scheduled <= inEightDays;
  }).slice(0, 5).map((w) => ({ name: w.name, scheduled_for: w.scheduled_for }));

  const prSummaryLines = prSummary.length
    ? prSummary.map((p) => `${p.displayName}: ${p.weight} ${p.unit}${p.reps != null ? ` (${p.reps} reps)` : ""}`).join("\n")
    : "No PRs logged.";

  const athleteProfile = [
    "--- ATHLETE PROFILE ---",
    `Bodyweight: ${latestBw ? `${latestBw.weight} ${latestBw.unit || "lb"}` : "Not logged"}`,
    `Primary goal: ${primaryGoal ? `${primaryGoal.title} (${primaryGoal.type || ""}) ${primaryGoal.target_value != null ? primaryGoal.target_value : ""} ${primaryGoal.unit || ""}`.trim() : "None set"}`,
    "",
    "PR Summary (best per lift):",
    prSummaryLines,
    "",
    "Today's nutrition:",
    nutritionEntries.length
      ? `Calories ${todayCalories}, Protein ${todayProtein}g, Carbs ${todayCarbs}g, Fat ${todayFat}g`
      : "No entries today",
    "",
    "Recent workouts (last 7):",
    recentWorkouts.length
      ? recentWorkouts.map((w) => `- ${w.name}${w.date ? ` (${String(w.date).slice(0, 10)})` : ""} [${w.exercise_count} exercises]`).join("\n")
      : "None",
    "",
    "Upcoming (next 7 days):",
    upcomingWorkouts.length
      ? upcomingWorkouts.map((w) => `- ${w.name} (${String(w.scheduled_for).slice(0, 10)})`).join("\n")
      : "None scheduled",
    "---",
  ].join("\n");

  const detail = {
    pr_summary: prSummary,
    pr_summary_text: prSummaryLines,
    nutrition_today: { calories: todayCalories, protein: todayProtein, carbs: todayCarbs, fat: todayFat },
    workouts: workouts.slice(0, 15).map((w) => ({
      name: w.name,
      scheduled_for: w.scheduled_for,
      created_at: w.created_at,
      exercise_count: Array.isArray(w.exercises) ? w.exercises.length : 0,
      exercises: Array.isArray(w.exercises)
        ? w.exercises.slice(0, 12).map((e) => ({ name: e.name, input: e.input ?? e.display_text ?? "" }))
        : [],
    })),
    measurements: measurements.slice(0, 10).map((m) => ({ name: m.name, value: m.value, unit: m.unit, logged_at: m.logged_at })),
    goals: goals.map((g) => ({ title: g.title, target_value: g.target_value, target_date: g.target_date, type: g.type, unit: g.unit })),
    bodyweight: bodyweight.slice(0, 5).map((b) => ({ weight: b.weight, unit: b.unit || "lb", logged_at: b.logged_at })),
    raw_prs_for_dates: prs.slice(0, 20).map((p) => ({
      lift: p.lift_name,
      normalized: normalizeLiftName(p.lift_name),
      weight: p.weight,
      unit: p.unit || "lb",
      date: p.date,
      reps: p.reps,
    })),
  };

  const contextStr = athleteProfile + "\n\nDETAIL (for lookups):\n" + JSON.stringify(detail);
  return contextStr.length > CONTEXT_JSON_MAX ? contextStr.slice(0, CONTEXT_JSON_MAX) + "…" : contextStr;
}

/**
 * Extract create_workout payload from model reply (may be wrapped in text or markdown).
 */
function extractCreateWorkout(reply) {
  if (!reply || typeof reply !== "string") return null;
  const trimmed = reply.trim();

  // Try direct parse
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && parsed.type === "create_workout" && Array.isArray(parsed.exercises)) return parsed;
  } catch (_) {}

  // Try to find JSON object in reply (e.g. wrapped in markdown or prefixed text)
  const jsonMatch = trimmed.match(/\{[\s\S]*"type"\s*:\s*"create_workout"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed && parsed.type === "create_workout" && Array.isArray(parsed.exercises)) return parsed;
    } catch (_) {}
  }

  const braceStart = trimmed.indexOf("{");
  if (braceStart !== -1) {
    let depth = 0;
    let end = -1;
    for (let i = braceStart; i < trimmed.length; i++) {
      if (trimmed[i] === "{") depth++;
      else if (trimmed[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end !== -1) {
      try {
        const parsed = JSON.parse(trimmed.slice(braceStart, end + 1));
        if (parsed && parsed.type === "create_workout" && Array.isArray(parsed.exercises)) return parsed;
      } catch (_) {}
    }
  }

  return null;
}

/**
 * Normalize create_workout payload to flexible exercise format only.
 */
function normalizeCreateWorkout(payload) {
  if (!payload || payload.type !== "create_workout") return null;
  const exercises = Array.isArray(payload.exercises)
    ? payload.exercises
        .map((ex) => {
          const name = (ex?.name ?? ex?.exercise ?? ex?.title ?? "Exercise").trim();
          const input =
            typeof ex?.input === "string"
              ? ex.input.trim()
              : (ex?.display_text ?? [ex?.sets, ex?.reps, ex?.percentage, ex?.rpe].filter(Boolean).join(" ")).trim() || "";
          return { name: name || "Exercise", input: input || name };
        })
        .filter((e) => e.name)
    : [];
  return {
    type: "create_workout",
    title: typeof payload.title === "string" ? payload.title.trim() : "Workout",
    scheduled_date: payload.scheduled_date ?? payload.scheduled_for ?? null,
    exercises,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message, userId } = req.body || {};

    if (!message || !userId) {
      return res.status(400).json({ error: "Missing message or userId" });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_pro")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.is_pro) {
      return res.status(403).json({
        error: "PRO_REQUIRED",
        message: "AI Coach is Pro only.",
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const { data: usage } = await supabase
      .from("ai_usage")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();

    const DAILY_LIMIT = 25;
    if (usage && usage.count >= DAILY_LIMIT) {
      return res.status(403).json({
        error: "DAILY_LIMIT_REACHED",
        message: "Daily AI limit reached.",
      });
    }

    let personality = "coach";
    const { data: settings } = await supabase
      .from("ai_settings")
      .select("personality")
      .eq("user_id", userId)
      .maybeSingle();
    if (settings?.personality) personality = settings.personality;

    const userContext = await fetchUserContext(userId);

    const systemPrompt = `You are ArmPal AI, an in-app strength coach. You have access to the signed-in user's live app data below. Use it to answer questions about their workouts, PRs, measurements, goals, and recent activity. Answer from real data when the user asks about "my" data.

CURRENT PERSONALITY: ${personality}
- coach: elite strength coach, structured, confident, professional
- friend: casual gym bro, relaxed, supportive
- motivation: hype energy, emotional push
- assistant: neutral, concise
- science: analytical, numbers-focused
- vulgar: unhinged hardcore coach, profanity expected, raw gym energy

USER'S LIVE APP DATA (use this to answer questions about their workouts, PRs, measurements, goals, bodyweight):
${userContext}

INTENT RULES:
1) WORKOUT CREATION: If the user asks you to CREATE or BUILD a workout (e.g. "build me a chest workout", "make me a bench day", "create a shoulder day", "give me a push workout", "make me a leg day", "workout for Monday", "based on my bench max"), you MUST respond with ONLY a single valid JSON object—no other text, no markdown, no code fence. Use this exact shape:
{"type":"create_workout","title":"Workout name","scheduled_date":null,"exercises":[{"name":"Exercise Name","input":"sets/reps/percentage/weight/RPE as one string"}]}
- "scheduled_date": optional; set if user mentioned a date (e.g. "for Monday" → use next Monday ISO date).
- "exercises": array of objects with ONLY "name" and "input". Example: {"name":"Bench Press","input":"85% 5x5"}
- If the user said "don't save it", "just an example", "just type it out", or "don't make a card", respond in normal conversational text instead of JSON.

2) LOOKUP / QUESTIONS: If the user asks about their data ("Do you see my March 9 workout?", "What are my PRs?", "What should I train today?", "Did I train chest this week?"), answer using the USER'S LIVE APP DATA above. Be specific and cite their actual workouts, dates, PRs, etc.

3) GENERAL CHAT: For motivation, form, nutrition, or other conversation, respond in normal text.

OUTPUT FORMAT:
- For workout creation (when not explicitly "don't save"): output ONLY the JSON object, nothing else.
- For everything else: output plain text.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: personality === "vulgar" ? 1.1 : 0.5,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
    });

    const reply = completion?.choices?.[0]?.message?.content ?? "No response";

    let create_workout = extractCreateWorkout(reply);
    if (create_workout) create_workout = normalizeCreateWorkout(create_workout);

    if (usage) {
      await supabase
        .from("ai_usage")
        .update({ count: usage.count + 1 })
        .eq("user_id", userId)
        .eq("date", today);
    } else {
      await supabase.from("ai_usage").insert({
        user_id: userId,
        date: today,
        count: 1,
      });
    }

    return res.status(200).json({
      reply: create_workout ? JSON.stringify(create_workout) : reply,
      create_workout: create_workout || undefined,
    });
  } catch (err) {
    console.error("AI HARD FAILURE:", err);
    return res.status(500).json({
      error: "AI failed",
      message: err.message,
    });
  }
}
