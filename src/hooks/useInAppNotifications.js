import { useEffect } from "react";
import { supabase } from "../supabaseClient";

export default function useInAppNotifications(userId, onNotification) {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("inapp-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          if (payload.new.user_id === userId) {
            onNotification?.(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, onNotification]);
}
