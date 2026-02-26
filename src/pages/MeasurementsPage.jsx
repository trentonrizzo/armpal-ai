// src/pages/MeasurementsPage.jsx
// ============================================================
// FULL FILE REPLACEMENT — VERIFIED SINGLE EXPORT
// ============================================================
// FEATURES:
// - Measurements (add / edit / delete / confirm delete)
// - Grouped + expandable history
// - Drag & drop group ordering (40% left drag handle)
// - Bodyweight tracker inside Measurements page
//   • Log (append-only)
//   • Edit (explicit user action)
//   • Delete (confirm)
// - NO duplicate exports
// - Build-safe (Vite / Vercel)
// ============================================================

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
import { checkUsageCap } from "../utils/usageLimits";
import { useToast } from "../components/ToastProvider";
import useMultiSelect from "../hooks/useMultiSelect";
import { getSelectStyle, SelectCheck, ViewBtn, SelectionBar, DoubleConfirmModal } from "../components/MultiSelectUI";
import BodyweightHistoryOverlay from "../components/BodyweightHistoryOverlay";

/* -------------------------------------------------------
   SORTABLE ITEM — LEFT 40% = DRAG HANDLE
------------------------------------------------------- */
function SortableItem({ id, children, disabled }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id, disabled });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        position: "relative",
      }}
    >
      {!disabled && (
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
      )}
      {children}
    </div>
  );
}

