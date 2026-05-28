import { createClient } from "@supabase/supabase-js";
import { sendApnsToUser } from "./lib/apnsSendCore.js";
import { handlePushCorsPreflight, setPushCorsHeaders } from "./lib/pushCors.js";

export const config = { runtime: "nodejs" };

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

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  console.log(LOG, "backend route hit", {
    method: req.method,
    origin: req.headers.origin || null,
    userAgent: req.headers["user-agent"] || null,
  });

  const authHeader = req.headers.authorization || "";
  const accessToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  const supabaseKey = SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !supabaseKey || !accessToken) {
    console.warn(LOG, "backend route auth missing", {
      hasSupabaseUrl: !!SUPABASE_URL,
      hasKey: !!supabaseKey,
      hasToken: !!accessToken,
    });
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
    console.warn(LOG, "backend route auth failed", userErr?.message || "no user");
    return res.status(401).json({ error: "Unauthorized", sent: 0, failed: 0 });
  }

  const { userId: recipientId, title, body, data = {} } = req.body || {};
  console.log(LOG, "backend route payload", {
    actorId: user.id,
    recipientId,
    title,
    bodyPreview: String(body || "").slice(0, 120),
    dataType: data?.type || null,
  });

  if (!recipientId) {
    return res.status(400).json({ error: "Missing userId", sent: 0, failed: 0 });
  }

  const authz = validatePushAuthorization(user.id, recipientId, data);
  if (!authz.ok) {
    console.warn(LOG, "push failed", { reason: "authorization", error: authz.error });
    return res.status(403).json({ error: authz.error, sent: 0, failed: 0 });
  }

  const result = await sendApnsToUser({
    userId: recipientId,
    title,
    body,
    data: {
      ...data,
      recipientId,
    },
  });

  const status = result.error && result.sent === 0 && result.failed === 0 ? 503 : 200;
  return res.status(status).json(result);
}
