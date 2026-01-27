/**
 * AI CHAT BRAIN (PREMIUM ONLY)
 * --------------------------------
 * - Fitness-only scoped AI
 * - Personality-aware
 * - No assumptions about workouts
 * - Math + reasoning enabled
 * - Ready for memory injection later
 */

import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { isPro, message, mode, context } = req.body;

  if (!isPro) {
    return res.status(403).json({ error: "Premium required" });
  }

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Invalid message" });
  }

  const personalityMap = {
    savage:
      "You are brutally honest, blunt, and intense. You do not sugarcoat.",
    coach:
      "You are a professional strength coach. Clear, calm, structured.",
    motivation:
      "You are uplifting, encouraging, and momentum-driven.",
    recovery:
      "You prioritize recovery, fatigue management, and joint health.",
    science:
      "You explain using evidence, numbers, RPE, volume, and logic.",
    vulgar:
      "You are sarcastic, crude, chaotic, and offensive for humor, but still correct.",
  };

  const systemPrompt = `
You are ArmPal AI Coach.
You are a FITNESS-ONLY assistant.

RULES:
- Never assume a workout was completed unless explicitly logged.
- If data is missing, say so.
- You may calculate, explain, and reason.
- Do NOT give medical advice.
- Keep responses practical and actionable.

PERSONALITY:
${personalityMap[mode] || personalityMap.coach}

USER CONTEXT:
${context || "No additional context provided."}
`;

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      temperature: 0.7,
    });

    const reply = completion.choices[0].message.content;

    return res.status(200).json({ reply });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "AI request failed" });
  }
}
