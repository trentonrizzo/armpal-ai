import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const config = {
  runtime: "nodejs",
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ Safe Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {

    const { message, userId } = req.body || {};

    if (!message || !userId) {
      return res.status(400).json({
        error: "Missing message or userId"
      });
    }

    // 🔥 SAFE DATA FETCH (NO COLUMN ASSUMPTIONS)
    let prs = [];
    let workouts = [];

    try {
      const prsRes = await supabase
        .from("prs")
        .select("*")
        .eq("user_id", userId);

      if (!prsRes.error) prs = prsRes.data || [];
    } catch {}

    try {
      const workoutRes = await supabase
        .from("workouts")
        .select("*")
        .eq("user_id", userId)
        .limit(5);

      if (!workoutRes.error) workouts = workoutRes.data || [];
    } catch {}

    // ✅ Build context safely
    const context = `
User PR Data:
${JSON.stringify(prs)}

Recent Workouts:
${JSON.stringify(workouts)}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content: `
You are ArmPal AI, an in-app strength coach.

You have access to the user's real training data below.

Use it when answering:

${context}
`
        },
        {
          role: "user",
          content: message
        }
      ]
    });

    const reply = completion?.choices?.[0]?.message?.content || "No reply.";

    return res.status(200).json({ reply });

  } catch (err) {

    console.error("AI ERROR:", err);

    return res.status(500).json({
      error: "AI failed",
      message: err.message
    });
  }
}
