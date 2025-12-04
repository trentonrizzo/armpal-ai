import React, { useContext, useMemo, useState } from "react";
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

  // Add PR form inputs
  const [lift, setLift] = useState("");
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState("lbs");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [reps, setReps] = useState("");
  const [notes, setNotes] = useState("");

  // Sorting mode + custom groups toggle
  const [sortMode, setSortMode] = useState("custom");
  const [draggedPR, setDraggedPR] = useState(null);

  // Editing modal
  const [editingPR, setEditingPR] = useState(null);
  const [editLift, setEditLift] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editUnit, setEditUnit] = useState("lbs");
  const [editDate, setEditDate] = useState("");
  const [editReps, setEditReps] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Group collapse states
  const [collapsed, setCollapsed] = useState({});
  const [customGrouping, setCustomGrouping] = useState(false);

  // CATEGORY SYSTEM (OPTIONAL)
  function autoCategory(name) {
    if (!name) return "Other";

    const n = name.toLowerCase();
    if (n.includes("bench") || n.includes("press")) return "Bench / Press";
    if (n.includes("curl") || n.includes("bicep")) return "Curls / Biceps";
    if (n.includes("deadlift") || n.includes("rdl")) return "Deadlifts";
    if (n.includes("squat") || n.includes("leg")) return "Squats";
    if (n.includes("row") || n.includes("lat") || n.includes("pull")) return "Back / Lats";
    if (n.includes("wrist") || n.includes("forearm") || n.includes("grip")) return "Grip / Arm Wrestling";
    return "Other";
  }

  const defaultCatOrder = [
    "Bench / Press",
    "Curls / Biceps",
    "Squats",
    "Deadlifts",
    "Back / Lats",
    "Grip / Arm Wrestling",
    "Other",
  ];

  // SORTING
  const sortedPRs = useMemo(() => {
    let list = [...prs];
    if (sortMode === "alpha") {
      list.sort((a, b) => (a.lift_name || "").localeCompare(b.lift_name || ""));
    } else if (sortMode === "newest") {
      list.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (sortMode === "heaviest") {
      list.sort((a, b) => (b.weight || 0) - (a.weight || 0));
    } else {
      // CUSTOM ORDER INDEX
      list.sort((a, b) => {
        const ao = a.order_index ?? 0;
        const bo = b.order_index ?? 0;
        return ao - bo;
      });
    }
    return list;
  }, [prs, sortMode]);

  // GROUPING (OPTIONAL)
  const grouped = useMemo(() => {
    const map = {};
    for (const pr of sortedPRs) {
      const cat = customGrouping ? pr.group_name || "Ungrouped" : autoCategory(pr.lift_name);
      if (!map[cat]) map[cat] = [];
      map[cat].push(pr);
    }
    return map;
  }, [sortedPRs, customGrouping]);

  const orderedCategories = useMemo(() => {
    const found = Object.keys(grouped);
    if (!customGrouping) {
      const inOrder = defaultCatOrder.filter((c) => found.includes(c));
      const leftovers = found.filter((c) => !defaultCatOrder.includes(c));
      return [...inOrder, ...leftovers];
    }
    return found;
  }, [grouped, customGrouping]);

  // SAVE NEW PR
  async function handleSaveNew() {
    if (!lift.trim() || !weight.trim()) return alert("Enter lift and weight");

    await createPR(
      lift.trim(),
      Number(weight),
      unit,
      date,
      reps ? Number(reps) : null,
      notes
    );

    setLift("");
    setWeight("");
    setReps("");
    setNotes("");
    setUnit("lbs");
    setDate(new Date().toISOString().split("T")[0]);
  }

  // DRAG + DROP
  function handleDragStart(id) {
    if (sortMode !== "custom") return;
    setDraggedPR(id);
  }

  function handleDragOver(e) {
    if (sortMode !== "custom") return;
    e.preventDefault();
  }

  async function handleDrop(targetId) {
    if (sortMode !== "custom") return;
    if (!draggedPR) return;

    const list = [...sortedPRs];
    const fromIndex = list.findIndex((x) => x.id === draggedPR);
    const toIndex = list.findIndex((x) => x.id === targetId);

    if (fromIndex === -1 || toIndex === -1) return;

    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);

    const updates = list.map((pr, index) => ({ id: pr.id, order_index: index }));
    await reorderPRs(updates);

    setDraggedPR(null);
  }

  // EDIT MODAL OPEN
  function openEdit(pr) {
    setEditingPR(pr);
    setEditLift(pr.lift_name);
    setEditWeight(pr.weight);
    setEditUnit(pr.unit);
    setEditDate(pr.date);
    setEditReps(pr.reps);
    setEditNotes(pr.notes);
  }

  function closeEdit() {
    setEditingPR(null);
  }

  async function saveEdit() {
    if (!editLift.trim() || !editWeight.toString().trim()) {
      return alert("Lift & Weight required.");
    }

    await editPR(editingPR.id, {
      lift_name: editLift.trim(),
      weight: Number(editWeight),
      unit: editUnit,
      date: editDate,
      reps: editReps ? Number(editReps) : null,
      notes: editNotes || null,
    });

    closeEdit();
  }

  function toggleCollapse(cat) {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }

  return (
    <div className="p-5 pb-24 min-h-screen bg-black text-white">

      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-red-500 tracking-wide">
          Personal Records
        </h1>

        {/* SORT MENU */}
        <select
          className="bg-neutral-900 text-sm border border-neutral-700 rounded-xl px-3 py-2 shadow-md shadow-red-500/20"
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value)}
        >
          <option value="custom">Custom order</option>
          <option value="alpha">A → Z</option>
          <option value="newest">Newest</option>
          <option value="heaviest">Heaviest</option>
        </select>
      </div>

      {/* NEW PR CARD */}
      <div className="glass-card mb-8 p-5 rounded-2xl border border-neutral-800 shadow-xl shadow-red-500/20">
        <h2 className="text-lg font-semibold text-red-400 mb-3">
          Add PR
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <input className="neon-input" placeholder="Lift" value={lift} onChange={(e) => setLift(e.target.value)} />
          <input className="neon-input" placeholder="Weight" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <select className="neon-input" value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="lbs">lbs</option>
            <option value="kg">kg</option>
          </select>

          <input className="neon-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />

          <input className="neon-input" placeholder="Reps" type="number" value={reps} onChange={(e) => setReps(e.target.value)} />

          <input className="neon-input" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <button
          onClick={handleSaveNew}
          className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-xl font-bold shadow shadow-red-500/40"
        >
          Save PR
        </button>
      </div>
      {/* PR LIST */}
      {sortedPRs.length === 0 ? (
        <p className="text-neutral-500 text-sm">No PRs yet.</p>
      ) : (
        <div className="space-y-4">
          {orderedCategories.map((cat) => {
            const items = grouped[cat] || [];
            if (!items.length) return null;

            const isCollapsed = collapsed[cat];

            return (
              <div key={cat} className="glass-card rounded-2xl border border-neutral-800 shadow-md shadow-red-500/10 overflow-hidden">
                
                {/* CATEGORY HEADER */}
                <button
                  onClick={() => toggleCollapse(cat)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-neutral-950/70 border-b border-neutral-800"
                >
                  <h3 className="text-lg font-semibold text-red-400">
                    {cat}
                  </h3>

                  {isCollapsed ? (
                    <IoChevronDown size={18} className="text-neutral-400" />
                  ) : (
                    <IoChevronUp size={18} className="text-neutral-400" />
                  )}
                </button>

                {/* ITEMS */}
                {!isCollapsed && (
                  <ul className="divide-y divide-neutral-800">
                    {items.map((pr) => (
                      <li
                        key={pr.id}
                        draggable={sortMode === "custom"}
                        onDragStart={() => handleDragStart(pr.id)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(pr.id)}
                        className={`flex items-center justify-between px-4 py-3 ${
                          draggedPR === pr.id
                            ? "bg-neutral-900/80"
                            : "bg-neutral-900/40"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* DRAG HANDLE */}
                          {sortMode === "custom" && (
                            <div className="cursor-grab text-neutral-500 active:cursor-grabbing">
                              <FaArrowsAlt size={16} />
                            </div>
                          )}

                          {/* PR INFO */}
                          <div>
                            <p className="font-semibold text-sm">
                              {pr.lift_name}
                            </p>

                            <p className="text-xs text-neutral-400">
                              {pr.date} • {pr.weight} {pr.unit}
                              {pr.reps ? ` • ${pr.reps} reps` : ""}
                            </p>

                            {pr.notes && (
                              <p className="text-xs text-neutral-500">
                                {pr.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* ACTIONS */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(pr)}
                            className="bg-neutral-800 hover:bg-neutral-700 px-2 py-1 rounded text-xs flex items-center gap-1"
                          >
                            <FaEdit size={12} /> Edit
                          </button>

                          <button
                            onClick={() => {
                              if (window.confirm("Delete this PR?")) {
                                removePR(pr.id);
                              }
                            }}
                            className="bg-red-700 hover:bg-red-800 px-2 py-1 rounded text-xs flex items-center gap-1"
                          >
                            <FaTrashAlt size={12} /> Delete
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

      {/* EDIT MODAL */}
      {editingPR && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-md shadow-xl shadow-red-500/20">
            <h2 className="text-xl font-bold text-red-400 mb-4">Edit PR</h2>

            <div className="space-y-3 mb-4">
              <div>
                <label className="neon-label mb-1 block">Lift</label>
                <input className="neon-input w-full" value={editLift} onChange={(e) => setEditLift(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="neon-label mb-1 block">Weight</label>
                  <input className="neon-input w-full" type="number" value={editWeight} onChange={(e) => setEditWeight(e.target.value)} />
                </div>
                <div>
                  <label className="neon-label mb-1 block">Unit</label>
                  <select className="neon-input w-full" value={editUnit} onChange={(e) => setEditUnit(e.target.value)}>
                    <option value="lbs">lbs</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="neon-label mb-1 block">Date</label>
                <input className="neon-input w-full" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="neon-label mb-1 block">Reps</label>
                  <input className="neon-input w-full" type="number" value={editReps} onChange={(e) => setEditReps(e.target.value)} />
                </div>
                <div>
                  <label className="neon-label mb-1 block">Notes</label>
                  <input className="neon-input w-full" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button className="px-4 py-2 rounded-xl bg-neutral-700 hover:bg-neutral-600" onClick={closeEdit}>Cancel</button>
              <button className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 font-semibold" onClick={saveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
