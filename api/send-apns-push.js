import { sendApnsToUser } from "./lib/apnsSendCore.js";
import { handlePushCorsPreflight, setPushCorsHeaders } from "./lib/pushCors.js";

export const config = { runtime: "nodejs" };

const LOG = "[ArmPal.Push]";

export default async function handler(req, res) {
  setPushCorsHeaders(req, res);
  if (handlePushCorsPreflight(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  console.log(LOG, "backend route hit", { route: "send-apns-push" });

  const internalSecret = process.env.PUSH_INTERNAL_SECRET;
  if (internalSecret && req.headers["x-push-secret"] !== internalSecret) {
    console.warn(LOG, "push failed", { reason: "unauthorized_secret" });
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { userId, title, body, data = {} } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: "Missing userId", sent: 0, failed: 0 });
  }

  console.log(LOG, "backend route payload", {
    userId,
    title,
    bodyPreview: String(body || "").slice(0, 120),
    dataType: data?.type || null,
  });

  const result = await sendApnsToUser({ userId, title, body, data });
  const status = result.error && result.sent === 0 && result.failed === 0 ? 503 : 200;
  return res.status(status).json(result);
}
