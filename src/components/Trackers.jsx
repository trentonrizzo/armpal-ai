import React, { useContext, useState, useEffect } from "react";
import { AppContext } from "../context/AppContext";
import { checkUsageCap, FREE_CAP } from "../utils/usageLimits";
import EmptyState from "./EmptyState";

const Trackers = () => {
  const {
    measurements,
    setMeasurements,
    prs,
    setPRs,
    user,
  } = useContext(AppContext);

  const [activeTab, setActiveTab] = useState("measurements");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("in");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [cap, setCap] = useState(null);

  const limitType = activeTab === "measurements" ? "measurements" : "prs";
  const list = activeTab === "measurements" ? measurements : prs;

  useEffect(() => {
    if (!user?.id) return;
    checkUsageCap(user.id, limitType).then(setCap);
  }, [user?.id, limitType, list?.length]);

  const handleAdd = async (e) => {
    e.preventDefault();

    if (!label || !value) {
      alert("Please fill in all fields!");
      return;
    }
    if (!user?.id) return;

    const currentList = activeTab === "measurements" ? measurements : prs;
    const setList = activeTab === "measurements" ? setMeasurements : setPRs;

    const limitCheck = await checkUsageCap(user.id, limitType);
    if (!limitCheck.allowed) {
      setShowUpgrade(true);
      return;
    }

    const newEntry = {
      id: Date.now(),
      label,
      value,
      unit,
      date: new Date().toLocaleDateString(),
    };

    setList([...currentList, newEntry]);
    setLabel("");
    setValue("");
  };

  const handleDelete = (id) => {
    if (activeTab === "measurements") {
      setMeasurements(measurements.filter((m) => m.id !== id));
    } else {
      setPRs(prs.filter((p) => p.id !== id));
    }
  };

  const maxSlots = cap?.limit ?? FREE_CAP;
  const freeRemaining = maxSlots - list.length;
  const lockedSlots =
    cap && !cap.isPro
      ? Array.from({ length: freeRemaining < 0 ? 0 : freeRemaining })
      : [];

  return (
    <div style={{ padding: "2rem", maxWidth: "500px", margin: "auto" }}>
      <h2>ArmPal Tracker</h2>

      {/* Tabs */}
      <div style={{ display: "flex", justifyContent: "center", gap: "1rem" }}>
        <button
          onClick={() => {
            setActiveTab("measurements");
            setUnit("in");
          }}
          style={{
            background: activeTab === "measurements" ? "red" : "gray",
            color: "white",
            border: "none",
            borderRadius: "6px",
            padding: "0.5rem 1rem",
          }}
        >
          Measurements
        </button>

        <button
          onClick={() => {
            setActiveTab("prs");
            setUnit("lbs");
          }}
          style={{
            background: activeTab === "prs" ? "red" : "gray",
            color: "white",
            border: "none",
            borderRadius: "6px",
            padding: "0.5rem 1rem",
          }}
        >
          PRs
        </button>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} style={{ marginTop: "1rem" }}>
        <input
          type="text"
          placeholder={
            activeTab === "measurements"
              ? "Body part (e.g. Bicep)"
              : "Lift (e.g. Bench)"
          }
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          style={{ marginRight: "0.5rem" }}
        />
        <input
          type="number"
          placeholder={activeTab === "measurements" ? "Size" : "Weight"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{ marginRight: "0.5rem" }}
        />
        <select value={unit} onChange={(e) => setUnit(e.target.value)}>
          {activeTab === "measurements" ? (
            <>
              <option value="in">in</option>
              <option value="cm">cm</option>
            </>
          ) : (
            <>
              <option value="lbs">lbs</option>
              <option value="kg">kg</option>
            </>
          )}
        </select>
        <button type="submit" style={{ marginLeft: "0.5rem" }}>
          Add
        </button>
      </form>

      {/* List */}
      <ul style={{ marginTop: "1rem", listStyle: "none", padding: 0 }}>
        {list.length === 0 ? (
          <li><EmptyState icon="📋" message="No entries yet — add one above." /></li>
        ) : (
          list.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.label}</strong> — {entry.value} {entry.unit} (
              {entry.date})
              <button
                onClick={() => handleDelete(entry.id)}
                style={{
                  marginLeft: "10px",
                  color: "white",
                  background: "red",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                ❌
              </button>
            </li>
          ))
        )}

        {/* Locked slots */}
        {lockedSlots.map((_, index) => (
          <li
            key={`locked-${index}`}
            style={{
              opacity: 0.5,
              background: "#222",
              color: "#888",
              marginTop: "0.5rem",
              padding: "0.3rem",
              borderRadius: "4px",
            }}
          >
            🔒 PRO Slot
          </li>
        ))}
      </ul>

      {/* Upgrade popup */}
      {showUpgrade && (
        <div
          style={{
            background: "rgba(0,0,0,0.8)",
            color: "white",
            padding: "1rem",
            borderRadius: "8px",
            marginTop: "1rem",
            textAlign: "center",
          }}
        >
          <h3>Upgrade to ArmPal PRO</h3>
          <p>Unlock unlimited Measurements & PRs!</p>
          <button
            onClick={() => setShowUpgrade(false)}
            style={{
              background: "red",
              border: "none",
              color: "white",
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};

export default Trackers;
