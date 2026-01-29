// src/pages/api/ai/chat.js
export const config = {
  api: { bodyParser: true },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
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

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: `You are an AI fitness coach. Mode: ${mode || "coach"}. Be concise.`,
          },
          { role: "user", content: message },
        ],
      }),
    });

    const j = await r.json();

    if (!r.ok) {
      return res.status(r.status).json(j);
    }

    const text =
      j?.output_text ||
      j?.output?.[0]?.content?.[0]?.text ||
      "";

    return res.status(200).json({ reply: text || "No reply." });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
}
