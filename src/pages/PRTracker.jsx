// src/pages/PRTracker.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

// dnd-kit
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

// icons
import { FaChevronDown, FaChevronUp, FaEdit, FaTrash } from "react-icons/fa";

/* --------------------------------------------
   SORTABLE ITEM — LEFT 40% DRAGS, RIGHT SCROLLS
--------------------------------------------- */
function SortableItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        position: "relative",
      }}
    >
      {/* DRAG HANDLE on LEFT 40% */}
      <div
        {...attributes}
        {...listeners}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "40%",
          height: "100%",
          zIndex: 5,
          touchAction: "none",
        }}
      />
      
      {/* CARD CONTENT (FULLY SCROLLABLE) */}
      {children}
    </div>
  );
}

/* --------------------------------------------
   MAIN PAGE
--------------------------------------------- */
export default function PRTracker() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  const [groups, setGroups] = useState([]); // [{ lift_name, entries }]
  const [expanded, setExpanded] = useState({});

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPR, setEditingPR] = useState(null);
  const [prLift, setPrLift] = useState("");
  const [prWeight, setPrWeight] = useState("");
  const [prReps, setPrReps] = useState("");
  const [prUnit, setPrUnit] = useState("lbs");
  const [prDate, setPrDate] = useState("");
  const [prNotes, setPrNotes] = useState("");

  // Delete confirm
  const [deleteId, setDeleteId] = useState(null);

  // Drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  /* --------------------------------------------
     LOAD USER & PRs
  --------------------------------------------- */
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user);
      if (user) await loadPRs(user.id);

      setLoading(false);
    })();
  }, []);

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

    const finalGroups = Object.keys(map).map((lift) => ({
      lift_name: lift,
      entries: map[lift].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      ),
    }));

    setGroups(finalGroups);
  }

  /* --------------------------------------------
     HANDLE DRAG ORDER OF LIFTS
  --------------------------------------------- */
  function handleGroupDrag(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = groups.findIndex((g) => g.lift_name === active.id);
    const newIdx = groups.findIndex((g) => g.lift_name === over.id);

    setGroups((prev) => arrayMove(prev, oldIdx, newIdx));
  }

  /* --------------------------------------------
     OPEN MODALS
  --------------------------------------------- */
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
    setPrNotes(pr.notes ?? "");

    const iso =
      pr.date.includes("-")
        ? pr.date.slice(0, 10)
        : new Date(pr.date).toISOString().slice(0, 10);

    setPrDate(iso);
    setModalOpen(true);
  }

  /* --------------------------------------------
     SAVE PR
  --------------------------------------------- */
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
      await supabase.from("prs").update(payload).eq("id", editingPR.id);
    } else {
      await supabase.from("prs").insert(payload);
    }

    await loadPRs(user.id);
    setModalOpen(false);
  }
  /* --------------------------------------------
     DELETE CONFIRM
  --------------------------------------------- */
  async function confirmDelete() {
    await supabase.from("prs").delete().eq("id", deleteId);

    if (user) await loadPRs(user.id);

    setDeleteId(null);
  }

  /* --------------------------------------------
     PAGE UI
  --------------------------------------------- */
  return (
    <div
      style={{
        padding: "20px 16px 90px",
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>
        Personal Records
      </h1>

      <button
        onClick={openAddModal}
        style={{
          padding: "10px 20px",
          background: "#ff2f2f",
          borderRadius: 999,
          border: "none",
          fontSize: 14,
          fontWeight: 600,
          color: "white",
          marginBottom: 18,
          boxShadow: "0 0 14px rgba(255,47,47,0.35)",
        }}
      >
        + Add PR
      </button>

      {loading ? (
        <p style={{ opacity: 0.7 }}>Loading...</p>
      ) : groups.length === 0 ? (
        <p style={{ opacity: 0.7 }}>No PRs yet.</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleGroupDrag}
        >
          <SortableContext
            items={groups.map((g) => g.lift_name)}
            strategy={verticalListSortingStrategy}
          >
            {groups.map((group) => {
              const lift = group.lift_name;
              const entries = group.entries;
              const latest = entries[0];
              const isOpen = expanded[lift];

              return (
                <SortableItem key={lift} id={lift}>
                  <div
                    style={{
                      background: "#0f0f0f",
                      borderRadius: 12,
                      padding: 14,
                      border: "1px solid rgba(255,255,255,0.08)",
                      marginBottom: 10,
                    }}
                  >
                    {/* HEADER */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      {/* LEFT = tap to expand, also drag area exists invisibly */}
                      <div
                        style={{
                          flex: 1,
                          maxWidth: "65%",
                          cursor: "pointer",
                          userSelect: "none",
                          WebkitUserSelect: "none",
                        }}
                        onClick={() =>
                          setExpanded((prev) => ({
                            ...prev,
                            [lift]: !prev[lift],
                          }))
                        }
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
                            fontSize: 12,
                            opacity: 0.7,
                          }}
                        >
                          {latest.weight} {latest.unit}
                          {latest.reps ? ` × ${latest.reps}` : ""} —{" "}
                          {latest.date}
                        </p>
                      </div>

                      {/* RIGHT SIDE = edit/delete (scrollable) */}
                      <FaEdit
                        style={{ fontSize: 14, cursor: "pointer" }}
                        onClick={() => openEditModal(latest)}
                      />
                      <FaTrash
                        style={{
                          fontSize: 14,
                          cursor: "pointer",
                          color: "#ff4d4d",
                          marginLeft: 10,
                        }}
                        onClick={() => setDeleteId(latest.id)}
                      />

                      {isOpen ? (
                        <FaChevronUp
                          style={{ marginLeft: 10, opacity: 0.7 }}
                        />
                      ) : (
                        <FaChevronDown
                          style={{ marginLeft: 10, opacity: 0.7 }}
                        />
                      )}
                    </div>

                    {/* HISTORY */}
                    {isOpen && (
                      <div style={{ marginTop: 10 }}>
                        {entries.slice(1).map((entry) => (
                          <div
                            key={entry.id}
                            style={{
                              background: "#151515",
                              borderRadius: 10,
                              padding: 10,
                              marginBottom: 8,
                              border: "1px solid rgba(255,255,255,0.06)",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <div>
                                <p
                                  style={{
                                    margin: 0,
                                    fontSize: 14,
                                    fontWeight: 600,
                                  }}
                                >
                                  {entry.weight} {entry.unit}
                                  {entry.reps ? ` × ${entry.reps}` : ""}
                                </p>

                                <p
                                  style={{
                                    margin: 0,
                                    fontSize: 11,
                                    opacity: 0.7,
                                  }}
                                >
                                  {entry.date}
                                </p>

                                {entry.notes && (
                                  <p
                                    style={{
                                      margin: 0,
                                      fontSize: 11,
                                      opacity: 0.5,
                                      fontStyle: "italic",
                                    }}
                                  >
                                    {entry.notes}
                                  </p>
                                )}
                              </div>

                              <div style={{ display: "flex", gap: 12 }}>
                                <FaEdit
                                  style={{
                                    fontSize: 13,
                                    cursor: "pointer",
                                  }}
                                  onClick={() => openEditModal(entry)}
                                />
                                <FaTrash
                                  style={{
                                    fontSize: 13,
                                    cursor: "pointer",
                                    color: "#ff4d4d",
                                  }}
                                  onClick={() => setDeleteId(entry.id)}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </SortableItem>
              );
            })}
          </SortableContext>
        </DndContext>
      )}

      {/* MODAL: ADD / EDIT PR */}
      {modalOpen && (
        <div style={modalBackdrop} onClick={() => setModalOpen(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>
              {editingPR ? "Edit PR" : "New PR"}
            </h2>

            <label style={labelStyle}>Lift</label>
            <input
              style={inputStyle}
              value={prLift}
              onChange={(e) => setPrLift(e.target.value)}
              placeholder="Bench Press, Squat…"
            />

            <label style={labelStyle}>Weight</label>
            <input
              type="number"
              style={inputStyle}
              value={prWeight}
              onChange={(e) => setPrWeight(e.target.value)}
            />

            <label style={labelStyle}>Reps (optional)</label>
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
              onChange={(e) =>
                setPrDate(new Date(e.target.value).toISOString().slice(0, 10))
              }
            />

            <label style={labelStyle}>Notes</label>
            <textarea
              style={{ ...inputStyle, minHeight: 60 }}
              value={prNotes}
              onChange={(e) => setPrNotes(e.target.value)}
            />

            <button
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 10,
                border: "none",
                background: "#ff2f2f",
                color: "white",
                fontWeight: 600,
                marginTop: 10,
              }}
              onClick={savePR}
            >
              Save PR
            </button>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {deleteId && (
        <div style={modalBackdrop} onClick={() => setDeleteId(null)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, color: "#ff4d4d" }}>
              Confirm Delete?
            </h2>

            <p style={{ opacity: 0.8, marginBottom: 16 }}>
              This action cannot be undone.
            </p>

            <button
              onClick={() => setDeleteId(null)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 10,
                background: "#333",
                border: "none",
                color: "white",
                marginBottom: 10,
              }}
            >
              Cancel
            </button>

            <button
              onClick={confirmDelete}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 10,
                background: "#ff2f2f",
                border: "none",
                color: "white",
                fontWeight: 600,
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------
   SHARED STYLES
--------------------------------------------- */
const modalBackdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.65)",
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
