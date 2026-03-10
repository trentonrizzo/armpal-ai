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

    const today = new Date().toISOString().slice(0, 10);
    const { data: usage } = await supabase
      .from("ai_usage")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();

    const CONVERT_DAILY_LIMIT = 10;
    if (usage && usage.workout_converts >= CONVERT_DAILY_LIMIT) {
      return res.status(403).json({
        error: "DAILY_LIMIT_REACHED",
        message: "Daily AI workout conversion limit reached (10). Try again tomorrow.",
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
- For EVERY exercise use ONLY "name" and "input". The first part of the line is the exercise name; everything else (sets, reps, %, RPE, notes) goes in "input" as a single string.

JSON SCHEMA:
{
  "workouts": [
    {
      "title": "Week 1 — Push Day",
      "week_number": 1,
      "day_label": "Day 1",
      "exercises": [
        { "name": "Bench Press", "input": "82.5% (275 lbs) 5x5" },
        { "name": "Incline Bench Press", "input": "72.5% (190 lbs) 3x8" }
      ]
    }
  ]
}

Example: "Bench Press 80% 5x5" → { "name": "Bench Press", "input": "80% 5x5" }
Example: "Squat 3x5 @ RPE 8" → { "name": "Squat", "input": "3x5 @ RPE 8" }`,
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

    // Normalize exercises to flexible format { name, input } only
    function normalizeExercise(ex) {
      if (!ex || typeof ex !== "object") return null;
      const name = ex.name ?? ex.exercise ?? ex.title ?? "Exercise";
      const trimmedName = String(name).trim();
      if (ex.input != null && String(ex.input).trim() !== "") {
        return { name: trimmedName, input: String(ex.input).trim() };
      }
      // Legacy: build input from display_text or sets/reps/percentage/etc.
      const display = ex.display_text ?? [ex.percentage, ex.sets && ex.reps ? `${ex.sets}x${ex.reps}` : ex.sets || ex.reps, ex.rpe ? `RPE ${ex.rpe}` : "", ex.notes].filter(Boolean).join(" ").trim();
      return { name: trimmedName, input: display || trimmedName };
    }

    let workouts = result.workouts.slice(0, cardLimit).map((w) => ({
      ...w,
      exercises: Array.isArray(w.exercises)
        ? w.exercises.map(normalizeExercise).filter(Boolean)
        : [],
    }));

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

    if (usage) {
      await supabase
        .from("ai_usage")
        .update({ workout_converts: (usage.workout_converts || 0) + 1 })
        .eq("user_id", userId)
        .eq("date", today);
    } else {
      await supabase.from("ai_usage").insert({
        user_id: userId,
        date: today,
        workout_converts: 1,
      });
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
