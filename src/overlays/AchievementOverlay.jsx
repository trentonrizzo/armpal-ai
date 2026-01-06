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
     SUBSCRIBE TO EVENTS
  ============================================================ */
  useEffect(() => {
    const unsub = achievementBus.subscribe(event => {
      setQueue(q => [...q, event]);
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
    if (!config) return popQueue();

    // Check if already earned (for one-time achievements)
    if (config.once) {
      const already = await hasAchievement(event.type);
      if (already) return popQueue();
    }

    // Save achievement
    await saveAchievement(event);

    // Show overlay
    setActive({
      ...event,
      title: config.title,
      message:
        config.message ||
        `${event.exercise} — ${event.value} lbs (+${event.diff})`,
    });

    processingRef.current = false;
  }

  function popQueue() {
    setQueue(q => q.slice(1));
    processingRef.current = false;
  }

  /* ============================================================
     DATABASE HELPERS
  ============================================================ */

  async function hasAchievement(type) {
    const { data } = await supabase
      .from("user_achievements")
      .select("id")
      .eq("type", type)
      .limit(1);
    return data && data.length > 0;
  }

  async function saveAchievement(event) {
    await supabase.from("user_achievements").insert({
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
            <span>{active.value} lbs</span>
          </div>
        )}

        <button onClick={close}>🔥 Let’s Go</button>
      </div>
    </div>
  );
}
