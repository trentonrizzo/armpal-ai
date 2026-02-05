import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "nodejs" };

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
      return res.status(400).json({ error: "Missing message or userId" });
    }

    // ✅ Fetch PRs safely
    const { data: prs } = await supabase
      .from("prs")
      .select("*")
      .eq("user_id", userId);

    const allPRs = prs || [];

    // 🔥 Identify bench PR
    const benchPRs = allPRs.filter(pr =>
      pr.lift_name.toLowerCase().includes("bench")
    );

    const bestBench =
      benchPRs.length > 0
        ? benchPRs.sort((a, b) => b.weight - a.weight)[0]
        : null;

    // 🧠 Build clean context
    const context = `
User PR Summary:

Bench Press PR:
${bestBench ? `${bestBench.weight}${bestBench.unit} x ${bestBench.reps} reps` : "No bench PR logged"}

All PRs:
${JSON.stringify(allPRs, null, 2)}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content: `
You are ArmPal AI, a personal strength coach.
You have access to the user's real PR data below.
Answer questions using this data accurately.

${context}
`
        },
        { role: "user", content: message }
      ]
    });

    const reply = completion.choices[0]?.message?.content || "No reply.";

    return res.status(200).json({ reply });

  } catch (err) {
    console.error("AI ERROR:", err);
    return res.status(500).json({
      error: "AI failed",
      message: err.message
    });
  }
}
