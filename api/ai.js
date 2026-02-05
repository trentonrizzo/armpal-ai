import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "nodejs" };

// OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Supabase (SERVER ONLY)
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
      return res.status(400).json({
        error: "Missing message or userId",
      });
    }

    /* --------------------------------------------------
       1️⃣ Discover ALL tables that belong to a user
       -------------------------------------------------- */

    const { data: tables, error: tableErr } = await supabase.rpc(
      "get_user_tables"
    );

    if (tableErr) {
      console.error("TABLE DISCOVERY ERROR:", tableErr);
    }

    const databaseContext = {};

    /* --------------------------------------------------
       2️⃣ Read ALL rows for this user from ALL tables
       -------------------------------------------------- */

    if (Array.isArray(tables)) {
      for (const t of tables) {
        const tableName = t.table_name;

        try {
          const { data, error } = await supabase
            .from(tableName)
            .select("*")
            .eq("user_id", userId)
            .limit(100);

          if (!error && data && data.length > 0) {
            databaseContext[tableName] = data;
          }
        } catch {
          // silently ignore tables that error
        }
      }
    }

    /* --------------------------------------------------
       3️⃣ Build AI context (this is the magic)
       -------------------------------------------------- */

    const context = `
You are ArmPal AI, the user's personal in-app fitness assistant.

You have FULL access to the user's real database data below.
This data is authoritative. Use it to answer questions accurately.

USER DATABASE SNAPSHOT:
${JSON.stringify(databaseContext, null, 2)}

Important rules:
- If data exists, USE IT.
- If data does not exist, say it has not been logged.
- Do NOT hallucinate missing data.
- Be concise but helpful.
`;

    /* --------------------------------------------------
       4️⃣ Ask OpenAI with full context
       -------------------------------------------------- */

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5,
      messages: [
        { role: "system", content: context },
        { role: "user", content: message },
      ],
    });

    const reply =
      completion?.choices?.[0]?.message?.content ??
      "I couldn't generate a response.";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("AI HARD FAILURE:", err);
    return res.status(500).json({
      error: "AI failed",
      message: err.message,
    });
  }
}
