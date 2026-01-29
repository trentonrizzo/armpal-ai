export const config = {
  runtime: "nodejs",
};

export default async function handler(req, res) {
  try {
    // CORS / preflight
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      return res.status(200).end();
    }

    // Health check
    if (req.method === "GET") {
      return res.status(200).json({ status: "ok" });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    // 🔴 HARD BODY PARSE (fixes 400)
    let body = req.body;
    if (!body || typeof body === "string") {
      try {
        body = JSON.parse(req.body || "{}");
      } catch {
        body = {};
      }
    }

    const { message, mode } = body;

    if (!message) {
      return res.status(400).json({
        error: "Missing message",
        received: body,
      });
    }

    // 🔴 ENV CHECK (fixes 500)
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY missing in Vercel environment",
      });
    }

    const aiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: `You are a fitness AI coach. Mode: ${mode || "coach"}.`,
          },
          {
            role: "user",
            content: message,
          },
        ],
      }),
    });

    const data = await aiRes.json();

    if (!aiRes.ok) {
      return res.status(aiRes.status).json({
        error: "OpenAI error",
        details: data,
      });
    }

    const reply =
      data?.output_text ||
      data?.output?.[0]?.content?.[0]?.text ||
      null;

    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({
      error: "Server crash",
      message: err?.message,
    });
  }
}
