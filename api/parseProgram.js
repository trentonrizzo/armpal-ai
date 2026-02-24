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
        { "name": "Bench Press", "sets": 4, "reps": 6 },
        { "name": "Incline DB Press", "sets": 3, "reps": 10 }
      ]
    }
  ]
}

Rules:
- Always return an object with a "days" array.
- If the user does not specify days explicitly, create "Day 1" and group all exercises there.
- Parse obvious patterns like "4x6", "4 x 6", "4 sets of 6" as sets=4, reps=6.
- If you cannot confidently determine sets or reps for an exercise, set that property to null.
- Do NOT include any other top-level keys besides "days".
- If truly no exercises can be detected, return { "days": [] }.
`;

function normalizeDays(parsed) {
  // Already in desired shape
  if (parsed && Array.isArray(parsed.days)) {
    return {
      days: parsed.days.map((day, i) => ({
        name: day?.name || `Day ${i + 1}`,
        exercises: Array.isArray(day?.exercises)
          ? day.exercises.map((ex) => ({
              name: ex?.name || "Exercise",
              sets:
                typeof ex?.sets === "number"
                  ? ex.sets
                  : ex?.sets != null && !isNaN(Number(ex.sets))
                  ? Number(ex.sets)
                  : null,
              reps:
                typeof ex?.reps === "number"
                  ? ex.reps
                  : ex?.reps != null && !isNaN(Number(ex.reps))
                  ? Number(ex.reps)
                  : null,
            }))
          : [],
      })),
    };
  }

  // Fallback: try to map from legacy ArmPal layout schema if present
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
        ? day.exercises.map((ex) => ({
            name: ex?.name || "Exercise",
            sets:
              typeof ex?.sets === "number"
                ? ex.sets
                : ex?.sets != null && !isNaN(Number(ex.sets))
                ? Number(ex.sets)
                : null,
            reps:
              typeof ex?.reps === "number"
                ? ex.reps
                : ex?.reps != null && !isNaN(Number(ex.reps))
                ? Number(ex.reps)
                : null,
          }))
        : [],
    }));

    return { days };
  }

  // Last resort: no structure we recognize
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