// ============================================================
// MAIN COMPONENT (SINGLE EXPORT)
// ============================================================
export default function MeasurementsPage() {
  const [loading, setLoading] = useState(true);

  // ---------------- MEASUREMENTS ----------------
  const [groups, setGroups] = useState({});
  const [groupOrder, setGroupOrder] = useState([]);
  const [expanded, setExpanded] = useState({});

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);

  const [mName, setMName] = useState("");
  const [mValue, setMValue] = useState("");
  const [mUnit, setMUnit] = useState("in");
  const [mDate, setMDate] = useState(new Date().toISOString().slice(0, 10));

  const [deleteId, setDeleteId] = useState(null);

  // ---------------- BODYWEIGHT ----------------
  const [bwHistory, setBwHistory] = useState([]); // newest first
  const [bwInput, setBwInput] = useState("");

  const [bwEditRow, setBwEditRow] = useState(null);
  const [bwEditWeight, setBwEditWeight] = useState("");
  const [bwEditDate, setBwEditDate] = useState("");
  const [bwDeleteId, setBwDeleteId] = useState(null);
  const [bwOverlayOpen, setBwOverlayOpen] = useState(false);
  const [capMessage, setCapMessage] = useState("");

  // multi-select
  const toast = useToast();
  const ms = useMultiSelect();
  const [confirmStep, setConfirmStep] = useState(0);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // ---------------- DND ----------------
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // ============================================================
  // LOAD DATA
  // ============================================================
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Measurements
      const rows = await getMeasurements(user.id);
      const grouped = {};
      rows.forEach((m) => {
        if (!grouped[m.name]) grouped[m.name] = [];
        grouped[m.name].push(m);
      });
      Object.keys(grouped).forEach((k) =>
        grouped[k].sort((a, b) => new Date(b.date) - new Date(a.date))
      );
      setGroups(grouped);
      setGroupOrder(Object.keys(grouped));

      // Bodyweight
      const { data: bw } = await supabase
        .from("bodyweight_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("logged_at", { ascending: false });
      setBwHistory(bw || []);

      setLoading(false);
    })();
  }, []);

  // ============================================================
  // HELPERS
  // ============================================================
  async function reloadMeasurements(userId) {
    const rows = await getMeasurements(userId);
    const grouped = {};
    rows.forEach((m) => {
      if (!grouped[m.name]) grouped[m.name] = [];
      grouped[m.name].push(m);
    });
    Object.keys(grouped).forEach((k) =>
      grouped[k].sort((a, b) => new Date(b.date) - new Date(a.date))
    );
    setGroups(grouped);
    setGroupOrder(Object.keys(grouped));
  }

  async function reloadBodyweight(userId) {
    const { data } = await supabase
      .from("bodyweight_logs")
      .select("*")
      .eq("user_id", userId)
      .order("logged_at", { ascending: false });
    setBwHistory(data || []);
  }

  function safeDateOnly(ts) {
    if (!ts) return new Date().toISOString().slice(0, 10);
    if (typeof ts === "string" && ts.includes("T")) return ts.slice(0, 10);
    return ts;
  }

  async function bulkDeleteMeasurements() {
    if (ms.count === 0) return;
    setBulkDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");
      const names = [...ms.selected];
      const { error } = await supabase
        .from("measurements")
        .delete()
        .eq("user_id", user.id)
        .in("name", names);
      if (error) throw error;
      ms.cancel();
      setConfirmStep(0);
      await reloadMeasurements(user.id);
      toast.success(`Deleted ${names.length} item${names.length !== 1 ? "s" : ""}`);
    } catch (e) {
      console.error("Bulk delete measurements failed:", e);
      toast.error("Some items failed to delete");
    } finally {
      setBulkDeleting(false);
    }
  }

  // ============================================================
  // DND HANDLER
  // ============================================================
  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = groupOrder.indexOf(active.id);
    const newIndex = groupOrder.indexOf(over.id);
    setGroupOrder((prev) => arrayMove(prev, oldIndex, newIndex));
  }

  // ============================================================
  // MEASUREMENTS ACTIONS
  // ============================================================
  function openNew() {
    setEditId(null);
    setMName("");
    setMValue("");
    setMUnit("in");
    setMDate(new Date().toISOString().slice(0, 10));
    setCapMessage("");
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
      const cap = await checkUsageCap(user.id, "measurements");
      if (!cap.allowed) {
        setCapMessage(`Measurement limit reached (${cap.limit}). Go Pro for more!`);
        return;
      }
      setCapMessage("");
      await addMeasurement({
        userId: user.id,
        name: mName,
        value: mValue,
        unit: mUnit,
        date: mDate,
      });
    }

    await reloadMeasurements(user.id);
    setModalOpen(false);
  }

  async function confirmDeleteMeasurement() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await deleteMeasurement(deleteId);
    await reloadMeasurements(user.id);
    setDeleteId(null);
  }

  // ============================================================
  // BODYWEIGHT ACTIONS
  // ============================================================
  async function saveBodyweight() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const n = Number(bwInput);
    if (!bwInput || Number.isNaN(n) || n <= 0) return;

    const cap = await checkUsageCap(user.id, "bodyweight");
    if (!cap.allowed) {
      setCapMessage(`Bodyweight log limit reached (${cap.limit}). Go Pro for more!`);
      return;
    }
    setCapMessage("");

    await supabase.from("bodyweight_logs").insert({
      user_id: user.id,
      weight: n,
      unit: "lbs",
    });

    await reloadBodyweight(user.id);
    setBwInput("");
  }

  function openBodyweightEdit(row) {
    setBwEditRow(row);
    setBwEditWeight(String(row.weight));
    setBwEditDate(safeDateOnly(row.logged_at));
  }

  async function saveBodyweightEdit() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !bwEditRow) return;

    const n = Number(bwEditWeight);
    if (!bwEditWeight || Number.isNaN(n) || n <= 0) return;

    const iso = new Date(`${bwEditDate}T12:00:00.000Z`).toISOString();

    await supabase
      .from("bodyweight_logs")
      .update({ weight: n, unit: "lbs", logged_at: iso })
      .eq("id", bwEditRow.id);

    await reloadBodyweight(user.id);
    setBwEditRow(null);
  }

  async function confirmDeleteBodyweight() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("bodyweight_logs").delete().eq("id", bwDeleteId);
    await reloadBodyweight(user.id);
    setBwDeleteId(null);
  }

  if (loading) return <p style={{ padding: 20, opacity: 0.7 }}>Loading…</p>;

  const currentBW = bwHistory[0];

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div style={{ padding: "20px 16px 90px", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>
        Measurements
      </h1>

      {/* BODYWEIGHT */}
      <div
        style={{
          background: "var(--card)",
          borderRadius: 14,
          padding: 16,
          border: "1px solid var(--border)",
          marginBottom: 20,
          cursor: "pointer",
        }}
        onClick={() => setBwOverlayOpen(true)}
      >
        <h2 style={{ marginTop: 0 }}>Bodyweight</h2>

        <p style={{ fontSize: 34, fontWeight: 800 }}>
          {currentBW ? `${currentBW.weight} lbs` : "—"}
        </p>
        <p style={{ fontSize: 12, opacity: 0.7 }}>
          {currentBW
            ? `Last logged: ${new Date(currentBW.logged_at).toLocaleDateString()}`
            : "No entries yet"}
        </p>

        <div
          style={{ display: "flex", gap: 10, alignItems: "center" }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            style={{
              ...inputStyle,
              marginBottom: 0,
              flex: 1,
              height: 44,
              fontSize: 16,
              padding: "0 12px",
            }}
            type="number"
            inputMode="decimal"
            placeholder="Enter weight"
            value={bwInput}
            onChange={(e) => setBwInput(e.target.value)}
          />
          <button
            style={{
              height: 44,
              padding: "0 16px",
              borderRadius: 10,
              border: "none",
              background: "var(--accent)",
              color: "var(--text)",
              fontWeight: 700,
              minWidth: 80,
              flexShrink: 0,
            }}
            onClick={saveBodyweight}
          >
            Log
          </button>
        </div>
        {capMessage ? <p style={{ color: "var(--accent)", fontSize: 14, marginTop: 8 }}>{capMessage}</p> : null}

        {bwHistory.length > 1 && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 12, opacity: 0.7 }}>History</p>
            {bwHistory.slice(1, 6).map((b) => (
              <div
                key={b.id}
                style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}
              >
                <span style={{ fontSize: 13 }}>
                  {b.weight} lbs — {new Date(b.logged_at).toLocaleDateString()}
                </span>
                <span
                  style={{ display: "flex", gap: 12 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <FaEdit
                    style={{ cursor: "pointer" }}
                    onClick={() => openBodyweightEdit(b)}
                  />
                  <FaTrash
                    style={{ color: "var(--accent)", cursor: "pointer" }}
                    onClick={() => setBwDeleteId(b.id)}
                  />
                </span>
              </div>
            ))}
            {bwHistory.length > 6 && (
              <p style={{ fontSize: 12, opacity: 0.6, marginTop: 6, marginBottom: 0, textAlign: "center" }}>
                + {bwHistory.length - 6} more entries
              </p>
            )}
          </div>
        )}
      </div>

      <BodyweightHistoryOverlay
        open={bwOverlayOpen}
        onClose={() => setBwOverlayOpen(false)}
        bwHistory={bwHistory}
        onReload={async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) await reloadBodyweight(user.id);
        }}
      />

      {/* ADD MEASUREMENT */}
      <button style={addBtn} onClick={openNew}>
        + Add Measurement
      </button>

      {/* MEASUREMENTS LIST */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={groupOrder} strategy={verticalListSortingStrategy}>
          {groupOrder.map((groupName) => {
            const list = groups[groupName];
            const latest = list[0];
            const isOpen = expanded[groupName];

            return (
              <SortableItem key={groupName} id={groupName} disabled={ms.active}>
                <div
                  style={{
                    ...cardStyle,
                    position: "relative",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    ...getSelectStyle(ms.active, ms.selected.has(groupName)),
                  }}
                  onPointerDown={(e) => { if (!ms.active && e.button === 0) ms.onPointerDown(groupName, e); }}
                  onPointerMove={ms.onPointerMove}
                  onPointerUp={ms.endLP}
                  onPointerCancel={ms.endLP}
                  onContextMenu={(e) => e.preventDefault()}
                  onClick={() => { if (ms.consumeLP()) return; if (ms.active) ms.toggle(groupName); }}
                >
                  {ms.active && <SelectCheck show={ms.selected.has(groupName)} />}
                  <div style={rowStyle}>
                    <div
                      style={{ flexBasis: "40%", cursor: "grab" }}
                      onClick={(e) => {
                        if (ms.active) return;
                        e.stopPropagation();
                        setExpanded((p) => ({
                          ...p,
                          [groupName]: !p[groupName],
                        }));
                      }}
                    >
                      <p style={{ margin: 0, fontWeight: 600 }}>
                        {groupName}
                      </p>
                      <p style={{ margin: 0, opacity: 0.7 }}>
                        {latest.value} {latest.unit} — {latest.date}
                      </p>
                    </div>

                    {ms.active ? (
                      <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                        <ViewBtn onClick={() => openEdit(latest)} />
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 12 }}>
                        <FaEdit onClick={() => openEdit(latest)} />
                        <FaTrash
                          style={{ color: "var(--accent)" }}
                          onClick={() => setDeleteId(latest.id)}
                        />
                        {isOpen ? <FaChevronUp /> : <FaChevronDown />}
                      </div>
                    )}
                  </div>

                  {!ms.active && isOpen && (
                    <div style={{ marginTop: 10 }}>
                      {list.slice(1).map((entry) => (
                        <div key={entry.id} style={historyCard}>
                          <div style={rowStyle}>
                            <div>
                              <p style={{ margin: 0, fontWeight: 600 }}>
                                {entry.value} {entry.unit}
                              </p>
                              <p style={{ margin: 0, opacity: 0.7 }}>
                                {entry.date}
                              </p>
                            </div>
                            <div style={{ display: "flex", gap: 12 }}>
                              <FaEdit onClick={() => openEdit(entry)} />
                              <FaTrash
                                style={{ color: "var(--accent)" }}
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

      {/* MEASUREMENT MODAL */}
      {modalOpen && (
        <div style={modalBackdrop} onClick={() => setModalOpen(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2>{editId ? "Edit Measurement" : "New Measurement"}</h2>
            <label style={labelStyle}>Name</label>
            <input style={inputStyle} value={mName} onChange={(e) => setMName(e.target.value)} />
            <label style={labelStyle}>Value</label>
            <input style={inputStyle} value={mValue} onChange={(e) => setMValue(e.target.value)} />
            <label style={labelStyle}>Unit</label>
            <select style={inputStyle} value={mUnit} onChange={(e) => setMUnit(e.target.value)}>
              <option value="in">in</option>
              <option value="cm">cm</option>
            </select>
            <label style={labelStyle}>Date</label>
            <input style={inputStyle} type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} />
            {capMessage ? <p style={{ color: "var(--accent)", fontSize: 14, marginTop: 8 }}>{capMessage}</p> : null}
            <button style={primaryBtn} onClick={saveMeasurement}>Save</button>
          </div>
        </div>
      )}

      {/* MEASUREMENT DELETE */}
      {deleteId && (
        <div style={modalBackdrop} onClick={() => setDeleteId(null)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: "var(--accent)" }}>Confirm Delete?</h2>
            <button style={primaryBtn} onClick={confirmDeleteMeasurement}>Delete</button>
          </div>
        </div>
      )}

      {/* BODYWEIGHT EDIT */}
      {bwEditRow && (
        <div style={modalBackdrop} onClick={() => setBwEditRow(null)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2>Edit Bodyweight</h2>
            <input style={inputStyle} value={bwEditWeight} onChange={(e) => setBwEditWeight(e.target.value)} />
            <input style={inputStyle} type="date" value={bwEditDate} onChange={(e) => setBwEditDate(e.target.value)} />
            <button style={primaryBtn} onClick={saveBodyweightEdit}>Save</button>
          </div>
        </div>
      )}

      {ms.active && (
        <SelectionBar
          count={ms.count}
          onDelete={() => setConfirmStep(1)}
          onCancel={ms.cancel}
        />
      )}
      <DoubleConfirmModal
        count={ms.count}
        step={confirmStep}
        onCancel={() => setConfirmStep(0)}
        onContinue={() => setConfirmStep(2)}
        onConfirm={bulkDeleteMeasurements}
        deleting={bulkDeleting}
      />

      {/* BODYWEIGHT DELETE */}
      {bwDeleteId && (
        <div style={modalBackdrop} onClick={() => setBwDeleteId(null)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: "var(--accent)" }}>Delete bodyweight entry?</h2>
            <button style={primaryBtn} onClick={confirmDeleteBodyweight}>Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// STYLES
// ============================================================
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
  background: "var(--card)",
  borderRadius: 12,
  border: "1px solid var(--border)",
  padding: 18,
  width: "100%",
  maxWidth: 420,
};

const inputStyle = {
  width: "100%",
  padding: 8,
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--card-2)",
  color: "var(--text)",
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
  background: "var(--accent)",
  color: "white",
  fontWeight: 700,
};

const addBtn = {
  padding: "10px 20px",
  background: "var(--accent)",
  borderRadius: 999,
  border: "none",
  fontSize: 14,
  fontWeight: 600,
  color: "white",
  marginBottom: 18,
};

const cardStyle = {
  background: "var(--card)",
  borderRadius: 12,
  padding: 14,
  border: "1px solid var(--border)",
  marginBottom: 10,
};

const historyCard = {
  background: "var(--card-2)",
  borderRadius: 10,
  padding: 10,
  marginBottom: 8,
  border: "1px solid var(--border)",
};

const rowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};
