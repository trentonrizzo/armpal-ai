import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import webpush from "npm:web-push@3.6.7";

const LOG = "[ArmPal.Push.Server]";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APNS_API_URL =
  Deno.env.get("ARMPAL_APNS_API_URL") ?? "https://www.armpal.net/api/send-apns-push";
const PUSH_INTERNAL_SECRET = Deno.env.get("PUSH_INTERNAL_SECRET") ?? "";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = "mailto:support@armpal.net";

type MessageRecord = {
  id?: string;
  sender_id?: string;
  receiver_id?: string;
  group_id?: string | null;
  text?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  audio_url?: string | null;
  created_at?: string;
};

type FriendRequestRecord = {
  id?: string;
  sender_id?: string;
  receiver_id?: string;
  status?: string;
};

type WebhookPayload = {
  type?: string;
  table?: string;
  schema?: string;
  record?: Record<string, unknown>;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function sanitizeText(text: string, max = 140) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function formatMessageBody(record: MessageRecord) {
  if (record.image_url) return { body: "📷 Sent a photo", kind: "photo" };
  if (record.video_url) return { body: "🎥 Sent a video", kind: "video" };
  if (record.audio_url) return { body: "🎤 Sent a voice message", kind: "audio" };

  const text = record.text || "";
  try {
    const parsed = JSON.parse(text);
    if (parsed?.type === "workout_share") {
      return { body: "💪 Shared a workout", kind: "workout" };
    }
  } catch {
    /* plain text */
  }

  return {
    body: sanitizeText(text) || "Sent you a message",
    kind: "text",
  };
}

function isDatabaseWebhook(body: Record<string, unknown>) {
  return Boolean(body?.table && (body?.record || body?.type === "INSERT"));
}

async function fetchSenderLabel(
  admin: ReturnType<typeof createClient>,
  senderId: string
) {
  const { data } = await admin
    .from("profiles")
    .select("display_name, username, handle")
    .eq("id", senderId)
    .maybeSingle();

  return data?.display_name || data?.username || data?.handle || "Someone";
}

async function sendApnsViaVercel({
  userId,
  title,
  body,
  data,
}: {
  userId: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}) {
  console.log(LOG, "APNs send start", { userId, title, bodyPreview: body.slice(0, 80) });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-push-source": "server",
  };
  if (PUSH_INTERNAL_SECRET) {
    headers["x-push-secret"] = PUSH_INTERNAL_SECRET;
  }

  const res = await fetch(APNS_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ userId, title, body, data }),
  });

  const detail = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = detail ? JSON.parse(detail) : {};
  } catch {
    parsed = { raw: detail };
  }

  return { ok: res.ok, status: res.status, result: parsed };
}

async function handleMessageInsert(
  admin: ReturnType<typeof createClient>,
  record: MessageRecord
) {
  console.log(LOG, "message insert detected", {
    messageId: record.id,
    senderId: record.sender_id,
    receiverId: record.receiver_id,
    groupId: record.group_id,
  });

  if (record.group_id) {
    return { ok: true, skipped: true, reason: "group_message" };
  }

  const senderId = record.sender_id;
  const recipientId = record.receiver_id;

  if (!senderId || !recipientId) {
    console.error(LOG, "APNs failure", { reason: "missing_participants" });
    return { ok: false, reason: "missing_participants" };
  }

  if (senderId === recipientId) {
    console.error(LOG, "APNs failure", { reason: "self_target_blocked", senderId });
    return { ok: false, reason: "self_target_blocked" };
  }

  console.log(LOG, "recipient resolved", { senderId, recipientId, messageId: record.id });

  const { data: tokens, error: tokenErr } = await admin
    .from("push_tokens")
    .select("id, token")
    .eq("user_id", recipientId)
    .eq("enabled", true)
    .eq("platform", "ios");

  if (tokenErr) {
    console.error(LOG, "APNs failure", { reason: "token_lookup_failed", message: tokenErr.message });
    return { ok: false, reason: "token_lookup_failed" };
  }

  const tokenCount = tokens?.length ?? 0;
  console.log(LOG, "token count", { recipientId, tokenCount });

  if (!tokenCount) {
    console.error(LOG, "APNs failure", { reason: "no_tokens", recipientId });
    return { ok: true, sent: 0, reason: "no_tokens", tokenCount: 0 };
  }

  const senderLabel = await fetchSenderLabel(admin, senderId);
  const { body: messageBody, kind } = formatMessageBody(record);

  const apns = await sendApnsViaVercel({
    userId: recipientId,
    title: senderLabel,
    body: messageBody,
    data: {
      type: "chat_message",
      senderId,
      recipientId,
      messageId: record.id ?? null,
      conversationId: recipientId,
      kind,
      source: "server",
    },
  });

  if (apns.ok && Number(apns.result?.sent ?? 0) > 0) {
    console.log(LOG, "APNs success", {
      recipientId,
      sent: apns.result?.sent,
      tokenCount,
    });
  } else {
    console.error(LOG, "APNs failure", {
      recipientId,
      status: apns.status,
      result: apns.result,
    });
  }

  return { ok: apns.ok, ...apns.result, tokenCount };
}

