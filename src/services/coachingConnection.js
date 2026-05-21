import { supabase } from "../supabaseClient";
import { getOfficialCoachingAccount } from "./officialCoachingAccount";
import { getOrCreateConversation } from "../utils/getOrCreateConversation";

/** @typedef {'connected'|'pending_sent'|'pending_received'|'none'|'self'|'unavailable'} CoachingConnectionStatus */

/**
 * @returns {Promise<{ status: CoachingConnectionStatus, profile: object | null }>}
 */
export async function getOfficialCoachingConnectionStatus(currentUserId) {
  const profile = await getOfficialCoachingAccount();
  if (!profile?.id) return { status: "unavailable", profile: null };
  if (!currentUserId) return { status: "unavailable", profile };
  if (currentUserId === profile.id) return { status: "self", profile };

  try {
    const { data: friendRows } = await supabase
      .from("friends")
      .select("id, status, user_id, friend_id")
      .or(
        `and(user_id.eq.${currentUserId},friend_id.eq.${profile.id}),and(user_id.eq.${profile.id},friend_id.eq.${currentUserId})`
      );

    if (Array.isArray(friendRows) && friendRows.length > 0) {
      const accepted = friendRows.some(
        (r) => String(r?.status || "").toLowerCase() === "accepted"
      );
      if (accepted) return { status: "connected", profile };

      const pendingSent = friendRows.some(
        (r) =>
          String(r?.status || "").toLowerCase() === "pending" &&
          r.user_id === currentUserId
      );
      if (pendingSent) return { status: "pending_sent", profile };

      const pendingReceived = friendRows.some(
        (r) =>
          String(r?.status || "").toLowerCase() === "pending" &&
          r.user_id === profile.id
      );
      if (pendingReceived) return { status: "pending_received", profile };
    }

    const { data: reqRows } = await supabase
      .from("friend_requests")
      .select("id, sender_id, receiver_id, status")
      .or(
        `and(sender_id.eq.${currentUserId},receiver_id.eq.${profile.id}),and(sender_id.eq.${profile.id},receiver_id.eq.${currentUserId})`
      )
      .eq("status", "pending");

    if (Array.isArray(reqRows) && reqRows.length > 0) {
      if (reqRows.some((r) => r.sender_id === currentUserId)) {
        return { status: "pending_sent", profile };
      }
      return { status: "pending_received", profile };
    }

    return { status: "none", profile };
  } catch (err) {
    console.warn("[coaching] connection status check failed:", err?.message || err);
    return { status: "none", profile };
  }
}

async function ensureCoachingFriendship(currentUserId, officialId, status) {
  if (status === "connected") return true;

  if (status === "pending_received") {
    try {
      const { data: reqRows } = await supabase
        .from("friend_requests")
        .select("id, sender_id, receiver_id")
        .eq("sender_id", officialId)
        .eq("receiver_id", currentUserId)
        .eq("status", "pending")
        .limit(1);

      const req = reqRows?.[0];
      if (req?.sender_id && req?.receiver_id) {
        await supabase.from("friends").insert({
          user_id: req.sender_id,
          friend_id: req.receiver_id,
          status: "accepted",
        });
        await supabase.from("friend_requests").delete().eq("id", req.id);
        return true;
      }
    } catch (err) {
      console.warn("[coaching] accept incoming request failed:", err?.message || err);
    }
  }

  if (status === "none" || status === "pending_sent") {
    try {
      const { error: friendErr } = await supabase.from("friends").insert({
        user_id: currentUserId,
        friend_id: officialId,
        status: "accepted",
      });

      if (!friendErr) {
        await supabase
          .from("friend_requests")
          .delete()
          .or(
            `and(sender_id.eq.${currentUserId},receiver_id.eq.${officialId}),and(sender_id.eq.${officialId},receiver_id.eq.${currentUserId})`
          );
        return true;
      }

      if (status === "none") {
        const { error: reqErr } = await supabase.from("friend_requests").insert({
          sender_id: currentUserId,
          receiver_id: officialId,
          status: "pending",
        });

        if (!reqErr || /duplicate|unique|already exists/i.test(reqErr.message || "")) {
          return true;
        }
      }
    } catch (err) {
      console.warn("[coaching] ensure friendship failed:", err?.message || err);
    }
  }

  return status === "pending_sent" || status === "pending_received";
}

/**
 * Connect with the official coaching account and open a DM thread.
 * @returns {Promise<{ ok: boolean, message: string, profile: object | null, navigateTo: string | null, status: CoachingConnectionStatus }>}
 */
export async function connectWithOfficialCoachingAccount(currentUserId) {
  const { status, profile } = await getOfficialCoachingConnectionStatus(currentUserId);

  if (!profile?.id) {
    return {
      ok: false,
      message: "Official coaching is temporarily offline.",
      profile: null,
      navigateTo: null,
      status: "unavailable",
    };
  }

  if (status === "self") {
    return {
      ok: false,
      message: "This is your account.",
      profile,
      navigateTo: `/profile`,
      status,
    };
  }

  await ensureCoachingFriendship(currentUserId, profile.id, status);

  try {
    await getOrCreateConversation(currentUserId, profile.id);
  } catch (err) {
    console.warn("[coaching] conversation setup failed:", err?.message || err);
  }

  const chatPath = `/chat/${profile.id}`;

  if (status === "connected") {
    return {
      ok: true,
      message: "",
      profile,
      navigateTo: chatPath,
      status,
    };
  }

  return {
    ok: true,
    message: status === "pending_sent" ? "Friend request already pending." : "Opening chat…",
    profile,
    navigateTo: chatPath,
    status: status === "none" ? "connected" : status,
  };
}
