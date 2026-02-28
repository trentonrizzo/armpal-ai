import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";

const REACTION_KEYS = ["🔥", "💪", "❤️", "👊"];
const EMPTY = { "🔥": 0, "💪": 0, "❤️": 0, "👊": 0 };

/**
 * Single source of truth for profile reaction counts + send logic.
 *
 * @param {string|null} profileUserId - The profile being viewed
 * @param {string|null} viewerUserId  - The currently logged-in user (null = read-only)
 */
export default function useProfileReactions(profileUserId, viewerUserId) {
  const [counts, setCounts] = useState({ ...EMPTY });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchCounts = useCallback(async () => {
    if (!profileUserId) {
      setCounts({ ...EMPTY });
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("profile_reactions")
        .select("reaction_type")
        .eq("to_user_id", profileUserId);

      if (error) throw error;

      const next = { ...EMPTY };
      (data || []).forEach((row) => {
        const t = row.reaction_type;
        if (t != null && t in next) next[t] = (next[t] || 0) + 1;
      });

      if (mountedRef.current) setCounts(next);
    } catch (e) {
      console.warn("useProfileReactions fetchCounts:", e);
      if (mountedRef.current) setCounts({ ...EMPTY });
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [profileUserId]);

  useEffect(() => {
    setLoading(true);
    fetchCounts();
  }, [fetchCounts]);

  // Realtime: refresh counts when profile_reactions rows change for this profile
  useEffect(() => {
    if (!profileUserId) return;

    const channel = supabase
      .channel(`profile-rx-${profileUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profile_reactions",
          filter: `to_user_id=eq.${profileUserId}`,
        },
        () => { fetchCounts(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profileUserId, fetchCounts]);

  /**
   * Send a reaction. Rule: one reaction per sender per profile per calendar day.
   * The SAME emoji can be sent again on a different day.
   * Returns { ok, message }.
   */
  const sendReaction = useCallback(async (emoji) => {
    if (!viewerUserId || !profileUserId || sending) {
      return { ok: false, message: "Not ready" };
    }
    if (!REACTION_KEYS.includes(emoji)) {
      return { ok: false, message: "Invalid reaction" };
    }

    setSending(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);

      // Check: did this user already react to this profile today?
      const { data: existing } = await supabase
        .from("profile_reactions")
        .select("id")
        .eq("from_user_id", viewerUserId)
        .eq("to_user_id", profileUserId)
        .gte("created_at", `${todayStr}T00:00:00.000Z`)
        .lt("created_at", `${todayStr}T23:59:59.999Z`)
        .limit(1);

      if (existing && existing.length > 0) {
        return { ok: false, message: "Already reacted today" };
      }

      // Insert the reaction
      const { error: insertErr } = await supabase
        .from("profile_reactions")
        .insert({
          from_user_id: viewerUserId,
          to_user_id: profileUserId,
          reaction_type: emoji,
          reaction_date: new Date().toISOString(),
        });

      if (insertErr) throw insertErr;

      // Optimistic count update
      setCounts((prev) => ({
        ...prev,
        [emoji]: (prev[emoji] || 0) + 1,
      }));

      // Insert notification for the recipient
      if (viewerUserId !== profileUserId) {
        try {
          // Get sender's display name for notification text
          const { data: senderProfile } = await supabase
            .from("profiles")
            .select("display_name, handle, username")
            .eq("id", viewerUserId)
            .maybeSingle();

          const senderName =
            senderProfile?.display_name ||
            (senderProfile?.handle ? `@${senderProfile.handle}` : null) ||
            senderProfile?.username ||
            "Someone";

          const { error: notifErr } = await supabase.from("notifications").insert({
            user_id: profileUserId,
            title: `${emoji} New Reaction`,
            body: `${senderName} reacted ${emoji} to your profile`,
            link: `/friend/${viewerUserId}`,
          });
          if (notifErr) console.warn("Failed to create reaction notification:", notifErr);
          if (!notifErr && typeof import.meta !== "undefined" && import.meta.env?.DEV) console.log("[notify] reaction notification inserted for", profileUserId);
        } catch (notifErr) {
          console.warn("Failed to create reaction notification:", notifErr);
        }
      }

      return { ok: true, message: "Reaction sent!" };
    } catch (e) {
      console.error("sendReaction failed:", e);
      return { ok: false, message: e?.message || "Failed to send reaction" };
    } finally {
      if (mountedRef.current) setSending(false);
    }
  }, [viewerUserId, profileUserId, sending]);

  return {
    counts,
    loading,
    sending,
    sendReaction,
    refresh: fetchCounts,
  };
}

export { REACTION_KEYS };
