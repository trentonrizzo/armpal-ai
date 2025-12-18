// src/components/StrengthCalculatorInline.jsx
import React, { useState, useContext, useMemo } from "react";
import { AppContext } from "../context/AppContext";
import BottomSheet from "./BottomSheet";

export default function StrengthCalculatorInline() {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [liftName, setLiftName] = useState("");
  const [oneRM, setOneRM] = useState(null);

  // Bottom Sheet
  const [showPRSheet, setShowPRSheet] = useState(false);
  const [prLiftName, setPrLiftName] = useState("");
  const [prDate, setPrDate] = useState(new Date().toISOString().slice(0, 10));

  const { prs, createPR } = useContext(AppContext);

  // 1RM Formula (FIXED — exact exception)
  const calculate1RM = () => {
    if (!weight || !reps) return;

    const w = Number(weight);
    const r = Number(reps);

    // ✅ HARD EXCEPTION: true 1RM input
    if (r === 1) {
      setOneRM(Math.round(w));
      return;
    }

    const rm = Math.round(w * (1 + r / 30));
    setOneRM(rm);
  };

  // PR Matching
  const matchedPR = useMemo(() => {
    if (!liftName) return null;
    const target = liftName.toLowerCase().trim();

    return prs.find((p) => {
      const name = p.lift_name.toLowerCase();
      const targetWords = target.split(" ");
      const nameWords = name.split(" ");

      return (
        targetWords.some((w) => nameWords.includes(w)) ||
        nameWords.some((w) => targetWords.includes(w))
      );
    });
  }, [liftName, prs]);

  const savePR = async () => {
    if (!prLiftName) {
      alert("Enter a lift name.");
      return;
    }
    await createPR(prLiftName, oneRM, "lbs", prDate);
    setShowPRSheet(false);
  };

  const percentages = [95, 90, 85, 80, 75, 70, 65, 60, 55, 50];
  const repTable = Array.from({ length: 15 }, (_, i) => i + 1);

  const glass =
    "backdrop-blur-xl bg-white/5 border border-white/10 shadow-xl rounded-2xl";

  return (
    <div className={`${glass} p-5`}>
      <h2 className="text-2xl font-bold text-red-400 mb-4">
        Strength Calculator
      </h2>

      {/* INPUTS */}
      <div className="space-y-4">
        <input
          className="w-full p-3 rounded-xl bg-neutral-900 border border-neutral-700"
          placeholder="Lift Name (Bench, Squat...)"
          value={liftName}
          onChange={(e) => setLiftName(e.target.value)}
        />

        <input
          className="w-full p-3 rounded-xl bg-neutral-900 border border-neutral-700"
          type="number"
          placeholder="Weight"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />

        <input
          className="w-full p-3 rounded-xl bg-neutral-900 border border-neutral-700"
          type="number"
          placeholder="Reps"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
        />

        <button
          onClick={calculate1RM}
          className="w-full py-3 bg-red-600 hover:bg-red-700 font-bold rounded-xl shadow shadow-red-500/40"
        >
          Calculate 1RM
        </button>
      </div>

      {/* RESULTS */}
      {oneRM && (
        <>
          <div className="mt-6">
            <h3 className="text-xl font-bold text-red-400 mb-1">
              Estimated 1RM
            </h3>
            <p className="text-4xl font-bold text-center">{oneRM} lbs</p>
          </div>

          {/* PR Comparison */}
          <div className="mt-6 p-4 rounded-xl bg-neutral-950/70 border border-neutral-700">
            {matchedPR ? (
              <>
                <p className="text-lg text-red-300 font-semibold mb-2">
                  PR Comparison
                </p>
                <p className="text-neutral-300">
                  Current PR:{" "}
                  <span className="text-white font-bold">
                    {matchedPR.weight} lbs
                  </span>
                </p>
                <p className="text-neutral-300">
                  Your 1RM:{" "}
                  <span className="text-white font-bold">{oneRM} lbs</span>
                </p>

                <p className="mt-1 font-bold">
                  Difference:{" "}
                  <span
                    className={
                      oneRM > matchedPR.weight
                        ? "text-green-400"
                        : "text-red-400"
                    }
                  >
                    {oneRM - matchedPR.weight} lbs
                  </span>
                </p>

                {oneRM > matchedPR.weight && (
                  <div className="mt-3 py-2 px-3 bg-red-600 rounded-lg text-center font-bold shadow shadow-red-500/40">
                    🔥 NEW PR POSSIBLE!
                  </div>
                )}
              </>
            ) : (
              <p className="text-neutral-400">No PR found for this lift.</p>
            )}
          </div>

          {/* Save PR */}
          <button
            onClick={() => {
              setPrLiftName(liftName);
              setShowPRSheet(true);
            }}
            className="w-full mt-4 py-2 bg-neutral-800 border border-red-700 hover:bg-neutral-700 rounded-xl"
          >
            Save as PR
          </button>

          {/* Percentages */}
          <div className="mt-8">
            <h3 className="text-lg font-bold text-red-400 mb-4">
              Percentages
            </h3>

            <div className="space-y-3">
              {percentages.map((p) => (
                <div
                  key={p}
                  className="flex justify-between p-3 rounded-xl bg-neutral-900/80 border border-neutral-800"
                >
                  <span>{p}%</span>
                  <span className="font-bold">
                    {Math.round(oneRM * (p / 100))} lbs
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Rep Potential */}
          <div className="mt-8">
            <h3 className="text-lg font-bold text-red-400 mb-4">
              Rep Potential
            </h3>

            <div className="space-y-3">
              {repTable.map((r) => (
                <div
                  key={r}
                  className="flex justify-between p-3 rounded-xl bg-neutral-900/80 border border-neutral-800"
                >
                  <span>{r} reps</span>
                  <span className="font-bold">
                    {Math.round(oneRM / (1 + r / 30))} lbs
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Bottom Sheet Save PR */}
      <BottomSheet open={showPRSheet} onClose={() => setShowPRSheet(false)}>
        <h2 className="text-xl font-bold text-white mb-4">Save PR</h2>

        <div className="space-y-3">
          <input
            className="w-full p-3 bg-neutral-900 border border-neutral-700 rounded-xl"
            value={prLiftName}
            onChange={(e) => setPrLiftName(e.target.value)}
          />

          <input
            className="w-full p-3 bg-neutral-900 border border-neutral-700 rounded-xl"
            type="number"
            value={oneRM}
            readOnly
          />

          <input
            className="w-full p-3 bg-neutral-900 border border-neutral-700 rounded-xl"
            type="text"
            value="lbs"
            readOnly
          />

          <input
            className="w-full p-3 bg-neutral-900 border border-neutral-700 rounded-xl"
            type="date"
            value={prDate}
            onChange={(e) => setPrDate(e.target.value)}
          />

          <div className="flex justify-between mt-4">
            <button
              onClick={() => setShowPRSheet(false)}
              className="px-4 py-2 bg-neutral-700 rounded-xl"
            >
              Cancel
            </button>

            <button
              onClick={savePR}
              className="px-4 py-2 bg-red-600 rounded-xl"
            >
              Save PR
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
