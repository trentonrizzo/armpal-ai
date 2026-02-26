/*
  POST /api/ai/workout-converter
  Accepts { program_text, start_date, training_days, max_cards, userId }

  1. AI parses program_text into structured workout cards (no dates).
  2. Backend assigns dates based on start_date + training_days.
  3. Returns { workouts: [...] } to the frontend which saves to DB.
*/

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "nodejs" };

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MAX_CARDS_HARD_LIMIT = 100;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { program_text, start_date, training_days, max_cards, userId } =
      req.body || {};

    if (!program_text || !userId) {
      return res
        .status(400)
        .json({ error: "Missing program_text or userId" });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_pro")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.is_pro) {
      return res.status(403).json({
        error: "PRO_REQUIRED",
        message: "AI Workout Converter is a Pro feature.",
      });
    }

    const cardLimit = Math.min(
      Math.max(1, Number(max_cards) || 50),
      MAX_CARDS_HARD_LIMIT
    );

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      max_tokens: 16384,
      messages: [
        {
          role: "system",
          content: `You are a precise workout program parser. Convert the user's program description into structured workout cards.

RULES:
- Return ONLY valid JSON matching the schema below.
- Generate at most ${cardLimit} workout cards.
- Each workout object = one training session / day.
- Parse ALL formats: percentages (80%), rep ranges (8-12), RPE (RPE 7), sets x reps (5x5), supersets, notes, progression.
- If the program specifies weeks, group workouts by week and label them.
- Preserve exercise details exactly as described.
- Do NOT invent exercises not described. Do NOT assign dates (backend handles dates).
- For sets/reps that are ranges (e.g. 8-12), put the range string as-is in the reps field.

JSON SCHEMA:
{
  "workouts": [
    {
      "title": "Week 1 — Push Day",
      "week_number": 1,
      "day_label": "Day 1",
      "exercises": [
        {
          "name": "Bench Press",
          "sets": "5",
          "reps": "5",
          "percentage": "80%",
          "rpe": "",
          "notes": ""
        }
      ]
    }
  ]
}`,
        },
        {
          role: "user",
          content: `Convert this training program into workout cards:\n\n${program_text.slice(0, 12000)}`,
        },
      ],
    });

    const raw = completion?.choices?.[0]?.message?.content;

    if (!raw) {
      return res.status(500).json({ error: "No response from AI" });
    }

    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      return res
        .status(500)
        .json({ error: "AI returned invalid JSON. Try reducing program size." });
    }

    if (!Array.isArray(result.workouts)) {
      return res
        .status(500)
        .json({ error: "Unexpected AI response structure" });
    }

    let workouts = result.workouts.slice(0, cardLimit);

    if (
      start_date &&
      Array.isArray(training_days) &&
      training_days.length > 0
    ) {
      const daySet = new Set(training_days.map(Number));
      const current = new Date(start_date + "T12:00:00");
      let wi = 0;
      const safety = cardLimit * 60;

      for (let iter = 0; wi < workouts.length && iter < safety; iter++) {
        if (daySet.has(current.getDay())) {
          const dateStr = current.toISOString().slice(0, 10);
          workouts[wi] = {
            ...workouts[wi],
            assigned_date: dateStr + "T09:00",
          };
          wi++;
        }
        current.setDate(current.getDate() + 1);
      }
    }

    return res.status(200).json({ workouts });
  } catch (err) {
    console.error("WORKOUT CONVERTER ERROR:", err);
    return res.status(500).json({
      error: "Conversion failed",
      message: err.message,
    });
  }
}
