import { useEffect } from "react";
import { supabase } from "../supabaseClient";

export default function usePresence(user) {
  useEffect(() => {
    if (!user?.id) return;

    let heartbeat;

    const setOnline = async () => {
      await supabase
        .from("profiles")
        .update({
          is_online: true,
          last_active: new Date().toISOString(),
        })
        .eq("id", user.id);
    };

    const setOffline = async () => {
      await supabase
        .from("profiles")
        .update({
          is_online: false,
          last_seen: new Date().toISOString(),
        })
        .eq("id", user.id);
    };

    setOnline();
    heartbeat = setInterval(setOnline, 30000);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        setOffline();
      } else {
        setOnline();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibility);
      setOffline();
    };
  }, [user?.id]);
}
