/*
  POST /api/ai/food-scan
  Accepts { imagePath, userId, mealDate } where imagePath is a Supabase
  Storage key inside the "food_scan_images" bucket.

  REQUIRED SETUP:
  1. Supabase Storage bucket "food_scan_images" (can be private).
  2. (Optional) Supabase table "food_scans" for scan history & rate-limiting:
       id uuid primary key default gen_random_uuid(),
       user_id uuid references auth.users(id),
       created_at timestamptz default now(),
       meal_date date,
       image_path text,
       ai_result_json jsonb,
       total_calories int default 0,
       total_protein int default 0,
       total_carbs int default 0,
       total_fat int default 0,
       confidence text,
       status text default 'completed'
     + RLS policy: user can select/insert own rows.
*/

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "nodejs" };

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DAILY_SCAN_LIMIT = 20;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { imagePath, userId, mealDate } = req.body || {};

    if (!imagePath || !userId) {
      return res.status(400).json({ error: "Missing imagePath or userId" });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_pro")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.is_pro) {
      return res.status(403).json({
        error: "PRO_REQUIRED",
        message: "Smart Food Scan is a Pro feature.",
      });
    }

    const today = new Date().toISOString().slice(0, 10);

    const { count: scanCount, error: countErr } = await supabase
      .from("food_scans")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", today + "T00:00:00Z");

    if (!countErr && scanCount >= DAILY_SCAN_LIMIT) {
      return res.status(429).json({
        error: "SCAN_LIMIT_REACHED",
        message: `Daily scan limit (${DAILY_SCAN_LIMIT}) reached. Try again tomorrow.`,
      });
    }

    const { data: signedData, error: signErr } = await supabase.storage
      .from("food_scan_images")
      .createSignedUrl(imagePath, 300);

    if (signErr || !signedData?.signedUrl) {
      return res.status(500).json({
        error: "Failed to access uploaded image",
        details: signErr?.message,
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      max_tokens: 1024,
      messages: [
        {
          role: "system",
          content: `You are a precise food nutrition analysis AI. Analyze the food image and return nutritional estimates.

RULES:
- Return ONLY valid JSON matching the schema below.
- Identify ALL visible food items individually.
- Estimate portions from visual cues (plate size, utensils, hands for scale).
- Round macros to whole numbers.
- Be conservative with estimates.
- confidence: "low" if blurry/ambiguous, "medium" if decent, "high" if clearly identifiable.

JSON SCHEMA:
{
  "foods": [
    { "name": "string", "estimated_amount": "string", "calories": int, "protein": int, "carbs": int, "fat": int }
  ],
  "totals": { "calories": int, "protein": int, "carbs": int, "fat": int },
  "confidence": "low|medium|high",
  "notes": "one-line disclaimer about estimate accuracy"
}`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze all food in this image. Return nutritional estimates as JSON.",
            },
            {
              type: "image_url",
              image_url: { url: signedData.signedUrl, detail: "high" },
            },
          ],
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
      return res.status(500).json({ error: "Invalid JSON from AI", raw });
    }

    if (!Array.isArray(result.foods) || !result.totals) {
      return res.status(500).json({ error: "Unexpected AI response structure" });
    }

    // Persist scan metadata (graceful — table may not exist yet)
    await supabase
      .from("food_scans")
      .insert({
        user_id: userId,
        meal_date: mealDate || today,
        image_path: imagePath,
        ai_result_json: result,
        total_calories: result.totals.calories || 0,
        total_protein: result.totals.protein || 0,
        total_carbs: result.totals.carbs || 0,
        total_fat: result.totals.fat || 0,
        confidence: result.confidence || "medium",
        status: "completed",
      })
      .then(() => {})
      .catch(() => {});

    return res.status(200).json(result);
  } catch (err) {
    console.error("FOOD SCAN ERROR:", err);
    return res.status(500).json({
      error: "Food scan failed",
      message: err.message,
    });
  }
}
