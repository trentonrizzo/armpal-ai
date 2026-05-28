import { supabase } from "../supabaseClient";
import {
  firePush,
  notifyFriendAcceptPush,
  notifyFriendRequestPush,
} from "../lib/pushDelivery";

/** @typedef {'friends'|'pending_sent'|'pending_received'|'none'|'self'} FriendRequestStatus */

/**
 * @returns {Promise<FriendRequestStatus>}
 */
export async function getFriendRequestStatus(currentUserId, targetUserId) {
  if (!currentUserId || !targetUserId) return "none";
  if (currentUserId === targetUserId) return "self";

  try {
    const { data: friendRows } = await supabase
      .from("friends")
      .select("id, status, user_id, friend_id")
      .or(
        `and(user_id.eq.${currentUserId},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${currentUserId})`
      );

    if (Array.isArray(friendRows) && friendRows.length > 0) {
      const accepted = friendRows.some(
        (r) => String(r?.status || "").toLowerCase() === "accepted"
      );
      if (accepted) return "friends";
    }

    const { data: reqRows } = await supabase
      .from("friend_requests")
      .select("id, sender_id, receiver_id, status")
      .or(
        `and(sender_id.eq.${currentUserId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${currentUserId})`
      )
      .eq("status", "pending");

    if (Array.isArray(reqRows) && reqRows.length > 0) {
      if (reqRows.some((r) => r.sender_id === currentUserId)) return "pending_sent";
      return "pending_received";
    }

    return "none";
  } catch (err) {
    console.warn("[friendRequests] status check failed:", err?.message || err);
    return "none";
  }
}

/**
 * Send a normal pending friend request — same path as Friends → Add friend.
 * @param {string} currentUserId
 * @param {string} receiverId
 * @param {{ successMessage?: string, alreadySentMessage?: string, alreadyFriendsMessage?: string }} [messages]
 * @returns {Promise<{ ok: boolean, message: string, status: FriendRequestStatus }>}
 */
export async function sendFriendRequestToUser(currentUserId, receiverId, messages = {}) {
  const {
    successMessage = "Friend request sent.",
    alreadySentMessage = "Friend request already sent.",
    alreadyFriendsMessage = "You're already friends.",
  } = messages;

  if (!currentUserId || !receiverId) {
    return { ok: false, message: "Error sending request.", status: "none" };
  }

  if (currentUserId === receiverId) {
    return { ok: false, message: "You can't add yourself.", status: "self" };
  }

  const status = await getFriendRequestStatus(currentUserId, receiverId);

  if (status === "friends") {
    return { ok: true, message: alreadyFriendsMessage, status };
  }

  if (status === "pending_sent") {
    return { ok: true, message: alreadySentMessage, status };
  }

  try {
    const { data: inserted, error: insertErr } = await supabase
      .from("friend_requests")
      .insert({
        sender_id: currentUserId,
        receiver_id: receiverId,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertErr) {
      if (/duplicate|unique|already exists/i.test(insertErr.message || "")) {
        return { ok: true, message: alreadySentMessage, status: "pending_sent" };
      }
      console.error("friend_requests insert error:", insertErr);
      return { ok: false, message: "Error sending request.", status: "none" };
    }

    firePush("friend request", () =>
      notifyFriendRequestPush({
        senderId: currentUserId,
        recipientId: receiverId,
        requestId: inserted?.id || null,
      })
    );

    return { ok: true, message: successMessage, status: "pending_sent" };
  } catch (err) {
    console.error("[friendRequests] send failed:", err);
    return { ok: false, message: "Error sending request.", status: "none" };
  }
}

/**
 * Accept a pending row in friend_requests and notify the original sender.
 */
export async function acceptFriendRequestById(accepterId, requestId) {
  if (!accepterId || !requestId) return { ok: false };

  try {
    const { data: req, error: reqErr } = await supabase
      .from("friend_requests")
      .select("id, sender_id, receiver_id")
      .eq("id", requestId)
      .maybeSingle();

    if (reqErr || !req?.sender_id || !req?.receiver_id) {
      return { ok: false, error: reqErr?.message || "Request not found" };
    }

    if (req.receiver_id !== accepterId) {
      return { ok: false, error: "Not authorized to accept this request" };
    }

    const { error: friendErr } = await supabase.from("friends").insert({
      user_id: req.sender_id,
      friend_id: req.receiver_id,
      status: "accepted",
    });

    if (friendErr) {
      return { ok: false, error: friendErr.message };
    }

    await supabase.from("friend_requests").delete().eq("id", requestId);

    firePush("friend accept", () =>
      notifyFriendAcceptPush({
        accepterId,
        originalSenderId: req.sender_id,
        requestId,
      })
    );

    return { ok: true, senderId: req.sender_id };
  } catch (err) {
    console.error("[friendRequests] accept failed:", err);
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Accept a pending row in friends table (legacy incoming request flow).
 */
export async function acceptPendingFriendRow(accepterId, rowId) {
  if (!accepterId || !rowId) return { ok: false };

  try {
    const { data: row, error: rowErr } = await supabase
      .from("friends")
      .select("id, user_id, friend_id, status")
      .eq("id", rowId)
      .maybeSingle();

    if (rowErr || !row?.user_id || !row?.friend_id) {
      return { ok: false, error: rowErr?.message || "Request not found" };
    }

    if (row.friend_id !== accepterId) {
      return { ok: false, error: "Not authorized to accept this request" };
    }

    const { error: updateErr } = await supabase
      .from("friends")
      .update({ status: "accepted" })
      .eq("id", rowId);

    if (updateErr) {
      return { ok: false, error: updateErr.message };
    }

    firePush("friend accept", () =>
      notifyFriendAcceptPush({
        accepterId,
        originalSenderId: row.user_id,
        requestId: rowId,
      })
    );

    return { ok: true, senderId: row.user_id };
  } catch (err) {
    console.error("[friendRequests] accept pending row failed:", err);
    return { ok: false, error: err?.message || String(err) };
  }
}