async function handleFriendRequestInsert(
  admin: ReturnType<typeof createClient>,
  record: FriendRequestRecord
) {
  const senderId = record.sender_id;
  const recipientId = record.receiver_id;

  if (!senderId || !recipientId || senderId === recipientId) {
    return { ok: false, reason: "invalid_friend_request" };
  }

  if (record.status && record.status !== "pending") {
    return { ok: true, skipped: true, reason: "not_pending" };
  }

  console.log(LOG, "recipient resolved", { senderId, recipientId, requestId: record.id });

  const { data: tokens } = await admin
    .from("push_tokens")
    .select("id")
    .eq("user_id", recipientId)
    .eq("enabled", true)
    .eq("platform", "ios");

  const tokenCount = tokens?.length ?? 0;
  console.log(LOG, "token count", { recipientId, tokenCount });

  if (!tokenCount) {
    console.error(LOG, "APNs failure", { reason: "no_tokens", recipientId });
    return { ok: true, sent: 0, reason: "no_tokens", tokenCount: 0 };
  }

  const senderLabel = await fetchSenderLabel(admin, senderId);
  const apns = await sendApnsViaVercel({
    userId: recipientId,
    title: "ArmPal",
    body: `${senderLabel} sent you a friend request`,
    data: {
      type: "friend_request",
      senderId,
      recipientId,
      requestId: record.id ?? null,
      source: "server",
    },
  });

  if (apns.ok && Number(apns.result?.sent ?? 0) > 0) {
    console.log(LOG, "APNs success", { recipientId, sent: apns.result?.sent });
  } else {
    console.error(LOG, "APNs failure", { recipientId, result: apns.result });
  }

  return { ok: apns.ok, ...apns.result, tokenCount };
}

/** Legacy web push path (push_subscriptions / VAPID). */
async function handleLegacyWebPush(body: Record<string, unknown>) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return { ok: false, reason: "vapid_not_configured" };
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const userId =
    (body?.user_id as string) ??
    (body?.to_user_id as string) ??
    (body?.receiver_id as string) ??
    null;

  if (!userId) {
    return { ok: false, reason: "missing_user_id" };
  }

  const message = (body?.body as string) ?? "New notification";
  const link = (body?.link as string) ?? "/";

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint,keys")
    .eq("user_id", userId);

  if (!subs?.length) {
    return { ok: true, sent: 0, reason: "no_web_subscriptions" };
  }

  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify({ title: "ArmPal", body: message, link })
      );
      sent += 1;
    } catch (e) {
      console.error(LOG, "APNs failure", { channel: "web_push", error: String(e) });
    }
  }

  return { ok: true, sent, channel: "web_push" };
}

Deno.serve(async (req) => {
  if (req.method === "GET") {
    return new Response("send-push alive", { status: 200 });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  console.log(LOG, "webhook received", { method: req.method });
  console.log(LOG, "auth success");

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error(LOG, "APNs failure", { reason: "missing_supabase_env" });
    return jsonResponse({ ok: false, error: "misconfigured" }, 500);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  console.log(LOG, "webhook payload", {
    table: body?.table ?? null,
    type: body?.type ?? null,
  });

  if (isDatabaseWebhook(body)) {
    const table = String(body.table || "");
    const record = (body.record ?? {}) as Record<string, unknown>;

    try {
      if (table === "messages") {
        const result = await handleMessageInsert(admin, record as MessageRecord);
        return jsonResponse(result);
      }

      if (table === "friend_requests") {
        const result = await handleFriendRequestInsert(admin, record as FriendRequestRecord);
        return jsonResponse(result);
      }

      return jsonResponse({ ok: true, skipped: true, reason: "unsupported_table" });
    } catch (err) {
      console.error(LOG, "APNs failure", { error: String(err) });
      return jsonResponse({ ok: false, error: String(err) }, 500);
    }
  }

  const legacy = await handleLegacyWebPush(body);
  return jsonResponse(legacy);
});
