import { supabase } from "../supabaseClient";
import { sendPushToUser } from "./sendPush";

const LOG = "[ArmPal.Push]";

export function sanitizePushBody(text, max = 140) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export async function fetchProfileLabel(userId) {
  if (!userId) return "Someone";
  try {
    const { data } = await supabase
      .from("profiles")
      .select("display_name, username, handle")
      .eq("id", userId)
      .maybeSingle();
    return data?.display_name || data?.username || data?.handle || "Someone";
  } catch {
    return "Someone";
  }
}

/** Fire-and-forget push with standard logging. Never throws. */
export function firePush(logLabel, promiseFactory) {
  console.log(LOG, `${logLabel} push requested`);
  void (async () => {
    try {
      const result = await promiseFactory();
      if (result?.ok && result?.summary?.sent > 0) {
        console.log(LOG, "push sent", { label: logLabel, summary: result.summary });
      } else if (result?.ok) {
        if (import.meta.env.DEV) {
          console.log(LOG, "push dispatch complete", { label: logLabel, summary: result.summary });
        }
      } else {
        console.warn(LOG, "push failed", { label: logLabel, error: result?.error, summary: result?.summary });
      }
    } catch (err) {
      console.warn(LOG, "push failed", { label: logLabel, error: err?.message || err });
    }
  })();
}

/**
 * @param {'text'|'photo'|'video'|'audio'|'workout'|'fallback'} kind
 */
export async function notifyChatMessagePush({
  senderId,
  recipientId,
  senderName,
  kind = "fallback",
  text = "",
  conversationId = null,
  messageId = null,
}) {
  if (!recipientId || !senderId || recipientId === senderId) {
    return { ok: false, skipped: true };
  }

  const title = senderName || (await fetchProfileLabel(senderId));
  let body = "Sent you a message";

  switch (kind) {
    case "text":
      body = sanitizePushBody(text) || body;
      break;
    case "photo":
      body = "📷 Sent a photo";
      break;
    case "video":
      body = "🎥 Sent a video";
      break;
    case "audio":
      body = "🎤 Sent a voice message";
      break;
    case "workout":
      body = "💪 Shared a workout";
      break;
    default:
      break;
  }

  return sendPushToUser({
    userId: recipientId,
    title,
    body,
    data: {
      type: "chat_message",
      senderId,
      recipientId,
      conversationId,
      messageId,
    },
  });
}

export async function notifyFriendRequestPush({
  senderId,
  recipientId,
  requestId = null,
}) {
  if (!recipientId || !senderId || recipientId === senderId) {
    return { ok: false, skipped: true };
  }

  const senderName = await fetchProfileLabel(senderId);

  return sendPushToUser({
    userId: recipientId,
    title: "ArmPal",
    body: `${senderName} sent you a friend request`,
    data: {
      type: "friend_request",
      senderId,
      recipientId,
      requestId,
    },
  });
}

export async function notifyFriendAcceptPush({
  accepterId,
  originalSenderId,
  requestId = null,
}) {
  if (!accepterId || !originalSenderId || accepterId === originalSenderId) {
    return { ok: false, skipped: true };
  }

  const accepterName = await fetchProfileLabel(accepterId);

  return sendPushToUser({
    userId: originalSenderId,
    title: "ArmPal",
    body: `${accepterName} accepted your friend request`,
    data: {
      type: "friend_accept",
      accepterId,
      originalSenderId,
      requestId,
    },
  });
}

export async function notifyTestPush(userId) {
  return sendPushToUser({
    userId,
    title: "ArmPal Test",
    body: "Push notifications are working",
    data: { type: "test_push" },
  });
}
