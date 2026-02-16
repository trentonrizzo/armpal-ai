import React, { useContext, useState } from "react";
import { AppContext } from "../context/AppContext";
import EmptyState from "./EmptyState";

const Measurements = () => {
  const { measurements, setMeasurements } = useContext(AppContext);
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("in");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!label || !value) {
      alert("Please fill in all fields!");
      return;
    }

    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleDateString(),
      label: label.trim(),
      value: parseFloat(value),
      unit,
    };

    setMeasurements([...measurements, newEntry]);

    // clear fields
    setLabel("");
    setValue("");
    setUnit("in");
  };

  const handleDelete = (id) => {
    setMeasurements(measurements.filter((m) => m.id !== id));
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: "500px", margin: "auto" }}>
      <h2>Measurements</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Label: </label>
          <input
            type="text"
            placeholder="e.g. Left Bicep"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        <div>
          <label>Value: </label>
          <input
            type="number"
            step="0.1"
            placeholder="e.g. 16.5"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>

        <div>
          <label>Unit: </label>
          <select value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="in">in</option>
            <option value="cm">cm</option>
          </select>
        </div>

        <button type="submit" style={{ marginTop: "1rem" }}>
          Add Measurement
        </button>
      </form>

      <h3 style={{ marginTop: "2rem" }}>History</h3>
      {measurements.length === 0 ? (
        <EmptyState icon="📏" message="No measurements yet — add one above." />
      ) : (
        <ul>
          {measurements.map((m) => (
            <li key={m.id}>
              <strong>{m.label}</strong>: {m.value} {m.unit} — {m.date}
              <button
                onClick={() => handleDelete(m.id)}
                style={{ marginLeft: "10px" }}
              >
                ❌
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Measurements;
