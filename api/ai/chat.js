export const config = {
  runtime: "nodejs",
};

export default async function handler(req, res) {
  // Allow CORS / preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(200).end();
  }

  // Ignore accidental GETs instead of throwing
  if (req.method === "GET") {
    return res.status(200).json({ status: "AI endpoint alive" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { message, mode } = req.body || {};

    if (!message) {
      return res.status(400).json({ error: "Missing message" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
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
            content: `You are an AI fitness coach. Mode: ${mode || "coach"}.`,
          },
          {
            role: "user",
            content: message,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    const reply =
      data?.output_text ||
      data?.output?.[0]?.content?.[0]?.text ||
      "No reply.";

    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
}
