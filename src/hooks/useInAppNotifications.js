import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import InAppNotification from "../components/notifications/InAppNotification";

// ── Context: in-app banner queue (read-only for UI; hook pushes via addNotification) ──
const InAppNotificationContext = createContext({
  queue: [],
  addNotification: () => {},
  removeFirst: () => {},
});

export function InAppNotificationProvider({ children }) {
  const [queue, setQueue] = useState([]);

  const addNotification = useCallback((notification) => {
    setQueue((prev) => [...prev, notification]);
  }, []);

  const removeFirst = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  return (
    <InAppNotificationContext.Provider
      value={{ queue, addNotification, removeFirst }}
    >
      {children}
    </InAppNotificationContext.Provider>
  );
}

export function useInAppNotificationQueue() {
  return useContext(InAppNotificationContext);
}

/**
 * Subscribe to Supabase realtime INSERT on notifications.
 * When notification.user_id === current user, push into banner queue.
 * READ ONLY — no writes, no DB changes.
 */
export default function useInAppNotifications(userId) {
  const { addNotification } = useInAppNotificationQueue();

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
          const notification = payload?.new;
          if (!notification) return;
          if (notification.user_id !== userId) return;
          addNotification({
            id: notification.id,
            user_id: notification.user_id,
            title: notification.title,
            body: notification.body,
            link: notification.link,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, addNotification]);
}

/**
 * Renders the in-app banner and runs the realtime listener.
 * Must be mounted inside InAppNotificationProvider.
 */
export function InAppNotificationRoot({ userId }) {
  useInAppNotifications(userId);
  const { queue, removeFirst } = useInAppNotificationQueue();
  return <InAppNotification queue={queue} removeFirst={removeFirst} />;
}
