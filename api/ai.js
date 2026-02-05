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
    /* READ USER DATABASE                                 */
    /* -------------------------------------------------- */

    const { data: tables } = await supabase.rpc("get_user_tables");

    const databaseContext = {};

    if (Array.isArray(tables)) {

      for (const t of tables) {

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
      }
    }

    /* -------------------------------------------------- */
    /* AI SYSTEM PROMPT                                   */
    /* -------------------------------------------------- */

    const context = `
You are ArmPal AI.

You have full access to the user's database:

${JSON.stringify(databaseContext)}

RULES:

- If user asks to CREATE or MODIFY workouts,
respond ONLY with valid JSON.

Allowed structures:

CREATE:

{
"type":"create_workout",
"title":string,
"exercises":[
{
"name":string,
"sets":number,
"reps":string,
"notes":string
}
]
}

EDIT:

{
"type":"edit_workout",
"workout_id":string,
"changes":[]
}

If not creating/editing workouts, respond normally as text.

Do not include explanations when returning JSON.
`;

    const completion = await openai.chat.completions.create({

      model: "gpt-4o-mini",
      temperature: 0.5,

      messages: [
        { role: "system", content: context },
        { role: "user", content: message }
      ]

    });

    const reply =
      completion?.choices?.[0]?.message?.content ??
      "No response";

    return res.status(200).json({ reply });

  } catch (err) {

    console.error("AI HARD FAILURE:", err);

    return res.status(500).json({
      error: "AI failed",
      message: err.message
    });
  }
}
