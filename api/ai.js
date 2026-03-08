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
const RECENT_PRS_LIMIT = 30;
const RECENT_MEASUREMENTS_LIMIT = 20;
const RECENT_BODYWEIGHT_LIMIT = 14;
const CONTEXT_JSON_MAX = 8000;

/**
 * Fetch live user context from Supabase for context-aware AI chat.
 * Returns a compact summary for the system prompt.
 */
async function fetchUserContext(userId) {
  const [workoutsRes, prsRes, measurementsRes, goalsRes, bodyweightRes] = await Promise.all([
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
  ]);

  const workouts = workoutsRes.data || [];
  const prs = prsRes.data || [];
  const measurements = measurementsRes.data || [];
  const goals = goalsRes.data || [];
  const bodyweight = bodyweightRes.data || [];

  const summary = {
    workouts: workouts.map((w) => ({
      name: w.name,
      scheduled_for: w.scheduled_for,
      created_at: w.created_at,
      exercise_count: Array.isArray(w.exercises) ? w.exercises.length : 0,
      exercises: Array.isArray(w.exercises)
        ? w.exercises.slice(0, 15).map((e) => ({ name: e.name, input: e.input ?? e.display_text ?? "" }))
        : [],
    })),
    prs: prs.map((p) => ({
      lift: p.lift_name,
      weight: p.weight,
      unit: p.unit || "lb",
      date: p.date,
      reps: p.reps,
      notes: p.notes,
    })),
    measurements: measurements.map((m) => ({
      name: m.name,
      value: m.value,
      unit: m.unit,
      logged_at: m.logged_at,
    })),
    goals: goals.map((g) => ({
      title: g.title,
      target_value: g.target_value,
      target_date: g.target_date,
      type: g.type,
      unit: g.unit,
    })),
    bodyweight: bodyweight.map((b) => ({ weight: b.weight, unit: b.unit || "lb", logged_at: b.logged_at })),
  };

  const contextStr = JSON.stringify(summary);
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
