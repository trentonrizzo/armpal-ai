// Find Friends: filters + find_friends RPC + user cards (avatar, name, location, shared interests)
import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useToast } from "../components/ToastProvider";
import EmptyState from "../components/EmptyState";

const INTEREST_OPTIONS = [
  "Arm Wrestling",
  "Powerlifting",
  "Bodybuilding",
  "Gym",
  "Fitness",
  "Cardio",
];

const LOCATION_SCOPES = [
  { value: "local", label: "Local (city)" },
  { value: "state", label: "State" },
  { value: "country", label: "Country" },
  { value: "global", label: "Global" },
];

const pageWrap = { padding: "16px 16px 100px", maxWidth: 520, margin: "0 auto" };
const headerRow = { display: "flex", alignItems: "center", gap: 12, marginBottom: 20 };
const backBtn = { background: "none", border: "none", color: "var(--text-dim)", fontSize: 14, cursor: "pointer" };
const title = { fontSize: 22, fontWeight: 800, margin: 0, color: "var(--text)" };
const sectionTitle = { fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 8 };
const input = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  marginBottom: 12,
  border: "1px solid var(--border)",
  borderRadius: 10,
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: 14,
};
const select = { ...input, cursor: "pointer" };
const chipWrap = { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 };
const chip = {
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid var(--border)",
  background: "var(--card-2)",
  color: "var(--text)",
  fontSize: 12,
  cursor: "pointer",
};
const chipActive = { borderColor: "var(--accent)", background: "var(--accent)" };
const sliderWrap = { marginBottom: 16 };
const sliderLabel = { fontSize: 12, color: "var(--text-dim)", marginBottom: 4 };
const searchBtn = {
  width: "100%",
  padding: 14,
  borderRadius: 12,
  border: "none",
  background: "var(--accent)",
  color: "var(--text)",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
  marginBottom: 20,
};
const cardList = { listStyle: "none", margin: 0, padding: 0 };
const card = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: 14,
  marginBottom: 10,
  background: "var(--card-2)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  cursor: "pointer",
};
const avatar = { width: 52, height: 52, borderRadius: "50%", objectFit: "cover", flexShrink: 0 };
const avatarFallback = {
  width: 52,
  height: 52,
  borderRadius: "50%",
  background: "#222",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 20,
  fontWeight: "bold",
  color: "#fff",
  flexShrink: 0,
};
const cardBody = { flex: 1, minWidth: 0 };
const cardName = { fontSize: 16, fontWeight: 700, color: "var(--text)", display: "block" };
const cardLocation = { fontSize: 13, color: "var(--text-dim)", display: "block", marginTop: 2 };
const cardInterests = { fontSize: 12, color: "var(--text-dim)", marginTop: 6 };
const viewBtn = {
  padding: "8px 14px",
  borderRadius: 10,
  border: "none",
  background: "var(--accent)",
  color: "var(--text)",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  flexShrink: 0,
};

export default function FindFriendsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);

  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(99);
  const [locationScope, setLocationScope] = useState("global");
  const [selectedInterests, setSelectedInterests] = useState([]);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (alive) setUser(data?.user ?? null);
      if (alive) setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const toggleInterest = (name) => {
    setSelectedInterests((prev) =>
      prev.includes(name) ? prev.filter((i) => i !== name) : [...prev, name]
    );
  };

  const search = useCallback(async () => {
    if (!user?.id) return;
    setSearching(true);
    setResults([]);
    try {
      const { data, error } = await supabase.rpc("find_friends", {
        p_age_min: ageMin,
        p_age_max: ageMax,
        p_location_scope: locationScope,
        p_interests: selectedInterests.length > 0 ? selectedInterests : null,
      });
      if (error) throw error;
      setResults(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e?.message || "Search failed");
      setResults([]);
    }
    setSearching(false);
  }, [user?.id, ageMin, ageMax, locationScope, selectedInterests, toast]);

  if (!user) {
    return (
      <div style={pageWrap}>
        <p style={{ color: "var(--text-dim)" }}>Sign in to find friends.</p>
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      <div style={headerRow}>
        <button type="button" onClick={() => navigate(-1)} style={backBtn}>
          ← Back
        </button>
        <h1 style={title}>Find Friends</h1>
      </div>

      <button
        type="button"
        onClick={() => navigate("/find-friends/setup")}
        style={{
          display: "block",
          width: "100%",
          padding: 12,
          marginBottom: 20,
          borderRadius: 12,
          border: "1px solid var(--border)",
          background: "var(--card-2)",
          color: "var(--text)",
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        ✏️ Edit my Find Friends profile
      </button>

      <div style={sectionTitle}>Age range</div>
      <div style={sliderWrap}>
        <div style={sliderLabel}>
          {ageMin} – {ageMax}
        </div>
        <input
          type="range"
          min={13}
          max={99}
          value={ageMin}
          onChange={(e) => setAgeMin(Number(e.target.value))}
          style={{ width: "48%", marginRight: "2%" }}
        />
        <input
          type="range"
          min={13}
          max={99}
          value={ageMax}
          onChange={(e) => setAgeMax(Number(e.target.value))}
          style={{ width: "48%" }}
        />
      </div>

      <div style={sectionTitle}>Location</div>
      <select
        value={locationScope}
        onChange={(e) => setLocationScope(e.target.value)}
        style={select}
      >
        {LOCATION_SCOPES.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <div style={sectionTitle}>Interests (optional)</div>
      <div style={chipWrap}>
        {INTEREST_OPTIONS.map((name) => (
          <button
            key={name}
            type="button"
            style={{ ...chip, ...(selectedInterests.includes(name) ? chipActive : {}) }}
            onClick={() => toggleInterest(name)}
          >
            {name}
          </button>
        ))}
      </div>

      <button type="button" onClick={search} disabled={searching} style={searchBtn}>
        {searching ? "Searching…" : "Search"}
      </button>

      {results.length === 0 && !searching && (
        <EmptyState
          icon="👋"
          message="Set filters and tap Search to find people. Or edit your profile and turn on Discoverable."
        />
      )}
      {searching && <p style={{ color: "var(--text-dim)", textAlign: "center" }}>Searching…</p>}
      {results.length > 0 && !searching && (
        <ul style={cardList}>
          {results.map((r) => (
            <li
              key={r.id}
              style={card}
              onClick={() => navigate(`/friend/${r.id}`)}
            >
              {r.avatar_url ? (
                <img src={r.avatar_url} alt="" style={avatar} />
              ) : (
                <div style={avatarFallback}>
                  {(r.display_name || r.username || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div style={cardBody}>
                <span style={cardName}>{r.display_name || r.username || "User"}</span>
                <span style={cardLocation}>
                  {[r.city, r.state, r.country].filter(Boolean).join(", ") || "—"}
                </span>
                {r.shared_interests?.length > 0 && (
                  <span style={cardInterests}>
                    Shared: {(r.shared_interests || []).join(", ")}
                  </span>
                )}
              </div>
              <button
                type="button"
                style={viewBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/friend/${r.id}`);
                }}
              >
                View
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
