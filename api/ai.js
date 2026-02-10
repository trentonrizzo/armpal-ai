import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "nodejs" };

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {

    const { message, userId } = req.body || {};

    if (!message || !userId) {
      return res.status(400).json({ error: "Missing message or userId" });
    }

    /* -------------------------------------------------- */
    /* 🔥 PRO ACCESS CHECK (NEW)                          */
    /* -------------------------------------------------- */

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_pro")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.is_pro) {
      return res.status(403).json({
        error: "PRO_REQUIRED",
        message: "AI Coach is Pro only."
      });
    }

    /* -------------------------------------------------- */
    /* 🔥 DAILY LIMIT CHECK (NEW)                         */
    /* -------------------------------------------------- */

    const today = new Date().toISOString().slice(0,10);

    const { data: usage } = await supabase
      .from("ai_usage")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();

    const DAILY_LIMIT = 25;

    if (usage && usage.count >= DAILY_LIMIT) {
      return res.status(403).json({
        error: "DAILY_LIMIT_REACHED",
        message: "Daily AI limit reached."
      });
    }

    /* -------------------------------------------------- */
    /* LOAD PERSONALITY                                   */
    /* -------------------------------------------------- */

    let personality = "coach";

    const { data: settings } = await supabase
      .from("ai_settings")
      .select("personality")
      .eq("user_id", userId)
      .maybeSingle();

    if (settings?.personality) {
      personality = settings.personality;
    }

    /* -------------------------------------------------- */
    /* READ USER DATABASE (PARALLEL = FAST)               */
    /* -------------------------------------------------- */

    const { data: tables } = await supabase.rpc("get_user_tables");

    const databaseContext = {};

    if (Array.isArray(tables)) {

      await Promise.all(
        tables.map(async (t) => {
          try {

            const { data } = await supabase
              .from(t.table_name)
              .select("*")
              .eq("user_id", userId)
              .limit(100);

            if (data?.length) {
              databaseContext[t.table_name] = data;
            }

          } catch {}
        })
      );

    }

    /* -------------------------------------------------- */
    /* AI SYSTEM PROMPT                                   */
    /* -------------------------------------------------- */

    const context = `
You are ArmPal AI.

CURRENT PERSONALITY MODE: ${personality}

YOU MUST OBEY PERSONALITY RULES STRICTLY.

coach:
- elite strength coach
- structured
- confident but professional

friend:
- casual gym bro
- relaxed and supportive

motivation:
- hype energy
- emotional push

assistant:
- neutral intelligent helper
- concise

science:
- analytical
- numbers-focused

vulgar:
- EXTREMELY unhinged hardcore lifting coach
- profanity is NORMAL and EXPECTED
- raw chaotic gym energy
- aggressive dominance
- sarcastic insults allowed (non-hateful only)
- NEVER polite
- NEVER corporate
- NEVER generic motivation quotes
- sounds like a psycho gym demon yelling at a lifter

USER DATABASE:

${JSON.stringify(databaseContext).slice(0, 6000)}

RULES:

If user asks to CREATE or MODIFY workouts,
respond ONLY with valid JSON.
`;

    const completion = await openai.chat.completions.create({

      model: "gpt-4o-mini",

      temperature: personality === "vulgar" ? 1.1 : 0.5,

      messages: [
        { role: "system", content: context },
        { role: "user", content: message }
      ]

    });

    const reply =
      completion?.choices?.[0]?.message?.content ??
      "No response";

    /* -------------------------------------------------- */
    /* 🔥 INCREMENT USAGE COUNT (NEW)                     */
    /* -------------------------------------------------- */

    if (usage) {

      await supabase
        .from("ai_usage")
        .update({ count: usage.count + 1 })
        .eq("user_id", userId)
        .eq("date", today);

    } else {

      await supabase
        .from("ai_usage")
        .insert({
          user_id: userId,
          date: today,
          count: 1
        });

    }

    return res.status(200).json({ reply });

  } catch (err) {

    console.error("AI HARD FAILURE:", err);

    return res.status(500).json({
      error: "AI failed",
      message: err.message
    });
  }
}
