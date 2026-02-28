import { useEffect } from "react";
import { supabase } from "../supabaseClient";

/**
 * Read-only: subscribes to Supabase realtime INSERT on notifications.
 * Pushes mapped items into the provided queue when not suppressed.
 * No JSX. Clean unsubscribe on unmount.
 *
 * @param {string} userId - Current user id
 * @param {(notifItem: object) => boolean} isSuppressedFn - When true, do not add to queue
 * @param {function} setQueue - React setState for queue: (prev => [...prev, item])
 */
export default function useInAppBannerNotifications(userId, isSuppressedFn, setQueue) {
  useEffect(() => {
    if (!userId || typeof setQueue !== "function") return;

    const channel = supabase
      .channel("inapp-banner-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          const notification = payload?.new;
          if (!notification) return;
          if (notification.user_id !== userId) return;

          const notifItem = {
            id: notification.id || notification.created_at,
            title: notification.title || "Notification",
            body: notification.body || "",
            link: notification.link || "",
            raw: notification,
          };

          if (typeof isSuppressedFn === "function" && isSuppressedFn(notifItem)) return;

          setQueue((prev) => [...prev, notifItem]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, isSuppressedFn, setQueue]);
}
