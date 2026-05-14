// src/pages/WeeklyCheckIn.jsx
//
// Lightweight, optional weekly check-in. Uses the user_checkins table:
//   { user_id, checkin_date, bodyweight, notes, local_photo_count }
//
// Nothing is required. The app never blocks usage if the user skips it.
// No new server-side cost beyond a single SELECT on mount and one INSERT
// when the user explicitly saves.

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import { useToast } from "../components/ToastProvider";
import { countProgressPhotosSince } from "../services/progressPhotosLocal";
import { safeRunAchievementEvaluation } from "../features/achievements/runner";

function todayLocalDate() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso) {
  if (!iso) return null;
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString();
  } catch {
    return iso;
  }
}

export default function WeeklyCheckIn() {
  const navigate = useNavigate();
  const toast = useToast();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState(null);

  const [date, setDate] = useState(todayLocalDate());
  const [bodyweight, setBodyweight] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const u = authData?.user;
        if (cancelled) return;
        setUser(u || null);
        if (!u?.id) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("user_checkins")
          .select("checkin_date, bodyweight, notes, local_photo_count")
          .eq("user_id", u.id)
          .order("checkin_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;
        if (!error && data) {
          setLastCheckIn(data);
        }
      } catch (err) {
        console.warn("[checkin] load failed:", err?.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveCheckIn() {
    if (!user?.id || saving) return;
    setSaving(true);
    try {
      // Local-only photo metric — counts photos saved on this device in the
      // last 7 days. Backend never sees the images.
      const sevenDaysAgo = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000
      ).toISOString();
      let localPhotoCount = 0;
      try {
        localPhotoCount = await countProgressPhotosSince(sevenDaysAgo);
      } catch {
        localPhotoCount = 0;
      }

      const payload = {
        user_id: user.id,
        checkin_date: date || todayLocalDate(),
        bodyweight:
          bodyweight === "" || Number.isNaN(Number(bodyweight))
            ? null
            : Number(bodyweight),
        notes: notes?.trim() ? notes.trim().slice(0, 1000) : null,
        local_photo_count: localPhotoCount,
      };

      // Optional bodyweight passthrough: if the user typed a weight, also
      // log it into the existing bodyweight_logs table so the streak picks
      // it up. Failure here is non-fatal.
      if (payload.bodyweight != null) {
        try {
          const isoLogged = new Date(
            `${payload.checkin_date}T12:00:00.000Z`
          ).toISOString();
          await supabase.from("bodyweight_logs").insert({
            user_id: user.id,
            weight: payload.bodyweight,
            unit: "lbs",
            logged_at: isoLogged,
          });
          safeRunAchievementEvaluation(user.id, {});
        } catch (err) {
          console.warn("[checkin] bodyweight passthrough failed:", err?.message);
        }
      }

      const { error } = await supabase.from("user_checkins").insert(payload);
      if (error) throw error;

      setLastCheckIn(payload);
      setBodyweight("");
      setNotes("");
      toast?.success?.("Check-in saved");
      safeRunAchievementEvaluation(user.id, {});
    } catch (err) {
      toast?.error?.(err?.message || "Could not save check-in");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        padding: 16,
        paddingTop: "calc(16px + var(--safe-area-top))",
        paddingBottom: "calc(80px + var(--safe-area-bottom))",
        color: "var(--text)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Back"
          style={iconBtn}
        >
          <FaArrowLeft />
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
          Weekly check-in
        </h1>
      </header>

      <p
        style={{
          fontSize: 12,
          opacity: 0.7,
          marginTop: -4,
          marginBottom: 14,
          lineHeight: 1.4,
        }}
      >
        A small weekly snapshot. Everything here is optional.
      </p>

      {!loading && lastCheckIn && (
        <div
          style={{
            background: "var(--card-2)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 12,
            marginBottom: 14,
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            Last check-in
          </div>
          <div style={{ opacity: 0.8 }}>
            {fmtDate(lastCheckIn.checkin_date) || "—"}
            {lastCheckIn.bodyweight != null && (
              <> · {lastCheckIn.bodyweight} lbs</>
            )}
          </div>
          {lastCheckIn.notes && (
            <div style={{ opacity: 0.7, marginTop: 6, whiteSpace: "pre-wrap" }}>
              {lastCheckIn.notes}
            </div>
          )}
        </div>
      )}

      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <label style={fieldLabel}>Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={inputStyle}
        />

        <label style={fieldLabel}>Bodyweight (optional)</label>
        <input
          type="number"
          inputMode="decimal"
          placeholder="Leave blank to skip"
          value={bodyweight}
          onChange={(e) => setBodyweight(e.target.value)}
          style={inputStyle}
        />

        <label style={fieldLabel}>Notes (optional)</label>
        <textarea
          rows={4}
          placeholder="How did the week go?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ ...inputStyle, resize: "vertical" }}
        />

        <button
          type="button"
          onClick={saveCheckIn}
          disabled={saving || !user?.id}
          style={{
            marginTop: 6,
            padding: "12px 14px",
            borderRadius: 12,
            border: "none",
            background: "var(--accent)",
            color: "var(--text)",
            fontWeight: 800,
            cursor: saving ? "default" : "pointer",
            opacity: saving || !user?.id ? 0.6 : 1,
          }}
        >
          {saving ? "Saving…" : "Save check-in"}
        </button>
      </div>
    </div>
  );
}

const iconBtn = {
  width: 36,
  height: 36,
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--card-2)",
  color: "var(--text)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const inputStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--card-2)",
  color: "var(--text)",
  fontSize: 14,
  boxSizing: "border-box",
};

const fieldLabel = {
  fontSize: 12,
  opacity: 0.7,
};
