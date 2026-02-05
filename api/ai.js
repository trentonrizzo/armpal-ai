import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "nodejs" };

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 🔥 MASTER CONTEXT BUILDER
async function buildUserContext(userId) {
  try {

    const tables = [
      "prs",
      "workouts",
      "goals",
      "measurements",
      "profiles"
    ];

    let context = {};

    for (const table of tables) {
      const { data } = await supabase
        .from(table)
        .select("*")
        .eq("user_id", userId);

      context[table] = data || [];
    }

    return context;

  } catch (err) {
    console.error("Context build failed:", err);
    return {};
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message, userId } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Missing message" });
    }

    // 🔥 BUILD FULL USER CONTEXT
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
You are ArmPal AI — an in-app elite fitness coach.

You have FULL access to user data:

${JSON.stringify(userContext)}

Use this to give personalized responses.
`
        },
        { role: "user", content: message }
      ],
    });

    const reply =
      completion?.choices?.[0]?.message?.content || "No response.";

    return res.status(200).json({ reply });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "AI failed",
      message: err.message,
    });
  }
}
