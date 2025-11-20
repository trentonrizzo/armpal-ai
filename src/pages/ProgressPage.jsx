import React, { useContext, useMemo, useState } from "react";
import { AppContext } from "../context/AppContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function ProgressPage() {
  const { prs } = useContext(AppContext);

  // Get unique lift names
  const liftNames = [...new Set(prs.map((p) => p.lift_name))];

  // Default lift = first one or empty
  const [selectedLift, setSelectedLift] = useState(
    liftNames.length ? liftNames[0] : ""
  );

  // Filter & sort PRs for selected lift
  const chartData = useMemo(() => {
    return prs
      .filter((p) => p.lift_name === selectedLift)
      .map((p) => ({
        date: p.date.split("T")[0], // yyyy-mm-dd
        weight: Number(p.weight),
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [prs, selectedLift]);

  return (
    <div className="text-white p-6">
      <h1 className="text-2xl font-bold text-red-500 mb-4">Progress Graph</h1>

      {/* LIFT PICKER */}
      {liftNames.length > 0 ? (
        <select
          value={selectedLift}
          onChange={(e) => setSelectedLift(e.target.value)}
          className="w-full p-3 rounded-lg bg-neutral-900 border border-neutral-700 mb-6"
        >
          {liftNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-gray-400">No PRs available to graph.</p>
      )}

      {/* GRAPH */}
      {chartData.length > 0 ? (
        <div className="w-full h-80 bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid stroke="#333" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#aaa" />
              <YAxis stroke="#aaa" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111",
                  border: "1px solid #444",
                  borderRadius: "10px",
                }}
                labelStyle={{ color: "#fff" }}
                itemStyle={{ color: "#fff" }}
              />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#ef4444"
                strokeWidth={3}
                dot={{ r: 5, fill: "#ef4444" }}
                activeDot={{ r: 7, fill: "#fff" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-gray-400 mt-4">
          Not enough data yet. Add more PRs.
        </p>
      )}
    </div>
  );
}
