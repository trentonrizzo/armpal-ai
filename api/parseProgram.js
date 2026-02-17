import OpenAI from "openai";

export const config = { runtime: "nodejs" };

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `Convert the following training program into ArmPal schema.
Return ONLY valid JSON, no markdown or code fences:

{
  "frequency_range": [],
  "layouts": {
    "3": {
      "summary": "",
      "days": [
        {
          "name": "",
          "exercises": [
            { "name": "", "sets": "", "reps": "", "intensity": "" }
          ]
        }
      ]
    }
  }
}

Use numeric keys for layouts (e.g. "2", "3", "4", "5", "6") based on the program structure.
Each layout must have "summary" and "days". Each day must have "name" and "exercises".
Each exercise must have "name", "sets", "reps"; "intensity" is optional.`;

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
      return res.status(500).json({ error: "Empty response from AI" });
    }

    const parsed = JSON.parse(text);
    return res.status(200).json(parsed);
  } catch (e) {
    console.error("parseProgram error:", e);
    return res.status(500).json({
      error: e.message || "Failed to parse program",
    });
  }
}
