import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "nodejs" };

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// SERVER SIDE SUPABASE CLIENT (FULL ACCESS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 🔥 SAFE USER SUMMARY BUILDER
async function buildUserSummary(userId) {

  let summaryParts = [];

  // ----- PRs -----
  try {
    const { data: prs, error } = await supabase
      .from("prs")
      .select("*")
      .eq("user_id", userId);

    if (!error && prs?.length) {

      const prLines = prs.map(p => {
        const exercise = p.exercise || "Exercise";
        const weight = p.weight || "?";
        const reps = p.reps || "?";
        return `- ${exercise}: ${weight} x ${reps}`;
      });

      summaryParts.push(
        `Personal Records:\n${prLines.join("\n")}`
      );
    }

  } catch (e) {
    console.log("PRS skipped");
  }

  // ----- Recent Workout -----
  try {
    const { data: workouts } = await supabase
      .from("workouts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (workouts?.[0]) {
      summaryParts.push(
        `Most recent workout: ${workouts[0].name || "Workout logged"}`
      );
    }

  } catch (e) {
    console.log("Workouts skipped");
  }

  // ----- Goals -----
  try {
    const { data: goals } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", userId);

    if (goals?.length) {
      const goalLines = goals.map(g => `- ${g.title || "Goal"}`);
      summaryParts.push(
        `Goals:\n${goalLines.join("\n")}`
      );
    }

  } catch (e) {
    console.log("Goals skipped");
  }

  if (!summaryParts.length) {
    return "No training data found yet.";
  }

  return summaryParts.join("\n\n");
}

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {

    const { message, userId } = req.body || {};

    if (!message) {
      return res.status(400).json({ error: "Missing message" });
    }

    // 🔥 BUILD USER CONTEXT SAFELY
    let userSummary = "No user context available.";

    if (userId) {
      userSummary = await buildUserSummary(userId);
    }

    // 🔥 OPENAI REQUEST
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `
You are ArmPal AI — an elite in-app fitness coach.

Here is what you know about the user:

${userSummary}

Use this information naturally in advice.
If data is missing, encourage logging inside ArmPal.
`
        },
        {
          role: "user",
          content: message
        }
      ],
    });

    const reply =
      completion?.choices?.[0]?.message?.content ||
      "No response.";

    return res.status(200).json({ reply });

  } catch (err) {

    console.error("AI ERROR:", err);

    return res.status(500).json({
      error: "AI failed",
      message: err.message
    });

  }
}
