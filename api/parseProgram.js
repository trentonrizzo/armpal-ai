import OpenAI from "openai";

export const config = { runtime: "nodejs" };

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are converting free-form workout text into a simple JSON schema for ArmPal.

Return ONLY valid JSON, no markdown or code fences.

Schema (REQUIRED):
{
  "days": [
    {
      "name": "Day 1 - Upper",
      "exercises": [
        { "name": "Bench Press", "input": "4x6 @ 80%" },
        { "name": "Incline DB Press", "input": "3x10" }
      ]
    }
  ]
}

Rules:
- Always return an object with a "days" array.
- If the user does not specify days explicitly, create "Day 1" and group all exercises there.
- Every exercise must have ONLY "name" and "input". The exercise name goes in "name"; everything else (sets, reps, weight, %, RPE, tempo, notes) goes in "input" as one string.
- Example: "Bench Press 4x6 @ 80%" -> { "name": "Bench Press", "input": "4x6 @ 80%" }
- Example: "Squat 3x5 RPE 8" -> { "name": "Squat", "input": "3x5 RPE 8" }
- Do NOT use sets, reps, weight, percentage, display_text fields. Only name and input.
- Do NOT include any other top-level keys besides "days".
- If truly no exercises can be detected, return { "days": [] }.
`;

function normalizeExercise(ex) {
  if (!ex || typeof ex !== "object") return null;
  const name = String(ex.name ?? ex.exercise ?? ex.title ?? "Exercise").trim();
  if (ex.input != null && String(ex.input).trim() !== "") {
    return { name, input: String(ex.input).trim() };
  }
  const parts = [
    ex.percentage,
    ex.sets != null && ex.reps != null ? `${ex.sets}x${ex.reps}` : (ex.sets ?? ex.reps ?? null),
    ex.rpe ? `RPE ${ex.rpe}` : null,
    ex.notes,
  ].filter(Boolean).join(" ").trim();
  return { name, input: parts || name };
}

function normalizeDays(parsed) {
  if (parsed && Array.isArray(parsed.days)) {
    return {
      days: parsed.days.map((day, i) => ({
        name: day?.name || `Day ${i + 1}`,
        exercises: Array.isArray(day?.exercises)
          ? day.exercises.map(normalizeExercise).filter(Boolean)
          : [],
      })),
    };
  }

  const layouts = parsed?.layouts;
  const layoutKeys = layouts && typeof layouts === "object" ? Object.keys(layouts) : [];
  if (layoutKeys.length > 0) {
    const firstLayout = layouts[layoutKeys[0]] || {};
    const sourceDays = Array.isArray(firstLayout.days)
      ? firstLayout.days
      : Array.isArray(firstLayout.workouts)
      ? firstLayout.workouts
      : [];

    const days = sourceDays.map((day, i) => ({
      name: day?.name || `Day ${i + 1}`,
      exercises: Array.isArray(day?.exercises)
        ? day.exercises.map(normalizeExercise).filter(Boolean)
        : [],
    }));

    return { days };
  }

  return { days: [] };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { rawContent } = req.body || {};
    if (!rawContent || typeof rawContent !== "string") {
      return res.status(400).json({ error: "Missing rawContent" });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: rawContent },
      ],
      response_format: { type: "json_object" },
    });

    const text = completion.choices?.[0]?.message?.content;
    if (!text) {
      return res.status(200).json({ days: [] });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error("parseProgram JSON.parse failed:", e);
      return res.status(200).json({ days: [] });
    }

    const normalized = normalizeDays(parsed);
    return res.status(200).json(normalized);
  } catch (e) {
    console.error("parseProgram error:", e);
    return res.status(500).json({
      error: e.message || "Failed to parse program",
    });
  }
}
