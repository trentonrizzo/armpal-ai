export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Missing OPENAI_API_KEY",
      hint: "Add OPENAI_API_KEY to Vercel → Settings → Environment Variables (Production) and redeploy.",
    });
  }

  const body = req.body || {};
  const message = body.message;
  const mode = body.mode || "coach";
  const context = body.context || "";

  if (!message || typeof message !== "string") {
    return res.status(400).json({
      error: "Invalid message",
      receivedKeys: Object.keys(body || {}),
      hint: "Frontend must send JSON: { message: '...', mode, context }",
    });
  }

  const personalities = {
    savage: "Brutally honest, blunt, intense.",
    coach: "Professional strength coach. Clear and structured.",
    motivation: "Uplifting, encouraging, momentum-driven.",
    recovery: "Recovery, fatigue management, joint-friendly.",
    science: "Evidence-based, numbers, RPE, volume, logic.",
    vulgar: "Crude, sarcastic, chaotic, but still correct.",
  };

  const system = `You are ArmPal AI Coach. Fitness-only.\nPersonality: ${personalities[mode] || personalities.coach}\nRules: Never assume a workout happened unless explicitly logged. If data missing, say so. No medical advice.\nContext: ${context || "None"}`;

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages: [
          { role: "system", content: system },
          { role: "user", content: message },
        ],
      }),
    });

    const j = await r.json().catch(() => ({}));

    if (!r.ok) {
      return res.status(500).json({
        error: "OpenAI request failed",
        status: r.status,
        details: j,
        hint: "If status=401, key/billing. If 429, rate limit. If 404, model access.",
      });
    }

    return res.status(200).json({
      reply: j?.choices?.[0]?.message?.content || "",
    });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e?.message || e) });
  }
}
