import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "nodejs" };

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {

    const { message, userId } = req.body;

    if (!message || !userId) {
      return res.status(400).json({ error: "Missing message or userId" });
    }

    // 🔥 SAFE DATA FETCH (NO COLUMN ASSUMPTIONS)
    const { data: prs } = await supabase
      .from("prs")
      .select("*")
      .eq("user_id", userId);

    const { data: workouts } = await supabase
      .from("workouts")
      .select("*")
      .eq("user_id", userId)
      .limit(5);

    const context = `
User PR data:
${JSON.stringify(prs || [])}

Recent workouts:
${JSON.stringify(workouts || [])}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are ArmPal AI. Use the user's training data below when answering:

${context}
`
        },
        { role: "user", content: message }
      ]
    });

    return res.status(200).json({
      reply: completion.choices[0].message.content
    });

  } catch (err) {

    console.error("AI ERROR:", err);

    return res.status(500).json({
      error: "AI failed",
      details: err.message
    });
  }
}
