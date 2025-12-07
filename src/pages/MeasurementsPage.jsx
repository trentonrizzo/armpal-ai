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

// Sortable wrapper with HANDLER ZONE
function SortableItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    touchAction: "none",
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners })}
    </div>
  );
}

export default function MeasurementsPage() {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState({});
  const [groupOrder, setGroupOrder] = useState([]);
  const [expanded, setExpanded] = useState({});

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);

  const [mName, setMName] = useState("");
  const [mValue, setMValue] = useState("");
  const [mUnit, setMUnit] = useState("in");
  const [mDate, setMDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  // Delete confirm
  const [deleteId, setDeleteId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Load
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

  /** MODAL HANDLERS */
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

  if (loading)
    return <p style={{ padding: 20, opacity: 0.7 }}>Loading…</p>;

  return (
    <div style={{ padding: "20px 16px 90px", maxWidth: 900, margin: "0 auto" }}>
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
                {({ attributes, listeners }) => (
                  <div
                    style={{
                      background: "#0f0f0f",
                      borderRadius: 12,
                      padding: 14,
                      border: "1px solid rgba(255,255,255,0.08)",
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      {/* DRAGGABLE zone (50% width) */}
                      <div
                        style={{
                          width: "50%",
                          userSelect: "none",
                          WebkitUserSelect: "none",
                          cursor: "grab",
                        }}
                        {...attributes}
                        {...listeners}
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
                        <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>
                          {latest.value} {latest.unit} — {latest.date}
                        </p>
                      </div>

                      {/* icons */}
                      <FaEdit
                        style={{ fontSize: 14, cursor: "pointer" }}
                        onClick={() => openEdit(latest)}
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
                        <FaChevronUp style={{ marginLeft: 10, opacity: 0.7 }} />
                      ) : (
                        <FaChevronDown
                          style={{ marginLeft: 10, opacity: 0.7 }}
                        />
                      )}
                    </div>

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
                                  style={{
                                    margin: 0,
                                    fontSize: 11,
                                    opacity: 0.7,
                                  }}
                                >
                                  {entry.date}
                                </p>
                              </div>

                              <div style={{ display: "flex", gap: 12 }}>
                                <FaEdit
                                  style={{ fontSize: 13, cursor: "pointer" }}
                                  onClick={() => openEdit(entry)}
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
                )}
              </SortableItem>
            );
          })}
        </SortableContext>
      </DndContext>
    </div>
  );
}
