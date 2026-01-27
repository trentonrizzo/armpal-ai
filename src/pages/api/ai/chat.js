
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    return;
  }

  const { message, mode = "coach", context = "" } = req.body || {};
  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "Invalid message" });
    return;
  }

  const personalities = {
    savage: "Brutally honest and intense.",
    coach: "Professional strength coach.",
    motivation: "Encouraging and uplifting.",
    recovery: "Recovery and fatigue focused.",
    science: "Evidence-based and analytical.",
    vulgar: "Crude, sarcastic, but correct."
  };

  const system = `You are ArmPal AI Coach. Fitness-only.
Personality: ${personalities[mode] || personalities.coach}
Context: ${context || "None"}`;

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: message }
        ],
      }),
    });

    const j = await r.json();
    if (!r.ok) {
      res.status(500).json({ error: "OpenAI error", details: j });
      return;
    }

    res.status(200).json({ reply: j.choices?.[0]?.message?.content || "" });
  } catch (e) {
    res.status(500).json({ error: "Server error", details: String(e) });
  }
}
