// src/components/ConsistencyCard.jsx
//
// Lightweight, gentle consistency widget for the Dashboard:
//   - Daily weigh-in streak (derived from bodyweight_logs)
//   - Quick shortcut to log today's weight
//   - Always-on shortcut to the Progress Photos vault
//
// Nothing here is required. Copy is encouraging, not pushy.
// No Pro / IAP / subscription / Weekly Check-In logic.

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const STREAK_LOOKBACK_DAYS = 60;

function toLocalDayKey(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function todayKey() {
  return toLocalDayKey(new Date());
}

function yesterdayKey() {
  return toLocalDayKey(new Date(Date.now() - ONE_DAY_MS));
}

function computeStreak(daySet) {
  if (!(daySet instanceof Set) || daySet.size === 0) return 0;

  let cursor;
  if (daySet.has(todayKey())) {
    cursor = new Date();
  } else if (daySet.has(yesterdayKey())) {
    cursor = new Date(Date.now() - ONE_DAY_MS);
  } else {
    return 0;
  }

  let streak = 0;
  while (true) {
    const key = toLocalDayKey(cursor);
    if (!daySet.has(key)) break;
    streak += 1;
    cursor = new Date(cursor.getTime() - ONE_DAY_MS);
    if (streak > STREAK_LOOKBACK_DAYS) break;
  }
  return streak;
}

export default function ConsistencyCard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [weighedToday, setWeighedToday] = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;
        if (!user?.id) {
          if (!cancelled) setLoading(false);
          return;
        }

        const sinceIso = new Date(
          Date.now() - STREAK_LOOKBACK_DAYS * ONE_DAY_MS
        ).toISOString();

        const { data: bwRows } = await supabase
          .from("bodyweight_logs")
          .select("logged_at")
          .eq("user_id", user.id)
          .gte("logged_at", sinceIso)
          .order("logged_at", { ascending: false });

        if (cancelled) return;

        const daySet = new Set();
        const today = todayKey();
        let didWeighToday = false;
        for (const row of bwRows || []) {
          const key = toLocalDayKey(row?.logged_at);
          if (!key) continue;
          daySet.add(key);
          if (key === today) didWeighToday = true;
        }

        setStreak(computeStreak(daySet));
        setWeighedToday(didWeighToday);
      } catch (err) {
        console.warn("[consistency] load failed:", err?.message);
        if (!cancelled) setErrored(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (errored) return null;

  const showWeightNudge = !loading && !weighedToday;

  return (
    <section style={{ marginBottom: 20 }} data-onboarding="consistency">
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
        Consistency
      </h2>

      <div
        style={{
          background: "var(--card-2)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          fontSize: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 700 }}>
            {loading
              ? "…"
              : streak > 0
              ? `${streak}-day weigh-in streak`
              : "Start your weigh-in streak"}
          </div>
        </div>

        {showWeightNudge && (
          <NudgeRow
            label="Log today's weight"
            onClick={() => navigate("/measure?focus=bodyweight")}
          />
        )}

        {/* Always-on entry point — Progress Photos vault */}
        <NudgeRow
          label="Progress photos"
          onClick={() => navigate("/progress-photos")}
        />
      </div>
    </section>
  );
}

function NudgeRow({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 10,
        background: "var(--card)",
        border: "1px solid var(--border)",
        color: "var(--text)",
        textAlign: "left",
        fontSize: 13,
        cursor: "pointer",
        width: "100%",
      }}
    >
      <span>{label}</span>
      <span aria-hidden="true" style={{ opacity: 0.5 }}>›</span>
    </button>
  );
}
