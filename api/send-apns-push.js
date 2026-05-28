import { sendApnsToUser } from "./lib/apnsSendCore.js";
import { handlePushCorsPreflight, setPushCorsHeaders } from "./lib/pushCors.js";

export const config = { runtime: "nodejs" };

const API_LOG = "[ArmPal.Push.API]";
const SERVER_LOG = "[ArmPal.Push.Server]";

export default async function handler(req, res) {
  setPushCorsHeaders(req, res);
  if (handlePushCorsPreflight(req, res)) return;

  const isServerSource = req.headers["x-push-source"] === "server";
  const LOG = isServerSource ? SERVER_LOG : API_LOG;

  console.log(LOG, "ROUTE HIT", { route: "/api/send-apns-push", method: req.method, isServerSource });

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const internalSecret = process.env.PUSH_INTERNAL_SECRET;
  if (internalSecret && req.headers["x-push-secret"] !== internalSecret) {
    console.error(LOG, "APNs failure", { reason: "unauthorized_secret" });
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = req.body || {};
  console.log(LOG, "BODY", body);

  const { userId, title, body: messageBody, data = {} } = body;

  if (!userId) {
    console.error(LOG, "APNs failure", { reason: "missing_userId" });
    return res.status(400).json({ error: "Missing userId", sent: 0, failed: 0 });
  }

  const result = await sendApnsToUser({
    userId,
    title,
    body: messageBody,
    data,
    logPrefix: isServerSource ? SERVER_LOG : API_LOG,
  });

  const status =
    result.reason === "no_tokens" || (result.error && result.sent === 0 && result.failed === 0)
      ? 404
      : 200;
  return res.status(status).json(result);
}
