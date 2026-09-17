import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { assertProProfile } from "./_lib/assertProProfile.js";

export const config = { runtime: "nodejs" };

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MODIFICATIONS = {
  beginner: "Adapt this program for beginners: reduce intensity, add progression notes, lower volume per session, keep the same ArmPal JSON structure (frequency_range, layouts with summary and days, each day with name and exercises with name, sets, reps, intensity). Return ONLY valid JSON.",
  strength: "Adapt this program for maximum strength focus: emphasize heavy sets, lower reps, higher intensity, keep the same ArmPal JSON structure. Return ONLY valid JSON.",
  short_sessions: "Adapt this program for shorter sessions (30–45 min): reduce exercises per day, keep key movements, same ArmPal JSON structure (frequency_range, layouts, days, exercises). Return ONLY valid JSON.",
  hook_focus: "Adapt this program for arm wrestling hook focus: emphasize cup, pronation, back pressure, and hook-specific movements. Keep the same ArmPal JSON structure. Return ONLY valid JSON.",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { baseProgram, modification, userId } = req.body || {};
    const pro = await assertProProfile(supabase, userId);
    if (!pro.ok) {
      return res.status(pro.status).json({ error: pro.error, message: pro.message });
    }
    if (!baseProgram || !modification || !MODIFICATIONS[modification]) {
      return res.status(400).json({ error: "Missing baseProgram or invalid modification" });
    }

    const systemPrompt = MODIFICATIONS[modification];
    const userContent = `Current program (JSON):\n${JSON.stringify(baseProgram, null, 2)}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
    });

    const text = completion.choices?.[0]?.message?.content;
    if (!text) {
      return res.status(500).json({ error: "Empty response from AI" });
    }

    const parsed = JSON.parse(text);
    return res.status(200).json(parsed);
  } catch (e) {
    console.error("modifyProgram error:", e);
    return res.status(500).json({
      error: e.message || "Failed to modify program",
    });
  }
}
