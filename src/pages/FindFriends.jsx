// Find Friends: filters (age, distance, interests) + list from profiles
import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import EmptyState from "../components/EmptyState";

const INTERESTS = [
  "Arm Wrestling",
  "Powerlifting",
  "Bodybuilding",
  "Fitness",
  "Gym Bro",
  "General Training",
  "Other",
];

const DISTANCE_OPTIONS = [
  { value: "local", label: "Local" },
  { value: "state", label: "State" },
  { value: "anywhere", label: "Anywhere" },
];

const pageWrap = {
  padding: "16px 16px 100px",
  maxWidth: 520,
  margin: "0 auto",
  background: "var(--bg)",
  minHeight: "100vh",
  color: "var(--text)",
};
const headerRow = { display: "flex", alignItems: "center", gap: 12, marginBottom: 20 };
const backBtn = { background: "none", border: "none", color: "var(--text-dim)", fontSize: 14, cursor: "pointer" };
const title = { fontSize: 22, fontWeight: 800, margin: 0, color: "var(--text)" };
const filterBar = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: 16,
  marginBottom: 20,
};
const filterLabel = { fontSize: 12, fontWeight: 700, color: "var(--text-dim)", marginBottom: 6, display: "block" };
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
const chipWrap = { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 };
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
  marginTop: 8,
};
const listWrap = { marginTop: 16 };
const card = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: 14,
  marginBottom: 10,
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 16,
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
const badgeWrap = { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 };
const badge = {
  padding: "4px 10px",
  borderRadius: 999,
  background: "var(--card-2)",
  border: "1px solid var(--border)",
  fontSize: 11,
  color: "var(--text-dim)",
};

export default function FindFriends() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [myProfile, setMyProfile] = useState(null);

  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(60);
  const [distance, setDistance] = useState("anywhere");
  const [selectedInterests, setSelectedInterests] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!alive) return;
      const u = data?.user ?? null;
      setUser(u);
      if (u?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("city, state")
          .eq("id", u.id)
          .single();
        if (alive) setMyProfile(profile || null);
      }
      if (alive) setLoading(false);
    })();
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
      let query = supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, age, city, state, interests")
        .neq("id", user.id);

      if (ageMin != null) query = query.gte("age", ageMin);
      if (ageMax != null) query = query.lte("age", ageMax);

      const myCity = myProfile?.city?.trim();
      const myState = myProfile?.state?.trim();
      if (distance === "local" && myCity) {
        query = query.eq("city", myCity);
      } else if (distance === "state" && myState) {
        query = query.eq("state", myState);
      }

      if (selectedInterests.length > 0) {
        query = query.overlaps("interests", selectedInterests);
      }

      const { data, error } = await query.order("display_name");
      if (error) throw error;
      setResults(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Find friends error", e);
      setResults([]);
    }
    setSearching(false);
  }, [user?.id, ageMin, ageMax, distance, myProfile, selectedInterests]);

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

      <div style={filterBar}>
        <div style={filterLabel}>Age range</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <input
            type="number"
            min={18}
            max={99}
            value={ageMin}
            onChange={(e) => setAgeMin(Number(e.target.value) || 18)}
            style={{ ...input, width: "80px", marginBottom: 0 }}
          />
          <span style={{ color: "var(--text-dim)" }}>–</span>
          <input
            type="number"
            min={18}
            max={99}
            value={ageMax}
            onChange={(e) => setAgeMax(Number(e.target.value) || 60)}
            style={{ ...input, width: "80px", marginBottom: 0 }}
          />
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>60+</span>
        </div>

        <div style={filterLabel}>Distance</div>
        <select value={distance} onChange={(e) => setDistance(e.target.value)} style={select}>
          {DISTANCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <div style={filterLabel}>Interests</div>
        <div style={chipWrap}>
          {INTERESTS.map((name) => (
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
      </div>

      <div style={listWrap}>
        {results.length === 0 && !searching && (
          <EmptyState
            icon="👋"
            message="Set filters and tap Search. Add age, city & interests on your Profile to be discoverable."
          />
        )}
        {searching && (
          <p style={{ color: "var(--text-dim)", textAlign: "center" }}>Searching…</p>
        )}
        {results.length > 0 && !searching && (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
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
                    {[r.city, r.state].filter(Boolean).join(", ") || "—"}
                  </span>
                  {r.interests?.length > 0 && (
                    <div style={badgeWrap}>
                      {(r.interests || []).slice(0, 5).map((i) => (
                        <span key={i} style={badge}>
                          {i}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
