// src/pages/PRTracker.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import {
  FaChevronDown,
  FaChevronUp,
  FaEdit,
  FaTrash,
} from "react-icons/fa";

/* --------------------------------------------------------
   DRAG WRAPPER
-------------------------------------------------------- */
function SortableItem({ id, handle, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    touchAction: "none",
  };

  // attach listeners ONLY to the drag handle
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {handle(listeners)}
      {children}
    </div>
  );
}

/* --------------------------------------------------------
   MAIN COMPONENT
-------------------------------------------------------- */
export default function PRTracker() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [groups, setGroups] = useState([]); // [{lift_name, entries}]
  const [expanded, setExpanded] = useState({});

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPR, setEditingPR] = useState(null);

  const [prLift, setPrLift] = useState("");
  const [prWeight, setPrWeight] = useState("");
  const [prReps, setPrReps] = useState("");
  const [prUnit, setPrUnit] = useState("lbs");
  const [prDate, setPrDate] = useState("");
  const [prNotes, setPrNotes] = useState("");

  // Delete modal
  const [deleteId, setDeleteId] = useState(null);

  // Drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  /* --------------------------------------------------------
     LOAD INITIAL
  -------------------------------------------------------- */
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user);

      if (user) {
        await loadPRs(user.id);
      }

      setLoading(false);
    })();
  }, []);

  /* --------------------------------------------------------
     FETCH PRs
  -------------------------------------------------------- */
  async function loadPRs(uid) {
    const { data, error } = await supabase
      .from("prs")
      .select("*")
      .eq("user_id", uid)
      .order("date", { ascending: false });

    if (error) {
      console.error("PR LOAD ERROR:", error.message);
      return;
    }

    // Group by lift
    const map = {};
    data.forEach((pr) => {
      if (!map[pr.lift_name]) map[pr.lift_name] = [];
      map[pr.lift_name].push(pr);
    });

    const grouped = Object.keys(map).map((lift) => ({
      lift_name: lift,
      entries: map[lift].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      ),
    }));

    setGroups(grouped);
  }

  /* --------------------------------------------------------
     EXPAND/COLLAPSE
  -------------------------------------------------------- */
  function toggleExpand(lift) {
    setExpanded((prev) => ({
      ...prev,
      [lift]: !prev[lift],
    }));
  }

  /* --------------------------------------------------------
     DRAG REORDER GROUPS
  -------------------------------------------------------- */
  function handleGroupDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = groups.findIndex((g) => g.lift_name === active.id);
    const newIndex = groups.findIndex((g) => g.lift_name === over.id);

    setGroups((prev) => arrayMove(prev, oldIndex, newIndex));
  }

  /* --------------------------------------------------------
     DRAG REORDER ENTRIES
  -------------------------------------------------------- */
  function handleEntryDragEnd(lift, event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const group = groups.find((g) => g.lift_name === lift);
    if (!group) return;

    const list = group.entries;
    const oldIndex = list.findIndex((e) => e.id === active.id);
    const newIndex = list.findIndex((e) => e.id === over.id);

    const newList = arrayMove(list, oldIndex, newIndex);

    setGroups((prev) =>
      prev.map((g) =>
        g.lift_name === lift ? { ...g, entries: newList } : g
      )
    );
  }

  /* --------------------------------------------------------
     OPEN ADD / EDIT
  -------------------------------------------------------- */
  function openAddModal() {
    setEditingPR(null);
    setPrLift("");
    setPrWeight("");
    setPrReps("");
    setPrUnit("lbs");
    setPrNotes("");
    setPrDate(new Date().toISOString().slice(0, 10));
    setModalOpen(true);
  }

  function openEditModal(pr) {
    setEditingPR(pr);
    setPrLift(pr.lift_name);
    setPrWeight(pr.weight);
    setPrReps(pr.reps ?? "");
    setPrUnit(pr.unit);
    setPrNotes(pr.notes || "");

    const iso =
      pr.date.includes("-")
        ? pr.date.slice(0, 10)
        : new Date(pr.date).toISOString().slice(0, 10);

    setPrDate(iso);

    setModalOpen(true);
  }

  /* --------------------------------------------------------
     SAVE PR
  -------------------------------------------------------- */
  async function savePR() {
    if (!user) return;
    if (!prLift || !prWeight) return;

    const isoDate = new Date(prDate).toISOString().slice(0, 10);

    const payload = {
      user_id: user.id,
      lift_name: prLift,
      weight: Number(prWeight),
      reps: prReps ? Number(prReps) : null,
      unit: prUnit,
      date: isoDate,
      notes: prNotes || null,
    };

    if (editingPR) {
      await supabase
        .from("prs")
        .update(payload)
        .eq("id", editingPR.id);
    } else {
      await supabase.from("prs").insert(payload);
    }

    setModalOpen(false);
    setEditingPR(null);
    await loadPRs(user.id);
  }

  /* --------------------------------------------------------
     DELETE
  -------------------------------------------------------- */
  async function confirmDelete() {
    await supabase.from("prs").delete().eq("id", deleteId);
    if (user) await loadPRs(user.id);

    setDeleteId(null);
  }

  /* --------------------------------------------------------
     RENDER
  -------------------------------------------------------- */
  return (
    <div
      style={{
        padding: "20px 16px 90px",
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      <h1
        style={{
          fontSize: 22,
          fontWeight: 700,
          marginBottom: 16,
        }}
      >
        Personal Records
      </h1>

      <button
        onClick={openAddModal}
        style={addBtn}
      >
        + Add PR
      </button>

      {loading ? (
        <p style={{ opacity: 0.7 }}>Loading PRs...</p>
      ) : groups.length === 0 ? (
        <p style={{ opacity: 0.7 }}>No PRs yet. Add your first one.</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleGroupDragEnd}
        >
          <SortableContext
            items={groups.map((g) => g.lift_name)}
            strategy={verticalListSortingStrategy}
          >
            {groups.map((group) => {
              const lift = group.lift_name;
              const entries = group.entries;
              const expandedList = expanded[lift];
              const latest = entries[0];

              return (
                <SortableItem
                  key={lift}
                  id={lift}
                  handle={(listeners) => (
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        height: "100%",
                        width: "55%",
                        zIndex: 2,
                        cursor: "grab",
                        WebkitUserSelect: "none",
                        userSelect: "none",
                      }}
                      {...listeners}
                    />
                  )}
                >
                  <div
                    style={{
                      background: "#0f0f0f",
                      borderRadius: 12,
                      padding: 14,
                      paddingLeft: 18,
                      border: "1px solid rgba(255,255,255,0.08)",
                      marginBottom: 10,
                      position: "relative",
                    }}
                  >
                    {/* Header */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{ flex: 1 }}
                        onClick={() => toggleExpand(lift)}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontSize: 15,
                            fontWeight: 600,
                          }}
                        >
                          {lift}
                        </p>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 11,
                            opacity: 0.7,
                          }}
                        >
                          {latest.weight} {latest.unit}
                          {latest.reps ? ` × ${latest.reps}` : ""} —{" "}
                          {latest.date}
                        </p>
                      </div>

                      <FaEdit
                        style={editIcon}
                        onClick={() => openEditModal(latest)}
                      />

                      <FaTrash
                        style={trashIcon}
                        onClick={() => {
                          setDeleteId(latest.id);
                        }}
                      />

                      {expandedList ? (
                        <FaChevronUp style={chevronIcon} />
                      ) : (
                        <FaChevronDown style={chevronIcon} />
                      )}
                    </div>

                    {/* Expanded entries */}
                    {expandedList && (
                      <div style={{ marginTop: 10 }}>
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={(event) =>
                            handleEntryDragEnd(lift, event)
                          }
                        >
                          <SortableContext
                            items={entries.map((e) => e.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {entries.map((pr, index) => {
                              if (index === 0) return null;

                              return (
                                <SortableItem
                                  key={pr.id}
                                  id={pr.id}
                                  handle={(listeners) => (
                                    <div
                                      style={{
                                        position: "absolute",
                                        left: 0,
                                        top: 0,
                                        height: "100%",
                                        width: "55%",
                                        zIndex: 2,
                                        cursor: "grab",
                                        WebkitUserSelect: "none",
                                        userSelect: "none",
                                      }}
                                      {...listeners}
                                    />
                                  )}
                                >
                                  <div style={entryCard}>
                                    <div style={entryRow}>
                                      <div>
                                        <p style={entryWeight}>
                                          {pr.weight} {pr.unit}
                                          {pr.reps ? ` × ${pr.reps}` : ""}
                                        </p>

                                        <p style={entryDate}>{pr.date}</p>

                                        {pr.notes && (
                                          <p style={entryNotes}>
                                            {pr.notes}
                                          </p>
                                        )}
                                      </div>

                                      <FaEdit
                                        style={editIcon}
                                        onClick={() =>
                                          openEditModal(pr)
                                        }
                                      />

                                      <FaTrash
                                        style={trashIcon}
                                        onClick={() =>
                                          setDeleteId(pr.id)
                                        }
                                      />
                                    </div>
                                  </div>
                                </SortableItem>
                              );
                            })}
                          </SortableContext>
                        </DndContext>
                      </div>
                    )}
                  </div>
                </SortableItem>
              );
            })}
          </SortableContext>
        </DndContext>
      )}

      {/* ADD / EDIT MODAL */}
      {modalOpen && (
        <div style={modalBackdrop}>
          <div
            style={modalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0 }}>
              {editingPR ? "Edit PR" : "New PR"}
            </h2>

            <label style={labelStyle}>Lift Name</label>
            <input
              style={inputStyle}
              value={prLift}
              onChange={(e) => setPrLift(e.target.value)}
              placeholder="Bench Press, Squat, etc."
            />

            <label style={labelStyle}>Weight</label>
            <input
              type="number"
              style={inputStyle}
              value={prWeight}
              onChange={(e) => setPrWeight(e.target.value)}
            />

            <label style={labelStyle}>Reps</label>
            <input
              type="number"
              style={inputStyle}
              value={prReps}
              onChange={(e) => setPrReps(e.target.value)}
            />

            <label style={labelStyle}>Unit</label>
            <select
              style={inputStyle}
              value={prUnit}
              onChange={(e) => setPrUnit(e.target.value)}
            >
              <option value="lbs">lbs</option>
              <option value="kg">kg</option>
            </select>

            <label style={labelStyle}>Date</label>
            <input
              type="date"
              style={inputStyle}
              value={prDate}
              onChange={(e) => {
                const iso = new Date(e.target.value)
                  .toISOString()
                  .slice(0, 10);
                setPrDate(iso);
              }}
            />

            <label style={labelStyle}>Notes</label>
            <textarea
              style={{
                ...inputStyle,
                minHeight: 60,
              }}
              value={prNotes}
              onChange={(e) => setPrNotes(e.target.value)}
              placeholder="Optional notes..."
            />

            <button style={primaryBtn} onClick={savePR}>
              Save PR
            </button>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {deleteId && (
        <div style={modalBackdrop}>
          <div
            style={modalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, color: "#ff4d4d" }}>
              Delete PR?
            </h2>

            <p style={{ opacity: 0.7 }}>
              Are you sure you want to delete this PR?
            </p>

            <button
              style={{
                ...primaryBtn,
                background: "#ff4d4d",
                marginTop: 10,
              }}
              onClick={confirmDelete}
            >
              Delete
            </button>

            <button
              style={{
                ...primaryBtn,
                background: "#222",
                marginTop: 10,
              }}
              onClick={() => setDeleteId(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------
   STYLES
-------------------------------------------------------- */
const addBtn = {
  padding: "10px 20px",
  background: "#ff2f2f",
  borderRadius: 999,
  border: "none",
  fontSize: 14,
  fontWeight: 600,
  color: "white",
  marginBottom: 18,
  boxShadow: "0 0 14px rgba(255,47,47,0.35)",
};

const modalBackdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.7)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: 20,
  zIndex: 999,
};

const modalCard = {
  background: "#111",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  padding: 18,
  width: "100%",
  maxWidth: 420,
};

const inputStyle = {
  width: "100%",
  padding: 8,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "#000",
  color: "white",
  marginBottom: 10,
};

const labelStyle = {
  fontSize: 12,
  opacity: 0.85,
  marginBottom: 4,
};

const primaryBtn = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "none",
  background: "#ff2f2f",
  color: "white",
  fontWeight: 600,
  marginTop: 8,
};

const entryCard = {
  background: "#151515",
  borderRadius: 10,
  padding: 10,
  marginBottom: 8,
  border: "1px solid rgba(255,255,255,0.06)",
  position: "relative",
};

const entryRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const entryWeight = {
  margin: 0,
  fontSize: 14,
  fontWeight: 600,
};

const entryDate = {
  margin: 0,
  fontSize: 11,
  opacity: 0.7,
};

const entryNotes = {
  margin: 0,
  fontSize: 11,
  opacity: 0.5,
  fontStyle: "italic",
};

const editIcon = {
  fontSize: 14,
  cursor: "pointer",
};

const trashIcon = {
  fontSize: 14,
  cursor: "pointer",
  color: "#ff4d4d",
};

const chevronIcon = {
  marginLeft: 6,
  fontSize: 12,
};
