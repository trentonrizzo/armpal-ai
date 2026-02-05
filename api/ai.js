import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "nodejs" };

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Server-side Supabase (FULL ACCESS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 🔥 SAFE AUTO CONTEXT BUILDER
async function buildUserContext(userId) {

  const tables = [
    "prs",
    "workouts",
    "goals",
    "measurements",
    "profiles"
  ];

  let context = {};

  for (const table of tables) {
    try {

      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("user_id", userId);

      if (error) {
        console.log(`Skipping table ${table}:`, error.message);
        continue;
      }

      context[table] = data || [];

    } catch (err) {
      console.log(`Table failed ${table}`);
    }
  }

  return context;
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

    // 🔥 BUILD CONTEXT (never crashes now)
    let userContext = {};

    if (userId) {
      userContext = await buildUserContext(userId);
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `
You are ArmPal AI — an elite in-app fitness coach.

You have access to the user's training data:

${JSON.stringify(userContext)}

Use this context naturally when helpful.
`
        },
        { role: "user", content: message }
      ],
    });

    const reply =
      completion?.choices?.[0]?.message?.content ||
      "No response.";

    return res.status(200).json({ reply });

  } catch (err) {

    console.error("AI HARD FAILURE:", err);

    // 🔥 FALLBACK RESPONSE (AI NEVER SILENT AGAIN)
    try {

      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are ArmPal AI." },
          { role: "user", content: req.body?.message || "Hello" }
        ],
      });

      const reply =
        completion?.choices?.[0]?.message?.content ||
        "Fallback response.";

      return res.status(200).json({ reply });

    } catch (fallbackError) {

      return res.status(500).json({
        error: "AI failed completely",
        message: fallbackError.message,
      });

    }
  }
}
