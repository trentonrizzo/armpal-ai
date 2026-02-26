import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";

const LS_KEY = "armpal_group_reads";

function getGroupReads() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  } catch {
    return {};
  }
}

function setGroupRead(groupId) {
  const reads = getGroupReads();
  reads[groupId] = new Date().toISOString();
  localStorage.setItem(LS_KEY, JSON.stringify(reads));
}

/**
 * Tracks total unread DMs + group messages for the current user.
 * Returns { count, markDmRead(friendId), markGroupRead(groupId), refresh }
 */
export default function useUnreadChats(userId) {
  const [count, setCount] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchCount = useCallback(async () => {
    if (!userId) { setCount(0); return; }

    let dmUnread = 0;
    let groupUnread = 0;

    try {
      const { data: received } = await supabase
        .from("messages")
        .select("id")
        .eq("receiver_id", userId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (received?.length) {
        const msgIds = received.map((m) => m.id);

        const { data: reads } = await supabase
          .from("message_reads")
          .select("message_id")
          .eq("user_id", userId)
          .in("message_id", msgIds);

        const readSet = new Set((reads || []).map((r) => r.message_id));
        dmUnread = msgIds.filter((id) => !readSet.has(id)).length;
      }
    } catch {
      // message_reads table may not exist — fall back to 0
    }

    try {
      const { data: memberships } = await supabase
        .from("chat_group_members")
        .select("group_id")
        .eq("user_id", userId);

      if (memberships?.length) {
        const groupReads = getGroupReads();

        for (const { group_id } of memberships) {
          const lastRead = groupReads[group_id] || "1970-01-01T00:00:00.000Z";

          const { count: unread } = await supabase
            .schema("public")
            .from("group_messages")
            .select("id", { count: "exact", head: true })
            .eq("group_id", group_id)
            .neq("sender_id", userId)
            .gt("created_at", lastRead);

          groupUnread += unread || 0;
        }
      }
    } catch {
      // group tables may not exist
    }

    if (mountedRef.current) setCount(dmUnread + groupUnread);
  }, [userId]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  // Realtime: new DMs
  useEffect(() => {
    if (!userId) return;

    const ch = supabase
      .channel(`unread-dm-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${userId}`,
        },
        () => { fetchCount(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [userId, fetchCount]);

  // Realtime: new group messages
  useEffect(() => {
    if (!userId) return;

    const ch = supabase
      .channel(`unread-grp-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "group_messages",
        },
        () => { fetchCount(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [userId, fetchCount]);

  const markDmRead = useCallback(async (friendId) => {
    if (!userId || !friendId) return;
    try {
      const { data: unread } = await supabase
        .from("messages")
        .select("id")
        .eq("sender_id", friendId)
        .eq("receiver_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!unread?.length) return;

      const { data: existing } = await supabase
        .from("message_reads")
        .select("message_id")
        .eq("user_id", userId)
        .in("message_id", unread.map((m) => m.id));

      const readSet = new Set((existing || []).map((r) => r.message_id));
      const toMark = unread.filter((m) => !readSet.has(m.id));

      if (toMark.length > 0) {
        await supabase.from("message_reads").insert(
          toMark.map((m) => ({ user_id: userId, message_id: m.id }))
        );
      }
    } catch (e) {
      console.warn("markDmRead error:", e);
    }
    fetchCount();
  }, [userId, fetchCount]);

  const markGroupRead = useCallback((groupId) => {
    if (!groupId) return;
    setGroupRead(groupId);
    fetchCount();
  }, [fetchCount]);

  return { count, markDmRead, markGroupRead, refresh: fetchCount };
}
