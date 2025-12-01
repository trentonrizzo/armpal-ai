import React, { useContext, useState, useMemo } from "react";
import { AppContext } from "../context/AppContext";
import { Link } from "react-router-dom";

// HAPTICS (safe for mobile PWA)
const vibrate = (ms = 15) => {
  if (navigator.vibrate) navigator.vibrate(ms);
};

export default function PRsPage() {
  const { prs, removePR, createPR } = useContext(AppContext);

  const [expandedGroups, setExpandedGroups] = useState({});
  const [sortMode, setSortMode] = useState(
    localStorage.getItem("pr-sort-mode") || "recent"
  );

  const toggleSortMode = () => {
    const newMode = sortMode === "recent" ? "alpha" : "recent";
    setSortMode(newMode);
    localStorage.setItem("pr-sort-mode", newMode);
  };

  // GROUP PRs BY LIFT NAME
  const grouped = useMemo(() => {
    const groups = {};

    prs.forEach((p) => {
      if (!groups[p.lift_name]) groups[p.lift_name] = [];
      groups[p.lift_name].push(p);
    });

    return groups;
  }, [prs]);

  // SORT GROUPS
  const sortedGroupKeys = useMemo(() => {
    const keys = Object.keys(grouped);

    if (sortMode === "alpha") {
      return keys.sort((a, b) => a.localeCompare(b));
    }

    // RECENT FIRST
    return keys.sort((a, b) => {
      const newestA = grouped[a].sort(
        (x, y) => new Date(y.date) - new Date(x.date)
      )[0];
      const newestB = grouped[b].sort(
        (x, y) => new Date(y.date) - new Date(x.date)
      )[0];
      return new Date(newestB.date) - new Date(newestA.date);
    });
  }, [grouped, sortMode]);

  // TOGGLE GROUP OPEN/CLOSED
  const toggleGroup = (liftName) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [liftName]: !prev[liftName],
    }));
  };

  return (
    <div className="p-5 text-white min-h-screen">

      {/* Title */}
      <h1 className="text-3xl font-bold text-red-500 mb-4">Personal Records</h1>

      {/* Strength Calculator button */}
      <Link to="/strength-calculator">
        <button className="w-full mb-6 py-3 bg-red-600 hover:bg-red-700 rounded-xl font-bold text-white shadow shadow-red-500/40">
          🔥 1RM & Strength Calculator
        </button>
      </Link>

      {/* SORT TOGGLE */}
      <div className="mb-4 flex justify-end">
        <button
          onClick={toggleSortMode}
          className="px-4 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm"
        >
          Sort:{" "}
          {sortMode === "recent" ? "Recent ▼" : "A–Z ▼"}
        </button>
      </div>

      {/* NO PRS */}
      {prs.length === 0 && (
        <p className="text-neutral-400">No PRs yet. Add one using the calculator.</p>
      )}

      {/* GROUPED PRs */}
      <div className="space-y-4">
        {sortedGroupKeys.map((lift) => {
          const isOpen = expandedGroups[lift];
          const items = grouped[lift].sort(
            (a, b) => new Date(b.date) - new Date(a.date)
          );

          // Newest PR in group
          const newest = items[0];

          return (
            <div
              key={lift}
              className="glass-card border border-neutral-800 rounded-xl"
            >
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(lift)}
                className="w-full flex justify-between items-center py-3"
              >
                <div>
                  <p className="text-xl font-bold text-red-400">{lift}</p>
                  <p className="text-neutral-400 text-sm">
                    Latest: {newest.weight} {newest.unit} — {newest.date}
                  </p>
                </div>

                {/* Chevron */}
                <span
                  className={`transition-transform text-xl ${
                    isOpen ? "rotate-180" : ""
                  }`}
                >
                  ▼
                </span>
              </button>

              {/* Collapsible Body */}
              {isOpen && (
                <div className="mt-3 space-y-3">
                  {items.map((p) => (
                    <PRSwipeItem key={p.id} pr={p} removePR={removePR} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------
   SWIPE-TO-DELETE COMPONENT
--------------------------------*/
function PRSwipeItem({ pr, removePR }) {
  const [offset, setOffset] = useState(0);
  const [startX, setStartX] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleStart = (e) => {
    setStartX(e.touches ? e.touches[0].clientX : e.clientX);
  };

  const handleMove = (e) => {
    if (startX === null) return;

    const currentX = e.touches ? e.touches[0].clientX : e.clientX;
    const diff = currentX - startX;

    if (diff < 0) {
      setOffset(Math.max(diff, -90));
    }
  };

  const handleEnd = () => {
    if (offset <= -70) {
      vibrate(25);
      setOffset(-90);
      setConfirmDelete(true);
    } else {
      setOffset(0);
      setConfirmDelete(false);
    }
    setStartX(null);
  };

  return (
    <div className="relative overflow-hidden">
      {/* DELETE BUTTON */}
      <button
        onClick={() => {
          vibrate(40);
          removePR(pr.id);
        }}
        className="absolute right-0 top-0 h-full w-[90px] bg-red-700 text-white font-bold flex items-center justify-center"
      >
        Delete
      </button>

      {/* SWIPE CARD */}
      <div
        className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl transition-all"
        style={{ transform: `translateX(${offset}px)` }}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      >
        <p className="text-lg font-bold text-red-400">{pr.lift_name}</p>
        <p className="text-neutral-300 text-sm">
          {pr.weight} {pr.unit} — {pr.date}
        </p>
      </div>
    </div>
  );
}
