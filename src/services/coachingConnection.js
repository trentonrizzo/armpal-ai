import { supabase } from "../supabaseClient";
import {
  OFFICIAL_COACHING_HANDLE,
  OFFICIAL_COACHING_USER_ID,
} from "../config/officialCoachingAccount";

/** @typedef {'connected'|'pending_sent'|'pending_received'|'none'|'self'|'unavailable'} CoachingConnectionStatus */

/**
 * Resolve the official ArmPal coaching profile from env id or handle.
 * @returns {Promise<{ id: string, display_name?: string, handle?: string, username?: string, avatar_url?: string, is_official?: boolean } | null>}
 */
export async function resolveOfficialCoachingProfile() {
  try {
    if (OFFICIAL_COACHING_USER_ID) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, handle, username, avatar_url, is_official")
        .eq("id", OFFICIAL_COACHING_USER_ID)
        .maybeSingle();
      if (!error && data?.id) return data;
    }

    const handle = (OFFICIAL_COACHING_HANDLE || "").replace(/^@+/, "");
    if (!handle) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, handle, username, avatar_url, is_official")
      .ilike("handle", handle)
      .maybeSingle();

    if (error || !data?.id) return null;
    return data;
  } catch (err) {
    console.warn("[coaching] resolveOfficialCoachingProfile failed:", err?.message || err);
    return null;
  }
}

/**
 * @returns {Promise<{ status: CoachingConnectionStatus, profile: object | null }>}
 */
export async function getOfficialCoachingConnectionStatus(currentUserId) {
  const profile = await resolveOfficialCoachingProfile();
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

/**
 * Connect with the official coaching account (friend request or profile/chat navigation).
 * @returns {Promise<{ ok: boolean, message: string, profile: object | null, navigateTo: string | null, status: CoachingConnectionStatus }>}
 */
export async function connectWithOfficialCoachingAccount(currentUserId) {
  const { status, profile } = await getOfficialCoachingConnectionStatus(currentUserId);

  if (!profile?.id) {
    return {
      ok: false,
      message: "Official coaching account is not available right now.",
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

  if (status === "connected") {
    return {
      ok: true,
      message: "You are already connected.",
      profile,
      navigateTo: `/chat/${profile.id}`,
      status,
    };
  }

  if (status === "pending_sent" || status === "pending_received") {
    return {
      ok: true,
      message: "Friend request already pending.",
      profile,
      navigateTo: `/friend/${profile.id}`,
      status,
    };
  }

  try {
    const { error: insertErr } = await supabase.from("friend_requests").insert({
      sender_id: currentUserId,
      receiver_id: profile.id,
      status: "pending",
    });

    if (insertErr) {
      if (/duplicate|unique|already exists/i.test(insertErr.message || "")) {
        return {
          ok: true,
          message: "Friend request already pending.",
          profile,
          navigateTo: `/friend/${profile.id}`,
          status: "pending_sent",
        };
      }
      throw insertErr;
    }

    return {
      ok: true,
      message: "Friend request sent.",
      profile,
      navigateTo: `/friend/${profile.id}`,
      status: "pending_sent",
    };
  } catch (err) {
    console.error("[coaching] connect failed:", err);
    return {
      ok: false,
      message: "Could not send connection request. Try again from Friends.",
      profile,
      navigateTo: `/friend/${profile.id}`,
      status: "none",
    };
  }
}
