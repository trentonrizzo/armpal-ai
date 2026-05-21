import { supabase } from "../supabaseClient";

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
    const { error: insertErr } = await supabase.from("friend_requests").insert({
      sender_id: currentUserId,
      receiver_id: receiverId,
      status: "pending",
    });

    if (insertErr) {
      if (/duplicate|unique|already exists/i.test(insertErr.message || "")) {
        return { ok: true, message: alreadySentMessage, status: "pending_sent" };
      }
      console.error("friend_requests insert error:", insertErr);
      return { ok: false, message: "Error sending request.", status: "none" };
    }

    return { ok: true, message: successMessage, status: "pending_sent" };
  } catch (err) {
    console.error("[friendRequests] send failed:", err);
    return { ok: false, message: "Error sending request.", status: "none" };
  }
}
