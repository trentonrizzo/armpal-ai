import { sendFriendRequestToUser } from "./friendRequests";

const ARMPAL_FRIEND_MESSAGES = {
  successMessage: "Friend request sent to ArmPal.",
  alreadySentMessage: "Friend request already sent.",
  alreadyFriendsMessage: "You're already connected with ArmPal.",
};

/**
 * Send a normal pending friend request to the official ARMPAL profile.
 * @param {string} currentUserId
 * @param {string} receiverId
 * @returns {Promise<{ ok: boolean, message: string, status: string }>}
 */
export async function connectWithOfficialCoachingAccount(currentUserId, receiverId) {
  if (!receiverId) {
    return { ok: false, message: "Official ArmPal account not found.", status: "unavailable" };
  }

  return sendFriendRequestToUser(currentUserId, receiverId, ARMPAL_FRIEND_MESSAGES);
}
