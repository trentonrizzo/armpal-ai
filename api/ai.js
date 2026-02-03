import OpenAI from "openai";

export const config = {
  runtime: "nodejs",
};

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  const requestId = Math.random().toString(36).slice(2, 9);

  console.log("----- AI REQUEST START -----");
  console.log("Request ID:", requestId);
  console.log("Method:", req.method);
  console.log("Has API Key:", !!process.env.OPENAI_API_KEY);

  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY IS MISSING");
    return res.status(500).json({
      error: "Server misconfiguration",
      details: "OPENAI_API_KEY missing",
      requestId,
    });
  }

  if (req.method !== "POST") {
    console.warn("❌ Invalid method");
    return res.status(405).json({ error: "Method not allowed", requestId });
  }

  try {
    const body = req.body ?? {};
    console.log("Request body:", body);

    const { message } = body;

    if (!message || typeof message !== "string") {
      console.warn("❌ Invalid message payload");
      return res.status(400).json({
        error: "Missing or invalid message",
        requestId,
      });
    }

    console.log("Sending message to OpenAI...");

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are ArmPal AI, a helpful fitness coach." },
        { role: "user", content: message },
      ],
      temperature: 0.7,
    });

    console.log("OpenAI raw response:", completion);

    const reply =
      completion?.choices?.[0]?.message?.content ?? null;

    if (!reply) {
      console.error("❌ No reply in OpenAI response");
      return res.status(500).json({
        error: "OpenAI returned no message",
        raw: completion,
        requestId,
      });
    }

    console.log("----- AI REQUEST SUCCESS -----");

    return res.status(200).json({
      reply,
      requestId,
    });
  } catch (err) {
    console.error("❌ AI HARD FAILURE");
    console.error("Request ID:", requestId);
    console.error(err);

    return res.status(500).json({
      error: "AI failed",
      message: err.message,
      name: err.name,
      stack: err.stack,
      requestId,
    });
  }
}
