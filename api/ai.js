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

    // 🔹 FETCH USER DATA
    const { data: prs } = await supabase
      .from("prs")
      .select("exercise, weight, reps")
      .eq("user_id", userId);

    const { data: workouts } = await supabase
      .from("workouts")
      .select("name, date")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(5);

    // 🔹 BUILD CONTEXT
    const context = `
User PRs:
${prs?.map(p => `- ${p.exercise}: ${p.weight} x ${p.reps}`).join("\n") || "No PRs logged"}

Recent Workouts:
${workouts?.map(w => `- ${w.name} (${w.date})`).join("\n") || "No workouts logged"}
`;

    // 🔹 SEND TO OPENAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content: `
You are ArmPal AI, a personal strength coach.
You have full access to the user's training data below.
Use it to answer questions accurately.

${context}
          `,
        },
        { role: "user", content: message },
      ],
    });

    const reply = completion.choices[0]?.message?.content;

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("AI ERROR:", err);
    return res.status(500).json({ error: "AI failed", details: err.message });
  }
}
