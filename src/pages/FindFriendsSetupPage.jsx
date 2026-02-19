// Profile onboarding for Find Friends: display_name, age, location, interests, discoverable
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useToast } from "../components/ToastProvider";

const INTEREST_OPTIONS = [
  "Arm Wrestling",
  "Powerlifting",
  "Bodybuilding",
  "Gym",
  "Fitness",
  "Cardio",
];

const pageWrap = { padding: "20px 16px 100px", maxWidth: 480, margin: "0 auto" };
const title = { fontSize: 22, fontWeight: 800, color: "var(--text)", marginBottom: 8 };
const sub = { fontSize: 14, color: "var(--text-dim)", marginBottom: 20 };
const label = { display: "block", fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 6 };
const input = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 14px",
  marginBottom: 16,
  border: "1px solid var(--border)",
  borderRadius: 12,
  background: "var(--bg)",
  color: "var(--text)",
  fontSize: 16,
};
const row = { display: "flex", gap: 12, marginBottom: 16 };
const toggleWrap = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 };
const toggleLabel = { fontSize: 16, fontWeight: 600, color: "var(--text)" };
const toggle = { width: 48, height: 28, borderRadius: 14, border: "none", cursor: "pointer" };
const chipWrap = { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 };
const chip = {
  padding: "8px 14px",
  borderRadius: 999,
  border: "1px solid var(--border)",
  background: "var(--card-2)",
  color: "var(--text)",
  fontSize: 14,
  cursor: "pointer",
};
const chipActive = { borderColor: "var(--accent)", background: "var(--accent)", color: "var(--text)" };
const btnPrimary = {
  width: "100%",
  padding: 14,
  borderRadius: 12,
  border: "none",
  background: "var(--accent)",
  color: "var(--text)",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
};
const btnSecondary = {
  width: "100%",
  padding: 12,
  marginTop: 10,
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text-dim)",
  fontSize: 14,
  cursor: "pointer",
};

export default function FindFriendsSetupPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [age, setAge] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [customInterest, setCustomInterest] = useState("");
  const [discoverable, setDiscoverable] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!alive) return;
      const u = data?.user ?? null;
      setUser(u);
      if (!u?.id) {
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, age, city, state, country, discoverable")
        .eq("id", u.id)
        .single();
      if (!alive) return;
      if (profile) {
        setDisplayName(profile.display_name ?? "");
        setAge(profile.age != null ? String(profile.age) : "");
        setCity(profile.city ?? "");
        setState(profile.state ?? "");
        setCountry(profile.country ?? "");
        setDiscoverable(profile.discoverable ?? true);
      }
      const { data: interests } = await supabase
        .from("user_interests")
        .select("interest")
        .eq("user_id", u.id);
      if (!alive) return;
      setSelectedInterests((interests ?? []).map((r) => r.interest));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const toggleInterest = (name) => {
    setSelectedInterests((prev) =>
      prev.includes(name) ? prev.filter((i) => i !== name) : [...prev, name]
    );
  };

  const addCustom = () => {
    const t = (customInterest || "").trim();
    if (!t || selectedInterests.includes(t)) return;
    setSelectedInterests((prev) => [...prev, t]);
    setCustomInterest("");
  };

  const save = async () => {
    if (!user?.id || saving) return;
    setSaving(true);
    try {
      const ageNum = age.trim() ? parseInt(age, 10) : null;
      const payload = {
        display_name: (displayName || "").trim() || null,
        age: ageNum >= 0 && ageNum <= 150 ? ageNum : null,
        city: (city || "").trim() || null,
        state: (state || "").trim() || null,
        country: (country || "").trim() || null,
        discoverable: !!discoverable,
      };
      const { error: profileError } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", user.id);
      if (profileError) throw profileError;

      await supabase.from("user_interests").delete().eq("user_id", user.id);
      const interestsToInsert = [...selectedInterests].filter(Boolean);
      if (interestsToInsert.length > 0) {
        const { error: intError } = await supabase
          .from("user_interests")
          .insert(interestsToInsert.map((interest) => ({ user_id: user.id, interest })));
        if (intError) throw intError;
      }
      toast.success("Profile saved");
      navigate("/find-friends");
    } catch (e) {
      toast.error(e?.message || "Failed to save");
    }
    setSaving(false);
  };

  if (!user) {
    return (
      <div style={pageWrap}>
        <p style={sub}>Sign in to set up your Find Friends profile.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={pageWrap}>
        <p style={sub}>Loading…</p>
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      <button type="button" onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: "var(--text-dim)", fontSize: 14, marginBottom: 16, cursor: "pointer" }}>
        ← Back
      </button>
      <h1 style={title}>Find Friends Profile</h1>
      <p style={sub}>Help others find you by location and interests.</p>

      <label style={label}>Display name</label>
      <input
        type="text"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Your name"
        style={input}
      />

      <label style={label}>Age</label>
      <input
        type="number"
        min={1}
        max={150}
        value={age}
        onChange={(e) => setAge(e.target.value)}
        placeholder="Optional"
        style={input}
      />

      <label style={label}>City</label>
      <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" style={input} />

      <div style={row}>
        <div style={{ flex: 1 }}>
          <label style={label}>State</label>
          <input type="text" value={state} onChange={(e) => setState(e.target.value)} placeholder="State" style={{ ...input, marginBottom: 0 }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={label}>Country</label>
          <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" style={{ ...input, marginBottom: 0 }} />
        </div>
      </div>

      <label style={label}>Interests</label>
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
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          value={customInterest}
          onChange={(e) => setCustomInterest(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())}
          placeholder="Other (custom)"
          style={{ ...input, marginBottom: 0, flex: 1 }}
        />
        <button type="button" onClick={addCustom} style={{ ...btnPrimary, width: "auto", padding: "12px 16px" }}>
          Add
        </button>
      </div>
      <div style={chipWrap}>
        {selectedInterests.filter((i) => !INTEREST_OPTIONS.includes(i)).map((name) => (
          <button
            key={name}
            type="button"
            style={{ ...chip, ...chipActive }}
            onClick={() => toggleInterest(name)}
          >
            {name} ×
          </button>
        ))}
      </div>

      <div style={toggleWrap}>
        <span style={toggleLabel}>Discoverable</span>
        <button
          type="button"
          style={{
            ...toggle,
            background: discoverable ? "var(--accent)" : "var(--card-2)",
          }}
          onClick={() => setDiscoverable((v) => !v)}
          aria-label={discoverable ? "On" : "Off"}
        />
      </div>

      <button type="button" onClick={save} disabled={saving} style={btnPrimary}>
        {saving ? "Saving…" : "Save"}
      </button>
      <button type="button" onClick={() => navigate("/find-friends")} style={btnSecondary}>
        Skip to Find Friends
      </button>
    </div>
  );
}
