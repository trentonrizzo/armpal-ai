// src/pages/PRTracker.jsx
import React, {
  useContext,
  useMemo,
  useState
} from "react";
import { AppContext } from "../context/AppContext";
import { FaEdit, FaTrashAlt, FaArrowsAlt } from "react-icons/fa";
import { IoChevronDown, IoChevronUp } from "react-icons/io5";

export default function PRTracker() {
  const {
    prs,
    createPR,
    removePR,
    editPR,
    reorderPRs,
  } = useContext(AppContext);

  // Add PR form
  const [lift, setLift] = useState("");
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState("lbs");
  const [date, setDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [reps, setReps] = useState("");
  const [notes, setNotes] = useState("");

  // Sorting + drag
  const [sortMode, setSortMode] = useState("custom"); // custom | alpha | newest | heaviest
  const [draggedId, setDraggedId] = useState(null);

  // Edit modal
  const [editingPR, setEditingPR] = useState(null);
  const [editLift, setEditLift] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editUnit, setEditUnit] = useState("lbs");
  const [editDate, setEditDate] = useState("");
  const [editReps, setEditReps] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Collapsed categories
  const [collapsed, setCollapsed] = useState({});

  // -----------------------------
  // Categorize lifts (auto)
  // -----------------------------
  function categorizeLift(name) {
    if (!name) return "Other";

    const n = name.toLowerCase();

    if (
      n.includes("bench") ||
      n.includes("press") ||
      n.includes("chest")
    ) {
      return "Bench / Press";
    }

    if (
      n.includes("curl") ||
      n.includes("bicep") ||
      n.includes("biceps") ||
      n.includes("hammer")
    ) {
      return "Curls / Biceps";
    }

    if (
      n.includes("deadlift") ||
      n.includes("rdl") ||
      n.includes("hinge")
    ) {
      return "Deadlifts / Posterior";
    }

    if (
      n.includes("squat") ||
      n.includes("leg press") ||
      n.includes("hack") ||
      n.includes("quad")
    ) {
      return "Squats / Legs";
    }

    if (
      n.includes("row") ||
      n.includes("lat") ||
      n.includes("pulldown") ||
      n.includes("pull-up") ||
      n.includes("pull up")
    ) {
      return "Back / Rows / Lats";
    }

    if (
      n.includes("wrist") ||
      n.includes("forearm") ||
      n.includes("grip") ||
      n.includes("armwrestling") ||
      n.includes("arm wrestling") ||
      n.includes("hook") ||
      n.includes("toproll") ||
      n.includes("top roll")
    ) {
      return "Grip / Forearm / Armwrestling";
    }

    return "Other Lifts";
  }

  const categoryOrder = [
    "Bench / Press",
    "Curls / Biceps",
    "Squats / Legs",
    "Deadlifts / Posterior",
    "Back / Rows / Lats",
    "Grip / Forearm / Armwrestling",
    "Other Lifts",
  ];

  // -----------------------------
  // Sort PRs based on mode
  // -----------------------------
  const sortedPRs = useMemo(() => {
    let list = [...(prs || [])];

    if (sortMode === "alpha") {
      list.sort((a, b) =>
        (a.lift_name || "").localeCompare(b.lift_name || "")
      );
    } else if (sortMode === "newest") {
      list.sort((a, b) =>
        new Date(b.date || "1970-01-01") -
        new Date(a.date || "1970-01-01")
      );
    } else if (sortMode === "heaviest") {
      list.sort((a, b) =>
        (b.weight || 0) - (a.weight || 0)
      );
    } else {
      // custom -> follow order_index (then newest)
      list.sort((a, b) => {
        const ao = a.order_index ?? 0;
        const bo = b.order_index ?? 0;
        if (ao !== bo) return ao - bo;
        return (
          new Date(b.date || "1970-01-01") -
          new Date(a.date || "1970-01-01")
        );
      });
    }

    return list;
  }, [prs, sortMode]);

  // -----------------------------
  // Group by category
  // -----------------------------
  const grouped = useMemo(() => {
    const map = {};
    for (const pr of sortedPRs) {
      const cat = categorizeLift(pr.lift_name);
      if (!map[cat]) map[cat] = [];
      map[cat].push(pr);
    }
    return map;
  }, [sortedPRs]);

  const orderedCategories = useMemo(() => {
    const existing = Object.keys(grouped);
    const inOrder = categoryOrder.filter((c) =>
      existing.includes(c)
    );
    const leftovers = existing.filter(
      (c) => !categoryOrder.includes(c)
    );
    return [...inOrder, ...leftovers];
  }, [grouped]);

  // -----------------------------
  // Add PR
  // -----------------------------
  async function handleSaveNew() {
    if (!lift.trim() || !weight.trim()) {
      alert("Enter lift name and weight.");
      return;
    }

    await createPR(
      lift.trim(),
      Number(weight),
      unit,
      date
    );

    setLift("");
    setWeight("");
    setUnit("lbs");
    setDate(new Date().toISOString().split("T")[0]);
    setReps("");
    setNotes("");
  }

  // -----------------------------
  // Drag + Drop (custom only)
  // -----------------------------
  function handleDragStart(id) {
    if (sortMode !== "custom") return;
    setDraggedId(id);
  }

  function handleDragOver(e) {
    if (sortMode !== "custom") return;
    e.preventDefault();
  }

  async function handleDrop(targetId, categoryName) {
    if (sortMode !== "custom") {
      setDraggedId(null);
      return;
    }

    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    const list = [...sortedPRs];

    const fromIndex = list.findIndex(
      (p) => p.id === draggedId
    );
    const toIndex = list.findIndex(
      (p) => p.id === targetId
    );

    if (fromIndex === -1 || toIndex === -1) {
      setDraggedId(null);
      return;
    }

    // Force drag only within same category for now
    const fromCat = categorizeLift(
      list[fromIndex].lift_name
    );
    const toCat = categorizeLift(
      list[toIndex].lift_name
    );
    if (fromCat !== toCat || fromCat !== categoryName) {
      setDraggedId(null);
      return;
    }

    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);

    const updates = list.map((pr, index) => ({
      id: pr.id,
      order_index: index,
    }));

    await reorderPRs(updates);
    setDraggedId(null);
  }

  // -----------------------------
  // Edit modal
  // -----------------------------
  function openEditModal(pr) {
    setEditingPR(pr);
    setEditLift(pr.lift_name || "");
    setEditWeight(pr.weight ?? "");
    setEditUnit(pr.unit || "lbs");
    setEditDate(pr.date || new Date().toISOString().split("T")[0]);
    setEditReps(pr.reps ?? "");
    setEditNotes(pr.notes || "");
  }

  function closeEditModal() {
    setEditingPR(null);
    setEditLift("");
    setEditWeight("");
    setEditUnit("lbs");
    setEditDate("");
    setEditReps("");
    setEditNotes("");
  }

  async function handleSaveEdit() {
    if (!editingPR) return;

    if (!editLift.trim() || String(editWeight).trim() === "") {
      alert("Lift and weight are required.");
      return;
    }

    await editPR(editingPR.id, {
      lift_name: editLift.trim(),
      weight: Number(editWeight),
      unit: editUnit,
      date: editDate,
      reps: editReps ? Number(editReps) : null,
      notes: editNotes || null,
    });

    closeEditModal();
  }

  // -----------------------------
  // Collapse toggle
  // -----------------------------
  function toggleCollapse(cat) {
    setCollapsed((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  }

  return (
    <div className="p-5 pb-24 min-h-screen bg-black text-white">
      {/* Header / Title */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-red-500">
            Personal Records
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Track, sort, edit, and organize all your PRs.
          </p>
        </div>

        {/* Sort dropdown */}
        <div className="glass-card px-3 py-2 rounded-xl border border-neutral-700 text-xs">
          <label className="block text-neutral-400 mb-1">
            Sort
          </label>
          <select
            className="bg-black text-sm rounded-lg border border-neutral-700 px-2 py-1"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
          >
            <option value="custom">Custom (Your Order)</option>
            <option value="alpha">A → Z</option>
            <option value="newest">Newest</option>
            <option value="heaviest">Heaviest</option>
          </select>
        </div>
      </div>

      {/* Info line */}
      <p className="text-xs text-neutral-500 mb-4">
        Drag using the arrows icon to reorder <span className="font-semibold text-neutral-300">within a group</span> (Custom mode only).
      </p>

      {/* Add PR Card */}
      <div className="glass-card mb-8 p-5 rounded-2xl border border-neutral-800">
        <h2 className="text-lg font-semibold text-red-400 mb-4">
          Add New PR
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <input
            type="text"
            className="neon-input"
            placeholder="Lift name (Bench, Curl...)"
            value={lift}
            onChange={(e) => setLift(e.target.value)}
          />
          <input
            type="number"
            className="neon-input"
            placeholder="Weight"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <select
            className="neon-input"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            <option value="lbs">lbs</option>
            <option value="kg">kg</option>
          </select>

          <input
            type="date"
            className="neon-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          <input
            type="number"
            className="neon-input"
            placeholder="Reps (optional)"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
          />

          <input
            type="text"
            className="neon-input"
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <button
          onClick={handleSaveNew}
          className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-xl font-bold shadow shadow-red-500/40"
        >
          Save PR
        </button>
      </div>

      {/* PR Groups */}
      {sortedPRs.length === 0 ? (
        <p className="text-neutral-500">
          You don&apos;t have any PRs yet. Add your first one above.
        </p>
      ) : (
        <div className="space-y-4">
          {orderedCategories.map((cat) => {
            const items = grouped[cat] || [];
            if (!items.length) return null;

            const isCollapsed = collapsed[cat];

            return (
              <div
                key={cat}
                className="glass-card rounded-2xl border border-neutral-800 overflow-hidden"
              >
                {/* Category Header */}
                <button
                  onClick={() => toggleCollapse(cat)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-neutral-950/70 border-b border-neutral-800"
                >
                  <div>
                    <p className="text-xs uppercase tracking-wide text-red-400">
                      PR Group
                    </p>
                    <h3 className="text-lg font-semibold">
                      {cat}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-400">
                    <span>{items.length} PR{items.length !== 1 ? "s" : ""}</span>
                    {isCollapsed ? (
                      <IoChevronDown size={18} />
                    ) : (
                      <IoChevronUp size={18} />
                    )}
                  </div>
                </button>

                {/* Items */}
                {!isCollapsed && (
                  <ul className="divide-y divide-neutral-800">
                    {items.map((pr) => (
                      <li
                        key={pr.id}
                        draggable={sortMode === "custom"}
                        onDragStart={() => handleDragStart(pr.id)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(pr.id, cat)}
                        className={`
                          flex items-center justify-between gap-3 px-4 py-3
                          ${draggedId === pr.id ? "bg-neutral-900/80" : "bg-neutral-900/40"}
                        `}
                      >
                        <div className="flex items-center gap-3">
                          {/* drag handle */}
                          {sortMode === "custom" && (
                            <div className="cursor-grab active:cursor-grabbing text-neutral-500">
                              <FaArrowsAlt size={16} />
                            </div>
                          )}

                          <div>
                            <p className="font-semibold text-sm">
                              {pr.lift_name}
                            </p>
                            <p className="text-xs text-neutral-400 mt-0.5">
                              {pr.date} · {pr.weight} {pr.unit || "lbs"}
                              {pr.reps ? ` · ${pr.reps} reps` : ""}
                            </p>
                            {pr.notes && (
                              <p className="text-xs text-neutral-500 mt-0.5">
                                {pr.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(pr)}
                            className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs flex items-center gap-1"
                          >
                            <FaEdit size={12} />
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm("Delete this PR?")) {
                                removePR(pr.id);
                              }
                            }}
                            className="px-2 py-1 rounded-lg bg-red-700 hover:bg-red-800 text-xs flex items-center gap-1"
                          >
                            <FaTrashAlt size={12} />
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editingPR && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-red-400 mb-4">
              Edit PR
            </h2>

            <div className="space-y-3 mb-4">
              <div>
                <label className="neon-label mb-1 block">
                  Lift Name
                </label>
                <input
                  className="neon-input w-full"
                  value={editLift}
                  onChange={(e) => setEditLift(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="neon-label mb-1 block">
                    Weight
                  </label>
                  <input
                    type="number"
                    className="neon-input w-full"
                    value={editWeight}
                    onChange={(e) => setEditWeight(e.target.value)}
                  />
                </div>
                <div>
                  <label className="neon-label mb-1 block">
                    Unit
                  </label>
                  <select
                    className="neon-input w-full"
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                  >
                    <option value="lbs">lbs</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="neon-label mb-1 block">
                  Date
                </label>
                <input
                  type="date"
                  className="neon-input w-full"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="neon-label mb-1 block">
                    Reps (optional)
                  </label>
                  <input
                    type="number"
                    className="neon-input w-full"
                    value={editReps}
                    onChange={(e) => setEditReps(e.target.value)}
                  />
                </div>
                <div>
                  <label className="neon-label mb-1 block">
                    Notes (optional)
                  </label>
                  <input
                    type="text"
                    className="neon-input w-full"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button
                className="px-4 py-2 rounded-xl bg-neutral-700 hover:bg-neutral-600 text-sm"
                onClick={closeEditModal}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-sm font-semibold"
                onClick={handleSaveEdit}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
