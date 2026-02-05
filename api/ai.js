import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const config = {
  runtime: "nodejs",
};

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// SERVER SIDE SUPABASE (SERVICE ROLE ONLY)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const requestId = Math.random().toString(36).slice(2, 9);

  console.log("----- AI REQUEST START -----");
  console.log("Request ID:", requestId);

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: "OPENAI_API_KEY missing",
      requestId,
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
      requestId,
    });
  }

  try {
    const body = req.body ?? {};
    const { message, userId } = body;

    if (!message || !userId) {
      return res.status(400).json({
        error: "Missing message or userId",
        requestId,
      });
    }

    // 🔥 FETCH USER DATA FROM SUPABASE

    const { data: prs } = await supabase
      .from("prs")
      .select("*")
      .eq("user_id", userId);

    const { data: workouts } = await supabase
      .from("workouts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    // 🔥 BUILD CONTEXT STRING
    const userContext = `
User training data:

PRs:
${JSON.stringify(prs)}

Latest Workout:
${JSON.stringify(workouts)}
`;

    console.log("Context built.");

    // 🔥 CALL OPENAI
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `
You are ArmPal AI — an in-app fitness coach.

You have access to user training data:

${userContext}

Use this naturally in advice. Speak like a knowledgeable coach.
`,
        },
        { role: "user", content: message },
      ],
    });

    const reply =
      completion?.choices?.[0]?.message?.content ?? null;

    if (!reply) {
      return res.status(500).json({
        error: "No AI response",
        requestId,
      });
    }

    console.log("----- AI REQUEST SUCCESS -----");

    return res.status(200).json({
      reply,
      requestId,
    });
  } catch (err) {
    console.error("AI HARD FAILURE", err);

    return res.status(500).json({
      error: "AI failed",
      message: err.message,
      requestId,
    });
  }
}
