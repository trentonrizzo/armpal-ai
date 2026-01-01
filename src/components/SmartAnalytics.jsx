import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function SmartAnalytics() {
  const [loading, setLoading] = useState(true);
  const [currentBW, setCurrentBW] = useState(null);
  const [bwDelta, setBwDelta] = useState(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

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

      setLoading(false);
    })();
  }, []);

  return (
    <div style={cardStyle}>
      <h2 style={{ marginTop: 0 }}>📊 Progress Overview</h2>

      {loading ? (
        <p style={{ opacity: 0.6 }}>Loading bodyweight…</p>
      ) : (
        <div>
          <p style={label}>Bodyweight</p>
          <p style={bigValue}>
            {currentBW !== null ? `${currentBW} lbs` : "—"}
          </p>
          {bwDelta !== null && (
            <p style={deltaText}>
              {bwDelta > 0 ? "+" : ""}
              {bwDelta} lbs overall
            </p>
          )}
        </div>
      )}
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

const label = {
  fontSize: 13,
  opacity: 0.75,
  marginBottom: 4,
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
