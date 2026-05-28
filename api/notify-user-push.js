import { createClient } from "@supabase/supabase-js";
import { sendApnsToUser } from "./lib/apnsSendCore.js";
import { handlePushCorsPreflight, setPushCorsHeaders } from "./lib/pushCors.js";

export const config = { runtime: "nodejs" };

const API_LOG = "[ArmPal.Push.API]";
const LOG = "[ArmPal.Push]";

function validatePushAuthorization(userId, recipientId, data = {}) {
  const type = data?.type;

  if (!type) return { ok: false, error: "Missing data.type" };

  if (type === "test_push") {
    if (recipientId !== userId) return { ok: false, error: "Test push must target self" };
    return { ok: true };
  }

  if (recipientId === userId) {
    return { ok: false, error: "Cannot push to self" };
  }

  if (type === "chat_message") {
    if (data.senderId !== userId) return { ok: false, error: "senderId mismatch" };
    if (data.recipientId && data.recipientId !== recipientId) {
      return { ok: false, error: "recipientId mismatch" };
    }
    return { ok: true };
  }

  if (type === "friend_request") {
    if (data.senderId !== userId) return { ok: false, error: "senderId mismatch" };
    if (data.recipientId && data.recipientId !== recipientId) {
      return { ok: false, error: "recipientId mismatch" };
    }
    return { ok: true };
  }

  if (type === "friend_accept") {
    if (data.accepterId !== userId) return { ok: false, error: "accepterId mismatch" };
    if (data.originalSenderId !== recipientId) {
      return { ok: false, error: "originalSenderId mismatch" };
    }
    return { ok: true };
  }

  return { ok: false, error: "Unsupported data.type" };
}

export default async function handler(req, res) {
  setPushCorsHeaders(req, res);
  if (handlePushCorsPreflight(req, res)) return;

  console.log(API_LOG, "ROUTE HIT", { route: "/api/notify-user-push", method: req.method });
  console.log(LOG, "backend route hit", {
    origin: req.headers.origin || null,
    userAgent: req.headers["user-agent"] || null,
  });

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body || {};
  console.log(API_LOG, "BODY", body);

  const authHeader = req.headers.authorization || "";
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  const supabaseKey = SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !supabaseKey || !accessToken) {
    console.error(API_LOG, "APNS FAILURE", { reason: "unauthorized_missing_auth" });
    return res.status(401).json({ error: "Unauthorized", sent: 0, failed: 0 });
  }

  const supabase = createClient(SUPABASE_URL, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user?.id) {
    console.error(API_LOG, "APNS FAILURE", { reason: "auth_failed", message: userErr?.message });
    return res.status(401).json({ error: "Unauthorized", sent: 0, failed: 0 });
  }

  const { userId: recipientId, title, body: messageBody, data = {} } = body;

  if (!recipientId) {
    console.error(API_LOG, "APNS FAILURE", { reason: "missing_recipientId" });
    return res.status(400).json({ error: "Missing userId", sent: 0, failed: 0 });
  }

  const authz = validatePushAuthorization(user.id, recipientId, data);
  if (!authz.ok) {
    console.error(API_LOG, "APNS FAILURE", { reason: "authorization", error: authz.error });
    return res.status(403).json({ error: authz.error, sent: 0, failed: 0 });
  }

  console.log(LOG, "CURRENT AUTH USER", user.id);
  console.log(LOG, "PUSH TARGET USER", recipientId);

  const result = await sendApnsToUser({
    userId: recipientId,
    title,
    body: messageBody,
    data: {
      ...data,
      recipientId,
    },
  });

  const status =
    result.reason === "no_tokens" || (result.error && result.sent === 0 && result.failed === 0)
      ? 404
      : 200;
  return res.status(status).json(result);
}
