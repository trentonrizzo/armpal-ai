import OpenAI from "openai";

export const config = { runtime: "nodejs" };

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `Analyze this training program and generate marketplace metadata.
Return ONLY valid JSON, no markdown or code fences:

{
  "description": "Short marketplace description (1-2 sentences).",
  "difficulty": "Beginner | Intermediate | Advanced | Elite",
  "tags": ["Hook", "Strength", "Hypertrophy", "Toproll", "Powerlifting", "General Fitness"],
  "thumbnail_style": "dark_strength | armwrestling_hook | minimal_clean"
}

Pick 1-4 tags that fit the program. Use only: Hook, Strength, Hypertrophy, Toproll, Powerlifting, General Fitness (or subset).
thumbnail_style: use dark_strength for heavy/strength, armwrestling_hook for arm wrestling, minimal_clean for general/clean programs.`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { rawContent, parsedProgram } = req.body || {};
    const userContent = `Raw content:\n${rawContent || ""}\n\nParsed program (JSON):\n${JSON.stringify(parsedProgram || {}, null, 2)}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
    });

    const text = completion.choices?.[0]?.message?.content;
    if (!text) {
      return res.status(500).json({ error: "Empty response from AI" });
    }

    const parsed = JSON.parse(text);
    return res.status(200).json(parsed);
  } catch (e) {
    console.error("enrichProgram error:", e);
    return res.status(500).json({
      error: e.message || "Failed to enrich program",
    });
  }
}
