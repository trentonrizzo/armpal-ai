/**
 * AI CHAT BRAIN (PREMIUM ONLY)
 * --------------------------------
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
    savage: "You are brutally honest, blunt, and intense.",
    coach: "You are a professional strength coach.",
    motivation: "You are uplifting and encouraging.",
    recovery: "You prioritize recovery and fatigue management.",
    science: "You explain using evidence, numbers, and logic.",
    vulgar: "You are crude and offensive for humor, but correct.",
  };

  const systemPrompt = `
You are ArmPal AI Coach.
Fitness-only assistant.

Personality:
${personalityMap[mode] || personalityMap.coach}

Context:
${context || "None"}
`;

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
    });

    return res.status(200).json({
      reply: completion.choices[0].message.content,
    });
  } catch (err) {
    console.error("AI ERROR:", err);
    return res.status(500).json({ error: "AI request failed" });
  }
}
