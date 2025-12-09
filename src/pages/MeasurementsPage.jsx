// src/pages/MeasurementsPage.jsx
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

// API
import {
  getMeasurements,
  addMeasurement,
  updateMeasurement,
  deleteMeasurement,
} from "../api/measurements";

// Sortable wrapper — LEFT SIDE DRAG ZONE, RIGHT SIDE SCROLLABLE
function SortableItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: "relative",
  };

  return (
    <div ref={setNodeRef} style={style}>
      {/* LEFT 40% DRAG HANDLE */}
      <div
        {...attributes}
        {...listeners}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "40%",
          height: "100%",
          zIndex: 5,
          touchAction: "none",
          pointerEvents: "auto",
        }}
      />

      {/* RIGHT 60% SCROLL ZONE */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: "60%",
          height: "100%",
          zIndex: 1, // BELOW buttons, ABOVE background
          pointerEvents: "auto",
        }}
      />

      {children}
    </div>
  );
}

export default function MeasurementsPage() {
  const [loading, setLoading] = useState(true);

  const [groups, setGroups] = useState({});
  const [groupOrder, setGroupOrder] = useState([]);
  const [expanded, setExpanded] = useState({});

  // Modal (add/edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);

  const [mName, setMName] = useState("");
  const [mValue, setMValue] = useState("");
  const [mUnit, setMUnit] = useState("in");
  const [mDate, setMDate] = useState(new Date().toISOString().slice(0, 10));

  // Delete
  const [deleteId, setDeleteId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Load measurements
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const rows = await getMeasurements(user.id);
      const grouped = {};
      rows.forEach((m) => {
        if (!grouped[m.name]) grouped[m.name] = [];
        grouped[m.name].push(m);
      });

      for (const key of Object.keys(grouped)) {
        grouped[key].sort((a, b) => new Date(b.date) - new Date(a.date));
      }

      setGroups(grouped);
      setGroupOrder(Object.keys(grouped));
      setLoading(false);
    })();
  }, []);

  // Reorder groups
  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = groupOrder.indexOf(active.id);
    const newIndex = groupOrder.indexOf(over.id);

    setGroupOrder((prev) => arrayMove(prev, oldIndex, newIndex));
  }

  /* MODALS */
  function openNew() {
    setEditId(null);
    setMName("");
    setMValue("");
    setMUnit("in");
    setMDate(new Date().toISOString().slice(0, 10));
    setModalOpen(true);
  }

  function openEdit(entry) {
    setEditId(entry.id);
    setMName(entry.name);
    setMValue(entry.value);
    setMUnit(entry.unit);
    setMDate(entry.date);
    setModalOpen(true);
  }

  async function saveMeasurement() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    if (!mName || !mValue) return;

    if (editId) {
      await updateMeasurement({
        id: editId,
        name: mName,
        value: mValue,
        unit: mUnit,
        date: mDate,
      });
    } else {
      await addMeasurement({
        userId: user.id,
        name: mName,
        value: mValue,
        unit: mUnit,
        date: mDate,
      });
    }

    const rows = await getMeasurements(user.id);
    const grouped = {};
    rows.forEach((m) => {
      if (!grouped[m.name]) grouped[m.name] = [];
      grouped[m.name].push(m);
    });
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    setGroups(grouped);
    setGroupOrder(Object.keys(grouped));
    setModalOpen(false);
  }

  async function confirmDelete() {
    await deleteMeasurement(deleteId);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const rows = await getMeasurements(user.id);
    const grouped = {};
    rows.forEach((m) => {
      if (!grouped[m.name]) grouped[m.name] = [];
      grouped[m.name].push(m);
    });
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    setGroups(grouped);
    setGroupOrder(Object.keys(grouped));
    setDeleteId(null);
  }

  if (loading) return <p style={{ padding: 20, opacity: 0.7 }}>Loading…</p>;

  return (
    <div
      style={{
        padding: "20px 16px 90px",
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>
        Measurements
      </h1>

      <button
        onClick={openNew}
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
        + Add Measurement
      </button>

      {/* LIST */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={groupOrder}
          strategy={verticalListSortingStrategy}
        >
          {groupOrder.map((groupName) => {
            const list = groups[groupName] || [];
            const latest = list[0];
            const isOpen = expanded[groupName];

            return (
              <SortableItem key={groupName} id={groupName}>
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
                      position: "relative",
                      zIndex: 999, // ENSURE BUTTONS WORK
                    }}
                  >
                    {/* LEFT DRAG + EXPAND */}
                    <div
                      style={{
                        flexBasis: "40%",
                        cursor: "grab",
                        userSelect: "none",
                      }}
                      onClick={() =>
                        setExpanded((prev) => ({
                          ...prev,
                          [groupName]: !prev[groupName],
                        }))
                      }
                    >
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                        {groupName}
                      </p>
                      <p style={{ margin: 0, opacity: 0.7, fontSize: 12 }}>
                        {latest.value} {latest.unit} — {latest.date}
                      </p>
                    </div>

                    {/* RIGHT BUTTONS */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        position: "relative",
                        zIndex: 999,
                        pointerEvents: "auto",
                      }}
                    >
                      <FaEdit
                        style={{ cursor: "pointer" }}
                        onClick={() => openEdit(latest)}
                      />
                      <FaTrash
                        style={{ cursor: "pointer", color: "#ff4d4d" }}
                        onClick={() => setDeleteId(latest.id)}
                      />

                      {isOpen ? (
                        <FaChevronUp style={{ opacity: 0.7 }} />
                      ) : (
                        <FaChevronDown style={{ opacity: 0.7 }} />
                      )}
                    </div>
                  </div>

                  {/* HISTORY */}
                  {isOpen && (
                    <div style={{ marginTop: 10 }}>
                      {list.slice(1).map((entry) => (
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
                                {entry.value} {entry.unit}
                              </p>
                              <p
                                style={{ margin: 0, opacity: 0.7, fontSize: 11 }}
                              >
                                {entry.date}
                              </p>
                            </div>

                            <div style={{ display: "flex", gap: 12 }}>
                              <FaEdit
                                style={{ cursor: "pointer" }}
                                onClick={() => openEdit(entry)}
                              />
                              <FaTrash
                                style={{ cursor: "pointer", color: "#ff4d4d" }}
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

      {/* ADD/EDIT MODAL */}
      {modalOpen && (
        <div style={modalBackdrop} onClick={() => setModalOpen(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2>{editId ? "Edit Measurement" : "New Measurement"}</h2>

            <label style={labelStyle}>Name</label>
            <input
              style={inputStyle}
              value={mName}
              onChange={(e) => setMName(e.target.value)}
            />

            <label style={labelStyle}>Value</label>
            <input
              style={inputStyle}
              type="number"
              value={mValue}
              onChange={(e) => setMValue(e.target.value)}
            />

            <label style={labelStyle}>Unit</label>
            <select
              style={inputStyle}
              value={mUnit}
              onChange={(e) => setMUnit(e.target.value)}
            >
              <option value="in">in</option>
              <option value="cm">cm</option>
            </select>

            <label style={labelStyle}>Date</label>
            <input
              style={inputStyle}
              type="date"
              value={mDate}
              onChange={(e) => setMDate(e.target.value)}
            />

            <button
              style={{
                width: "100%",
                padding: 10,
                marginTop: 10,
                borderRadius: 10,
                border: "none",
                background: "#ff2f2f",
                color: "white",
                fontWeight: 600,
              }}
              onClick={saveMeasurement}
            >
              Save Measurement
            </button>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {deleteId && (
        <div style={modalBackdrop} onClick={() => setDeleteId(null)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: "#ff4d4d" }}>Confirm Delete?</h2>

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
