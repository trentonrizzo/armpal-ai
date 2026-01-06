import React, { useEffect, useState, useRef } from "react";
import { achievementBus } from "../utils/achievementBus";
import { supabase } from "../supabaseClient";
import "./achievementOverlay.css"; // optional

/* ============================================================
   ACHIEVEMENT DEFINITIONS
============================================================ */

const ACHIEVEMENTS = {
  FIRST_WORKOUT: {
    title: "🏁 Let’s Go!",
    message: "You logged your first workout. ArmPal is officially tracking you.",
    once: true,
  },
  FIRST_PR: {
    title: "💥 First PR!",
    message: "This is where strength starts getting serious.",
    once: true,
  },
  FIRST_MEASUREMENT: {
    title: "📏 Progress Begins",
    message: "Numbers don’t lie — let’s watch them grow.",
    once: true,
  },
  FIRST_BODYWEIGHT: {
    title: "⚖️ Baseline Set",
    message: "This is your starting point. Everything builds from here.",
    once: true,
  },
  NEW_PR: {
    title: "🏆 NEW PR",
    once: false,
  },
};

/* ============================================================
   COMPONENT
============================================================ */

export default function AchievementOverlay() {
  const [queue, setQueue] = useState([]);
  const [active, setActive] = useState(null);
  const processingRef = useRef(false);

  /* ============================================================
     SUBSCRIBE TO ACHIEVEMENT BUS
  ============================================================ */
  useEffect(() => {
    const unsub = achievementBus.subscribe((event) => {
      // Expect event to be an OBJECT: { type: "FIRST_WORKOUT", ... }
      if (event && event.type) {
        setQueue((q) => [...q, event]);
      }
    });

    return unsub;
  }, []);

  /* ============================================================
     PROCESS QUEUE
  ============================================================ */
  useEffect(() => {
    if (!active && queue.length && !processingRef.current) {
      processNext(queue[0]);
    }
  }, [queue, active]);

  async function processNext(event) {
    processingRef.current = true;

    const config = ACHIEVEMENTS[event.type];
    if (!config) {
      popQueue();
      return;
    }

    // Check if already earned (PER USER)
    if (config.once) {
      const already = await hasAchievement(event.type);
      if (already) {
        popQueue();
        return;
      }
    }

    // Save achievement (PER USER)
    await saveAchievement(event);

    // Show overlay
    setActive({
      ...event,
      title: config.title,
      message:
        config.message ||
        `${event.exercise ?? ""} ${event.value ?? ""}`.trim(),
    });

    processingRef.current = false;
  }

  function popQueue() {
    setQueue((q) => q.slice(1));
    processingRef.current = false;
  }

  /* ============================================================
     DATABASE HELPERS (FIXED — USER SCOPED)
  ============================================================ */

  async function hasAchievement(type) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return false;

    const { data } = await supabase
      .from("user_achievements")
      .select("id")
      .eq("type", type)
      .eq("user_id", user.id)
      .limit(1);

    return Array.isArray(data) && data.length > 0;
  }

  async function saveAchievement(event) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    await supabase.from("user_achievements").insert({
      user_id: user.id,
      type: event.type,
      metadata: event,
    });
  }

  /* ============================================================
     CLOSE HANDLER
  ============================================================ */
  function close() {
    setActive(null);
    popQueue();
  }

  if (!active) return null;

  /* ============================================================
     UI
  ============================================================ */
  return (
    <div className="achievement-overlay">
      <div className="achievement-card">
        <h2>{active.title}</h2>
        <p>{active.message}</p>

        {active.exercise && (
          <div className="achievement-meta">
            <strong>{active.exercise}</strong>
            <span>{active.value}</span>
          </div>
        )}

        <button onClick={close}>🔥 Let’s Go</button>
      </div>
    </div>
  );
}
