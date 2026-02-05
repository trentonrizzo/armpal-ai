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

    // 🔥 STEP 1 — get all public tables dynamically
    const { data: tables, error: tablesError } = await supabase.rpc(
      "get_all_tables"
    );

    // If RPC doesn't exist, fallback list:
    const tableList = tables || [
      { table_name: "prs" },
      { table_name: "workouts" },
      { table_name: "measurements" },
      { table_name: "profiles" }
    ];

    let databaseContext = {};

    // 🔥 STEP 2 — auto query every table
    for (const t of tableList) {

      const tableName = t.table_name;

      try {

        const { data } = await supabase
          .from(tableName)
          .select("*")
          .eq("user_id", userId)
          .limit(50);

        if (data && data.length > 0) {
          databaseContext[tableName] = data;
        }

      } catch {
        // ignore tables without user_id column
      }
    }

    // 🔥 STEP 3 — send ALL data to AI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content: `
You are ArmPal AI.

You have FULL access to the user's database below.
Always use this data when answering.

${JSON.stringify(databaseContext, null, 2)}
`
        },
        { role: "user", content: message }
      ]
    });

    return res.status(200).json({
      reply: completion.choices[0].message.content
    });

  } catch (err) {

    console.error("AI ERROR:", err);

    return res.status(500).json({
      error: "AI failed",
      message: err.message
    });
  }
}
