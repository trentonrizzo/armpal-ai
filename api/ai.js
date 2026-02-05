import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "nodejs" };

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const hasSupabaseEnv =
  !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = hasSupabaseEnv
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

export default async function handler(req, res) {
  const requestId = Math.random().toString(36).slice(2, 9);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed", requestId });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY missing", requestId });
  }

  try {
    const body = req.body ?? {};
    const message = body.message;
    const userId = body.userId;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing or invalid message", requestId });
    }

    // ✅ Build context safely (never block replying)
    let contextText = "No user context available.";
    if (supabase && userId) {
      try {
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

        contextText = `User training data:
PRs: ${JSON.stringify(prs ?? [])}
Latest workout: ${JSON.stringify((workouts ?? [])[0] ?? null)}`;
      } catch (ctxErr) {
        console.error("Context build failed:", ctxErr);
        contextText = "User context lookup failed (continuing without it).";
      }
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            `You are ArmPal AI, an in-app fitness coach.\n\n` +
            `Context:\n${contextText}\n\n` +
            `Use context naturally when helpful. Be concise and actionable.`,
        },
        { role: "user", content: message },
      ],
    });

    const reply = completion?.choices?.[0]?.message?.content ?? "";

    return res.status(200).json({ reply, requestId });
  } catch (err) {
    console.error("AI HARD FAILURE:", err);
    return res.status(500).json({
      error: "AI failed",
      message: err.message,
      requestId,
    });
  }
}
