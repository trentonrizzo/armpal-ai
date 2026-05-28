import { supabase } from "../supabaseClient";
import { sendPushToUser } from "./sendPush";

const LOG = "[ArmPal.Push]";

/**
 * Resolve the true push recipient for a 1:1 chat message.
 * Never returns the sender — message receiver_id is preferred over route params.
 */
export function resolveChatPushRecipient({
  senderId,
  messageReceiverId = null,
  routeFriendId = null,
  friendProfileId = null,
}) {
  if (!senderId) return null;

  const candidates = [messageReceiverId, routeFriendId, friendProfileId].filter(Boolean);

  for (const candidateId of candidates) {
    if (candidateId !== senderId) {
      return candidateId;
    }
  }

  console.error("[ArmPal.Push] INVALID SELF TARGET BLOCKED", {
    senderId,
    messageReceiverId,
    routeFriendId,
    friendProfileId,
  });
  return null;
}

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
  messageReceiverId = null,
  routeFriendId = null,
  friendProfileId = null,
}) {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const authSenderId = authUser?.id || senderId || null;

  const resolvedRecipientId = resolveChatPushRecipient({
    senderId: authSenderId,
    messageReceiverId: messageReceiverId || recipientId,
    routeFriendId,
    friendProfileId,
  });

  console.log("[ArmPal.Push] FINAL PUSH TARGET", {
    senderId: authSenderId,
    resolvedRecipientId,
    conversationId,
    messageReceiverId: messageReceiverId || recipientId || null,
    routeFriendId,
    friendProfileId,
  });

  if (!resolvedRecipientId || !authSenderId) {
    return { ok: false, skipped: true, reason: "missing_participants" };
  }

  if (resolvedRecipientId === authSenderId) {
    console.error("[ArmPal.Push] INVALID SELF TARGET BLOCKED", {
      senderId: authSenderId,
      resolvedRecipientId,
      conversationId,
    });
    return { ok: false, skipped: true, reason: "self_target" };
  }

  const title = senderName || (await fetchProfileLabel(authSenderId));
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
    userId: resolvedRecipientId,
    title,
    body,
    data: {
      type: "chat_message",
      senderId: authSenderId,
      recipientId: resolvedRecipientId,
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

  console.log(LOG, "FRIEND REQUEST PUSH START", { senderId, recipientId, requestId });

  try {
    const senderName = await fetchProfileLabel(senderId);
    const responseData = await sendPushToUser({
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
    console.log(LOG, "FRIEND REQUEST PUSH RESPONSE", responseData);
    return responseData;
  } catch (err) {
    console.error(LOG, "FRIEND REQUEST PUSH FAILED", err);
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function notifyFriendAcceptPush({
  accepterId,
  originalSenderId,
  requestId = null,
}) {
  if (!accepterId || !originalSenderId || accepterId === originalSenderId) {
    return { ok: false, skipped: true };
  }

  console.log(LOG, "FRIEND ACCEPT PUSH START", { accepterId, originalSenderId, requestId });

  try {
    const accepterName = await fetchProfileLabel(accepterId);
    const responseData = await sendPushToUser({
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
    console.log(LOG, "FRIEND ACCEPT PUSH RESPONSE", responseData);
    return responseData;
  } catch (err) {
    console.error(LOG, "FRIEND ACCEPT PUSH FAILED", err);
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function notifyTestPush(userId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const targetUserId = user?.id || userId;

  console.log("[ArmPal.Push] notifyTestPush", {
    requestedUserId: userId,
    authUserId: user?.id || null,
    targetUserId,
  });

  return sendPushToUser({
    userId: targetUserId,
    title: "ArmPal Test",
    body: "Push notifications are working",
    data: { type: "test_push" },
  });
}

/** Fire-and-forget wrapper for non-chat events. */
export function firePush(_label, promiseFactory) {
  void promiseFactory().catch((err) => {
    console.error(LOG, "PUSH REQUEST FAILED", err);
  });
}
