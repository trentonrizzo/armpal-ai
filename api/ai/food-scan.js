/*
  POST /api/ai/food-scan
  Food scan AI only — GPT-4o vision + nutrition lookup. Completely separate from other AI endpoints.

  Request body:
    imageUrl: string | imagePath + userId
    userText: string | null
    mealDate: string (optional)

  Returns:
    { foods: [ { name, estimated_weight_g, calories, protein, carbs, fat, needs_review? }, ... ], totals: { calories, protein, carbs, fat } }
*/

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "nodejs" };

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DAILY_SCAN_LIMIT = 10;

/** Per 100g: calories, protein, carbs, fat. Keywords (lowercase) for fuzzy match. */
const NUTRITION_REFERENCE = [
  { keywords: ["chicken", "breast", "grilled", "baked", "roast"], cal: 165, p: 31, c: 0, f: 3.6 },
  { keywords: ["chicken", "thigh"], cal: 209, p: 26, c: 0, f: 10.9 },
  { keywords: ["rice", "white"], cal: 130, p: 2.7, c: 28, f: 0.3 },
  { keywords: ["rice", "brown"], cal: 112, p: 2.6, c: 24, f: 0.9 },
  { keywords: ["pork", "roast", "gravy", "shredded", "pulled"], cal: 250, p: 26, c: 2, f: 15 },
  { keywords: ["pork", "chop"], cal: 231, p: 26, c: 0, f: 14 },
  { keywords: ["pork", "tenderloin"], cal: 143, p: 26, c: 0, f: 3.5 },
  { keywords: ["gravy"], cal: 50, p: 3, c: 5, f: 2 },
  { keywords: ["beef", "ground"], cal: 250, p: 26, c: 0, f: 15 },
  { keywords: ["beef", "steak", "sirloin", "ribeye"], cal: 271, p: 27, c: 0, f: 17 },
  { keywords: ["salmon"], cal: 208, p: 20, c: 0, f: 13 },
  { keywords: ["tilapia", "white fish", "cod"], cal: 96, p: 20, c: 0, f: 1.7 },
  { keywords: ["turkey", "breast"], cal: 135, p: 30, c: 0, f: 0.7 },
  { keywords: ["egg", "eggs"], cal: 155, p: 13, c: 1.1, f: 11 },
  { keywords: ["broccoli"], cal: 34, p: 2.8, c: 7, f: 0.4 },
  { keywords: ["green", "beans", "vegetable", "veg"], cal: 31, p: 1.8, c: 7, f: 0.1 },
  { keywords: ["potato", "potatoes", "mashed"], cal: 77, p: 2, c: 17, f: 0.1 },
  { keywords: ["sweet potato"], cal: 86, p: 1.6, c: 20, f: 0.1 },
  { keywords: ["bread", "roll"], cal: 265, p: 9, c: 49, f: 3.2 },
  { keywords: ["pasta", "noodle", "spaghetti"], cal: 131, p: 5, c: 25, f: 1.1 },
  { keywords: ["oatmeal", "oats"], cal: 68, p: 2.4, c: 12, f: 1.4 },
  { keywords: ["beans", "black", "pinto", "kidney"], cal: 127, p: 8.7, c: 23, f: 0.5 },
  { keywords: ["tofu"], cal: 76, p: 8, c: 1.9, f: 4.8 },
  { keywords: ["cheese"], cal: 402, p: 25, c: 1.3, f: 33 },
  { keywords: ["salad", "lettuce", "greens"], cal: 15, p: 1.4, c: 2.9, f: 0.2 },
  { keywords: ["avocado"], cal: 160, p: 2, c: 9, f: 15 },
  { keywords: ["banana"], cal: 89, p: 1.1, c: 23, f: 0.3 },
  { keywords: ["apple"], cal: 52, p: 0.3, c: 14, f: 0.2 },
  { keywords: ["yogurt", "greek"], cal: 97, p: 9, c: 3.5, f: 5 },
  { keywords: ["milk"], cal: 42, p: 3.4, c: 5, f: 1 },
  { keywords: ["sauce", "tomato", "marinara"], cal: 32, p: 1.5, c: 7, f: 0.2 },
  { keywords: ["curry"], cal: 80, p: 4, c: 10, f: 3 },
  { keywords: ["soup"], cal: 45, p: 2.5, c: 5, f: 1.5 },
  { keywords: ["fried", "battered"], cal: 280, p: 15, c: 25, f: 12 },
  { keywords: ["bacon"], cal: 541, p: 37, c: 1.4, f: 42 },
  { keywords: ["sausage"], cal: 301, p: 12, c: 2, f: 28 },
  { keywords: ["rice"], cal: 130, p: 2.7, c: 28, f: 0.3 },
  { keywords: ["chicken"], cal: 165, p: 31, c: 0, f: 3.6 },
  { keywords: ["pork"], cal: 242, p: 27, c: 0, f: 14 },
  { keywords: ["beef"], cal: 250, p: 26, c: 0, f: 15 },
  { keywords: ["fish"], cal: 120, p: 20, c: 0, f: 4 },
  { keywords: ["vegetable", "veggie", "veg"], cal: 35, p: 2, c: 7, f: 0.2 },
];

