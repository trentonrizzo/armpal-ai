/*
  POST /api/ai/food-scan
  Food scan AI only — uses GPT-4o vision. Completely separate from other AI endpoints.

  Request body:
    imageUrl: string  — URL of the food image (https or data: URI), OR
    imagePath: string + userId: string — Supabase storage key in "food_scan_images"; backend creates signed URL
    userText: string | null — optional context (e.g. "pork under gravy")

  Returns:
    { foods: [ { name: string, estimated_weight_g: number }, ... ] }
  No macros — only foods and estimated weight in grams.
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
    const { imageUrl, imagePath, userText, userId, mealDate } = req.body || {};

    let imageUrlToUse = imageUrl;

    if (!imageUrlToUse && imagePath && userId) {
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
      imageUrlToUse = signedData.signedUrl;
    }

    if (!imageUrlToUse) {
      return res.status(400).json({
        error: "Missing image",
        message: "Provide imageUrl or imagePath with userId.",
      });
    }

    const contextLine = userText && String(userText).trim()
      ? `\nThe user provided this context: "${String(userText).trim()}". Use it to refine identification (e.g. "pork under gravy").`
      : "";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      response_format: { type: "json_object" },
      max_tokens: 1024,
      messages: [
        {
          role: "system",
          content: `You are a food recognition AI. Analyze the image and identify all foods. Return ONLY valid JSON.

RULES:
- Identify ALL visible food items.
- Use the user's optional text context when provided to refine identification (e.g. "pork under gravy").
- Estimate weight in grams per food item. Be conservative; use visual cues (plate size, typical portions).
- Do NOT calculate or return calories, protein, carbs, or fat. Only food name and estimated_weight_g.
- Return exactly this structure:

{
  "foods": [
    { "name": "short lowercase description", "estimated_weight_g": number },
    ...
  ]
}

Example: { "foods": [ { "name": "grilled chicken breast", "estimated_weight_g": 180 }, { "name": "white rice", "estimated_weight_g": 150 } ] }`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Identify all foods in this image and estimate weight in grams for each. Return JSON only.${contextLine}`,
            },
            {
              type: "image_url",
              image_url: { url: imageUrlToUse, detail: "high" },
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

    if (!Array.isArray(result.foods)) {
      return res.status(500).json({ error: "Unexpected AI response structure" });
    }

    const normalized = {
      foods: result.foods.map((f) => ({
        name: String(f?.name ?? "unknown").trim() || "unknown",
        estimated_weight_g: Math.max(0, Math.round(Number(f?.estimated_weight_g) || 0)),
      })),
    };

    if (imagePath && userId) {
      await supabase
        .from("food_scans")
        .insert({
          user_id: userId,
          meal_date: mealDate || new Date().toISOString().slice(0, 10),
          image_path: imagePath,
          ai_result_json: normalized,
          total_calories: 0,
          total_protein: 0,
          total_carbs: 0,
          total_fat: 0,
          confidence: "medium",
          status: "completed",
        })
        .then(() => {})
        .catch(() => {});
    }

    return res.status(200).json(normalized);
  } catch (err) {
    console.error("FOOD SCAN ERROR:", err);
    return res.status(500).json({
      error: "Food scan failed",
      message: err.message,
    });
  }
}
