import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function SmartAnalytics() {
  const [loading, setLoading] = useState(true);

  // Bodyweight
  const [currentBW, setCurrentBW] = useState(null);
  const [bwDelta, setBwDelta] = useState(null);

  // Measurements
  const [measurementStats, setMeasurementStats] = useState([]);

  // PRs
  const [prStats, setPrStats] = useState([]);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      /* ================= BODYWEIGHT ================= */
      const { data: bw } = await supabase
        .from("bodyweight_logs")
        .select("weight, logged_at")
        .eq("user_id", user.id)
        .order("logged_at", { ascending: true });

      if (bw && bw.length >= 2) {
        const start = bw[0];
        const latest = bw[bw.length - 1];
        setCurrentBW(latest.weight);
        setBwDelta((latest.weight - start.weight).toFixed(1));
      } else if (bw && bw.length === 1) {
        setCurrentBW(bw[0].weight);
        setBwDelta(null);
      }

      /* ================= MEASUREMENTS ================= */
      const { data: measurements } = await supabase
        .from("measurements")
        .select("name, value, date")
        .eq("user_id", user.id);

      const groupedMeasurements = {};
      (measurements || []).forEach((m) => {
        if (!groupedMeasurements[m.name]) groupedMeasurements[m.name] = [];
        groupedMeasurements[m.name].push(m);
      });

      const mStats = Object.entries(groupedMeasurements)
        .map(([name, list]) => {
          const sorted = [...list].sort(
            (a, b) => new Date(a.date) - new Date(b.date)
          );
          if (sorted.length < 2) return null;

          const start = sorted[0];
          const latest = sorted[sorted.length - 1];

          return {
            name,
            delta: (latest.value - start.value).toFixed(2),
          };
        })
        .filter(Boolean);

      setMeasurementStats(mStats);

      /* ================= PRs ================= */
      const { data: prs } = await supabase
        .from("PRs")
        .select("lift_name, weight, unit, date")
        .eq("user_id", user.id);

      const groupedPRs = {};
      (prs || []).forEach((p) => {
        if (!groupedPRs[p.lift_name]) groupedPRs[p.lift_name] = [];
        groupedPRs[p.lift_name].push(p);
      });

      const prAnalytics = Object.entries(groupedPRs).map(
        ([lift, list]) => {
          const best = [...list].sort(
            (a, b) => b.weight - a.weight
          )[0];

          return {
            lift,
            best: best.weight,
            unit: best.unit || "lbs",
            total: list.length,
          };
        }
      );

      setPrStats(prAnalytics);

      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div style={cardStyle}>
        <p style={{ opacity: 0.6 }}>Loading analytics…</p>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>📊 Progress Overview</h2>

      {/* BODYWEIGHT */}
      <Section title="Bodyweight">
        <p style={bigValue}>
          {currentBW !== null ? `${currentBW} lbs` : "—"}
        </p>
        {bwDelta && (
          <p style={deltaText}>
            {bwDelta > 0 ? "+" : ""}
            {bwDelta} lbs overall
          </p>
        )}
      </Section>

      {/* MEASUREMENTS */}
      {measurementStats.length > 0 && (
        <Section title="Measurements">
          {measurementStats.map((m) => (
            <Row key={m.name}>
              <span>{m.name}</span>
              <span style={deltaText}>
                {m.delta > 0 ? "+" : ""}
                {m.delta}
              </span>
            </Row>
          ))}
        </Section>
      )}

      {/* PRs */}
      {prStats.length > 0 && (
        <Section title="Personal Records">
          {prStats.map((pr) => (
            <Row key={pr.lift}>
              <span>{pr.lift}</span>
              <span style={{ opacity: 0.85 }}>
                {pr.best} {pr.unit} · {pr.total} PRs
              </span>
            </Row>
          ))}
        </Section>
      )}
    </div>
  );
}

/* ================= UI HELPERS ================= */

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={sectionTitle}>{title}</h3>
      {children}
    </div>
  );
}

function Row({ children }) {
  return (
    <div style={rowStyle}>
      {children}
    </div>
  );
}

/* ================= STYLES ================= */

const cardStyle = {
  background: "#0f0f0f",
  borderRadius: 16,
  padding: 18,
  border: "1px solid rgba(255,255,255,0.08)",
  marginBottom: 16,
};

const sectionTitle = {
  fontSize: 14,
  opacity: 0.85,
  marginBottom: 6,
};

const bigValue = {
  fontSize: 30,
  fontWeight: 800,
  margin: 0,
};

const deltaText = {
  opacity: 0.8,
  fontSize: 13,
};

const rowStyle = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 14,
  padding: "4px 0",
};