/** Generic fallback when no match (avoid zero totals). Per 100g. */
const FALLBACK_PER_100G = { cal: 120, p: 10, c: 8, f: 6 };

/**
 * Score a reference entry against detected food name (lowercase).
 * Returns number of keyword matches; higher = better.
 */
function scoreMatch(nameLower, entry) {
  let score = 0;
  for (const kw of entry.keywords) {
    if (nameLower.includes(kw)) score += 1;
  }
  return score;
}

/**
 * Find best nutrition reference for a food name. Returns per-100g or null.
 */
function lookupNutrition(name) {
  if (!name || typeof name !== "string") return null;
  const lower = name.toLowerCase().trim();
  let best = null;
  let bestScore = 0;
  for (const entry of NUTRITION_REFERENCE) {
    const s = scoreMatch(lower, entry);
    if (s > bestScore) {
      bestScore = s;
      best = entry;
    }
  }
  return best;
}

/**
 * For a detected food (name, estimated_weight_g), compute calories and macros.
 * Uses lookup; if no match, uses fallback and sets needs_review.
 */
function addNutritionToFood(food) {
  const name = String(food?.name ?? "unknown").trim() || "unknown";
  const grams = Math.max(0, Math.round(Number(food?.estimated_weight_g) || 0));
  const ref = lookupNutrition(name);
  const per100 = ref || FALLBACK_PER_100G;
  const scale = grams / 100;
  const calories = Math.round(per100.cal * scale);
  const protein = Math.round(per100.p * scale * 10) / 10;
  const carbs = Math.round(per100.c * scale * 10) / 10;
  const fat = Math.round(per100.f * scale * 10) / 10;
  return {
    name,
    estimated_weight_g: grams,
    calories,
    protein,
    carbs,
    fat,
    estimated_amount: `${grams} g`,
    ...(ref ? {} : { needs_review: true }),
  };
}

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
      const { data: usage } = await supabase
        .from("ai_usage")
        .select("*")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();

      if (usage && usage.image_scans >= DAILY_SCAN_LIMIT) {
        return res.status(429).json({
          error: "SCAN_LIMIT_REACHED",
          message: "Daily AI image scan limit reached (10). Try again tomorrow.",
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
- Estimate weight in grams per food item. Use scale references when visible: hand (palm ≈ 100–150g meat, fist ≈ 200g), fork/spoon (tablespoon ≈ 15g, portion on plate), bowl (typical bowl rice ≈ 150–250g), plate (dinner plate section ≈ 80–150g per item). If no clear reference, use typical portion sizes (e.g. chicken breast ≈ 150–200g, rice side ≈ 150g).
- Be conservative but realistic with grams.
- Do NOT return calories, protein, carbs, or fat. Only food name and estimated_weight_g.
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
              text: `Identify all foods in this image and estimate weight in grams for each. Use any visible scale (hand, fork, spoon, bowl, plate) to improve estimates. Return JSON only.${contextLine}`,
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

    const foodsWithNutrition = result.foods.map((f) => addNutritionToFood(f));

    const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    for (const f of foodsWithNutrition) {
      totals.calories += Math.round(Number(f.calories) || 0);
      totals.protein += (Number(f.protein) || 0);
      totals.carbs += (Number(f.carbs) || 0);
      totals.fat += (Number(f.fat) || 0);
    }
    totals.protein = Math.round(totals.protein * 10) / 10;
    totals.carbs = Math.round(totals.carbs * 10) / 10;
    totals.fat = Math.round(totals.fat * 10) / 10;

    const response = { foods: foodsWithNutrition, totals };

    if (imagePath && userId) {
      await supabase
        .from("food_scans")
        .insert({
          user_id: userId,
          meal_date: mealDate || new Date().toISOString().slice(0, 10),
          image_path: imagePath,
          ai_result_json: response,
          total_calories: totals.calories,
          total_protein: totals.protein,
          total_carbs: totals.carbs,
          total_fat: totals.fat,
          confidence: "medium",
          status: "completed",
        })
        .then(() => {})
        .catch(() => {});
    }

    if (userId) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: usage } = await supabase
        .from("ai_usage")
        .select("*")
        .eq("user_id", userId)
        .eq("date", today)
        .maybeSingle();

      if (usage) {
        await supabase
          .from("ai_usage")
          .update({ image_scans: (usage.image_scans || 0) + 1 })
          .eq("user_id", userId)
          .eq("date", today);
      } else {
        await supabase.from("ai_usage").insert({
          user_id: userId,
          date: today,
          image_scans: 1,
        });
      }
    }

    return res.status(200).json(response);
  } catch (err) {
    console.error("FOOD SCAN ERROR:", err);
    return res.status(500).json({
      error: "Food scan failed",
      message: err.message,
    });
  }
}
