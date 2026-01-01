// UPDATED MeasurementsPage.jsx with editable Bodyweight entries
// FULL FILE REPLACEMENT

// NOTE: This version adds:
// - Editable bodyweight history
// - Confirm delete modal (same UX as measurements)
// - Edit-in-place via modal
// - Preserves append-first logic (no silent overwrites)

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
import {
  FaChevronDown,
  FaChevronUp,
  FaEdit,
  FaTrash,
} from "react-icons/fa";

// API
import {
  getMeasurements,
  addMeasurement,
  updateMeasurement,
  deleteMeasurement,
} from "../api/measurements";

/* -------------------------------------------------------
   SORTABLE ITEM — LEFT 40% = DRAG HANDLE
------------------------------------------------------- */
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
        }}
      />
      {children}
    </div>
  );
}

export default function MeasurementsPage() {
  const [loading, setLoading] = useState(true);

  /* ---------------- MEASUREMENTS ---------------- */
  const [groups, setGroups] = useState({});
  const [groupOrder, setGroupOrder] = useState([]);
  const [expanded, setExpanded] = useState({});

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);

  const [mName, setMName] = useState("");
  const [mValue, setMValue] = useState("");
  const [mUnit, setMUnit] = useState("in");
  const [mDate, setMDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [deleteId, setDeleteId] = useState(null);

  /* ---------------- BODYWEIGHT ---------------- */
  const [bwLoading, setBwLoading] = useState(true);
  const [bwHistory, setBwHistory] = useState([]);
  const [bwInput, setBwInput] = useState("");

  // bodyweight edit/delete
  const [bwEdit, setBwEdit] = useState(null); // full row
  const [bwDelete, setBwDelete] = useState(null); // id

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  /* ---------------- LOAD DATA ---------------- */
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // measurements
      const rows = await getMeasurements(user.id);
      const grouped = {};
      rows.forEach((m) => {
        if (!grouped[m.name]) grouped[m.name] = [];
        grouped[m.name].push(m);
      });
      for (const key of Object.keys(grouped)) {
        grouped[key].sort(
          (a, b) => new Date(b.date) - new Date(a.date)
        );
      }
      setGroups(grouped);
      setGroupOrder(Object.keys(grouped));

      // bodyweight
      const { data: bw } = await supabase
        .from("bodyweight_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("logged_at", { ascending: false });

      setBwHistory(bw || []);
      setBwLoading(false);
      setLoading(false);
    })();
  }, []);

  /* ---------------- BODYWEIGHT ACTIONS ---------------- */
  async function reloadBodyweight(userId) {
    const { data } = await supabase
      .from("bodyweight_logs")
      .select("*")
      .eq("user_id", userId)
      .order("logged_at", { ascending: false });

    setBwHistory(data || []);
  }

  async function saveBodyweight() {
    if (!bwInput || Number(bwInput) <= 0) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("bodyweight_logs").insert({
      user_id: user.id,
      weight: Number(bwInput),
      unit: "lbs",
    });

    await reloadBodyweight(user.id);
    setBwInput("");
  }

  async function saveBodyweightEdit() {
    if (!bwEdit) return;

    await supabase
      .from("bodyweight_logs")
      .update({
        weight: Number(bwEdit.weight),
        logged_at: bwEdit.logged_at,
      })
      .eq("id", bwEdit.id);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    await reloadBodyweight(user.id);
    setBwEdit(null);
  }

  async function confirmDeleteBodyweight() {
    if (!bwDelete) return;

    await supabase
      .from("bodyweight_logs")
      .delete()
      .eq("id", bwDelete);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    await reloadBodyweight(user.id);
    setBwDelete(null);
  }

  /* ---------------- MEASUREMENT HELPERS ---------------- */
  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = groupOrder.indexOf(active.id);
    const newIndex = groupOrder.indexOf(over.id);
    setGroupOrder((prev) => arrayMove(prev, oldIndex, newIndex));
  }

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
    if (!user || !mName || !mValue) return;

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
      grouped[key].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      );
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
      grouped[key].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      );
    }

    setGroups(grouped);
    setGroupOrder(Object.keys(grouped));
    setDeleteId(null);
  }

  if (loading)
    return <p style={{ padding: 20, opacity: 0.7 }}>Loading…</p>;

  const currentBW = bwHistory[0];

  return (
    <div style={{ padding: "20px 16px 90px", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>
        Measurements
      </h1>

      {/* BODYWEIGHT */}
      <div
        style={{
          background: "#0f0f0f",
          borderRadius: 14,
          padding: 16,
          border: "1px solid rgba(255,255,255,0.08)",
          marginBottom: 20,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Bodyweight</h2>

        {bwLoading ? (
          <p style={{ opacity: 0.6 }}>Loading…</p>
        ) : (
          <>
            <p style={{ fontSize: 28, fontWeight: 700 }}>
              {currentBW ? `${currentBW.weight} lbs` : "—"}
            </p>
            <p style={{ fontSize: 12, opacity: 0.7 }}>
              {currentBW
                ? `Last logged: ${new Date(
                    currentBW.logged_at
                  ).toLocaleDateString()}`
                : "No entries yet"}
            </p>

            <div style={{ display: "flex", gap: 10 }}>
              <input
                type="number"
                placeholder="Enter weight"
                value={bwInput}
                onChange={(e) => setBwInput(e.target.value)}
                style={inputStyle}
              />
              <button
                onClick={saveBodyweight}
                disabled={!bwInput}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: "none",
                  background: "#ff2f2f",
                  color: "white",
                  fontWeight: 600,
                }}
              >
                Log
              </button>
            </div>

            {bwHistory.length > 1 && (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 12, opacity: 0.7 }}>History</p>
                {bwHistory.slice(1, 6).map((b) => (
                  <div
                    key={b.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12,
                      opacity: 0.8,
                    }}
                  >
                    <span>
                      {b.weight} lbs —{" "}
                      {new Date(b.logged_at).toLocaleDateString()}
                    </span>
                    <span style={{ display: "flex", gap: 10 }}>
                      <FaEdit
                        style={{ cursor: "pointer" }}
                        onClick={() => setBwEdit({ ...b })}
                      />
                      <FaTrash
                        style={{ cursor: "pointer", color: "#ff4d4d" }}
                        onClick={() => setBwDelete(b.id)}
                      />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* MEASUREMENTS LIST (UNCHANGED BELOW) */}
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
        }}
      >
        + Add Measurement
      </button>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={groupOrder} strategy={verticalListSortingStrategy}>
          {groupOrder.map((groupName) => {
            const list = groups[groupName];
            const latest = list[0];
            const isOpen = expanded[groupName];

            return (
              <SortableItem key={groupName} id={groupName}>
                <div style={{ background: "#0f0f0f", borderRadius: 12, padding: 14, marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div
                      style={{ flexBasis: "40%" }}
                      onClick={() => setExpanded((p) => ({ ...p, [groupName]: !p[groupName] }))}
                    >
                      <p style={{ margin: 0, fontWeight: 600 }}>{groupName}</p>
                      <p style={{ margin: 0, opacity: 0.7 }}>
                        {latest.value} {latest.unit} — {latest.date}
                      </p>
                    </div>

                    <div style={{ display: "flex", gap: 12 }}>
                      <FaEdit onClick={() => openEdit(latest)} />
                      <FaTrash onClick={() => setDeleteId(latest.id)} style={{ color: "#ff4d4d" }} />
                      {isOpen ? <FaChevronUp /> : <FaChevronDown />}
                    </div>
                  </div>

                  {isOpen &&
                    list.slice(1).map((entry) => (
                      <p key={entry.id} style={{ fontSize: 12, opacity: 0.7 }}>
                        {entry.value} {entry.unit} — {entry.date}
                      </p>
                    ))}
                </div>
              </SortableItem>
            );
          })}
        </SortableContext>
      </DndContext>

      {/* BODYWEIGHT EDIT MODAL */}
      {bwEdit && (
        <div style={modalBackdrop} onClick={() => setBwEdit(null)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2>Edit Bodyweight</h2>
            <input
              style={inputStyle}
              type="number"
              value={bwEdit.weight}
              onChange={(e) => setBwEdit({ ...bwEdit, weight: e.target.value })}
            />
            <input
              style={inputStyle}
              type="date"
              value={bwEdit.logged_at.slice(0, 10)}
              onChange={(e) =>
                setBwEdit({
                  ...bwEdit,
                  logged_at: new Date(e.target.value).toISOString(),
                })
              }
            />
            <button style={saveBtn} onClick={saveBodyweightEdit}>Save</button>
          </div>
        </div>
      )}

      {/* BODYWEIGHT DELETE MODAL */}
      {bwDelete && (
        <div style={modalBackdrop} onClick={() => setBwDelete(null)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: "#ff4d4d" }}>Delete bodyweight entry?</h2>
            <button style={saveBtn} onClick={confirmDeleteBodyweight}>Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* SHARED STYLES */
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

const saveBtn = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "none",
  background: "#ff2f2f",
  color: "white",
  fontWeight: 600,
};
