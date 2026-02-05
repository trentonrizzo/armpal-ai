import OpenAI from "openai";

export const config = { runtime: "nodejs" };

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {

    const { message } = req.body || {};

    if (!message) {
      return res.status(400).json({ error: "Missing message" });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: "You are ArmPal AI, an in-app fitness coach."
        },
        {
          role: "user",
          content: message
        }
      ],
    });

    const reply =
      completion?.choices?.[0]?.message?.content || "No response.";

    return res.status(200).json({ reply });

  } catch (err) {

    console.error("AI ERROR:", err);

    return res.status(500).json({
      error: "AI failed",
      message: err.message
    });

  }
}
