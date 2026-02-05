import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "nodejs" };

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Only create Supabase client IF env vars exist
let supabase = null;
if (
  process.env.SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  try {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  } catch (e) {
    supabase = null;
  }
}

// 🔒 SAFE CONTEXT BUILDER — CANNOT CRASH
async function buildUserSummary(userId) {
  if (!supabase || !userId) {
    return "User data access not available.";
  }

  const summary = [];

  try {
    const { data: prs } = await supabase
      .from("prs")
      .select("*")
      .eq("user_id", userId);

    if (prs?.length) {
      summary.push(
        "Personal Records:\n" +
          prs
            .map(
              (p) =>
                `- ${p.exercise || "Exercise"}: ${p.weight || "?"} x ${p.reps || "?"}`
            )
            .join("\n")
      );
    }
  } catch {}

  try {
    const { data: workouts } = await supabase
      .from("workouts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (workouts?.[0]) {
      summary.push(
        `Most recent workout: ${workouts[0].name || "Workout"}`
      );
    }
  } catch {}

  if (!summary.length) {
    return "No training data found yet.";
  }

  return summary.join("\n\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY missing" });
  }

  try {
    const { message, userId } = req.body || {};

    if (!message) {
      return res.status(400).json({ error: "Missing message" });
    }

    let userSummary = "No user context available.";
    try {
      userSummary = await buildUserSummary(userId);
    } catch {
      userSummary = "User context unavailable.";
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `
You are ArmPal AI, an in-app fitness coach.

User context:
${userSummary}

Use this when helpful. If data is missing, ask the user to log it.
`,
        },
        { role: "user", content: message },
      ],
    });

    const reply =
      completion?.choices?.[0]?.message?.content || "No response.";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("AI ERROR:", err);
    return res.status(200).json({
      reply:
        "I'm having trouble accessing your data right now, but I'm still here to help. What do you want to work on?",
    });
  }
}
