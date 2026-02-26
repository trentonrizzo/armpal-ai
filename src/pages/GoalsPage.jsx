// src/pages/GoalsPage.jsx
// ============================================================
// ARM PAL — GOALS PAGE (FULL, SAFE, FIXED SAVING + RED THEME)
// + OPTIONAL TARGET DATE (ONLY SAVES IF USER ENABLES IT)
// ============================================================

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { checkUsageCap } from "../utils/usageLimits";

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

import { FaEdit, FaTrash } from "react-icons/fa";
import { useToast } from "../components/ToastProvider";
import useMultiSelect from "../hooks/useMultiSelect";
import { getSelectStyle, SelectCheck, ViewBtn, SelectionBar, DoubleConfirmModal } from "../components/MultiSelectUI";

/* ============================================================
   SORTABLE WRAPPER (LEFT HANDLE 40% ONLY)
============================================================ */
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
            zIndex: 6,
            touchAction: "none",
          }}
        />
      )}
      {children}
    </div>
  );
}

/* ============================================================
   MAIN PAGE
============================================================ */
export default function GoalsPage() {
  const [goals, setGoals] = useState([]);
  const [order, setOrder] = useState([]);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);

  // form fields
  const [title, setTitle] = useState("");
  const [type, setType] = useState("custom"); // custom | bodyweight | strength
  const [currentValue, setCurrentValue] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState("");

  // OPTIONAL TARGET DATE (ONLY SAVES IF ENABLED)
  const [useTargetDate, setUseTargetDate] = useState(false);
  const [targetDate, setTargetDate] = useState(""); // "YYYY-MM-DD"

  // errors / saving
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // delete confirm
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // multi-select
  const toast = useToast();
  const ms = useMultiSelect();
  const [confirmStep, setConfirmStep] = useState(0);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  /* ============================================================
     LOAD USER + GOALS
  ============================================================ */
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      const u = data?.user || null;
      setUser(u);

      if (u && !error) {
        await loadGoals(u.id);
      }
      setLoading(false);
    })();
  }, []);

  async function loadGoals(uid) {
    const { data, error } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", uid)
      .order("updated_at", { ascending: false });

    if (error) {
      setGoals([]);
      setOrder([]);
      return;
    }

    setGoals(data || []);
    setOrder((data || []).map((g) => g.id));
  }

  /* ============================================================
     REORDER
  ============================================================ */
  function onDragEnd(e) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const oldIndex = order.indexOf(active.id);
    const newIndex = order.indexOf(over.id);

    const newOrder = arrayMove(order, oldIndex, newIndex);
    setOrder(newOrder);
  }

  /* ============================================================
     MODAL OPEN/CLOSE
  ============================================================ */
  function openModal(goal = null) {
    setFormError("");

    if (goal) {
      setEditingGoal(goal);
      setTitle(goal.title ?? "");
      setType(goal.type ?? "custom");
      setCurrentValue(goal.current_value ?? "");
      setTargetValue(goal.target_value ?? "");
      setUnit(goal.unit ?? "");

      // OPTIONAL DATE: if exists, prefill + enable
      const existingDate =
        goal.target_date ||
        goal.goal_date ||
        goal.deadline ||
        goal.target_deadline ||
        "";
      if (existingDate) {
        // If it's an ISO timestamp, reduce to YYYY-MM-DD
        const d = String(existingDate);
        const normalized = d.includes("T") ? d.split("T")[0] : d;
        setUseTargetDate(true);
        setTargetDate(normalized);
      } else {
        setUseTargetDate(false);
        setTargetDate("");
      }
    } else {
      setEditingGoal(null);
      setTitle("");
      setType("custom");
      setCurrentValue("");
      setTargetValue("");
      setUnit("");

      setUseTargetDate(false);
      setTargetDate("");
    }

    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
  }

  /* ============================================================
     SAVE GOAL
     - date is 100% optional
     - we ONLY include the column if user enabled + picked a date
     - this prevents breaking if your DB doesn't have the column yet
  ============================================================ */
  async function saveGoal() {
    setFormError("");
    if (!user?.id) return setFormError("Not logged in.");

    const finalType = type || "custom";
    const finalUnit = finalType === "bodyweight" ? "lb" : (unit || "").trim();

    const finalTitle =
      (title || "").trim() ||
      (finalType === "bodyweight" ? "Bodyweight" : "");

    if (!finalTitle) return setFormError("Title is required.");
    if (targetValue === "" || targetValue === null)
      return setFormError("Target value is required.");

    const cur =
      currentValue === "" || currentValue === null
        ? null
        : Number(currentValue);
    const tgt = Number(targetValue);

    if (Number.isNaN(tgt)) return setFormError("Target value must be a number.");
    if (cur !== null && Number.isNaN(cur))
      return setFormError("Current value must be a number.");

    if (finalType !== "bodyweight" && !finalUnit) {
      return setFormError("Unit is required.");
    }

    // optional date validation ONLY if enabled
    let finalTargetDate = "";
    if (useTargetDate) {
      finalTargetDate = (targetDate || "").trim();
      if (!finalTargetDate) {
        return setFormError("Pick a target date or uncheck the date option.");
      }
      // very light validation
      if (!/^\d{4}-\d{2}-\d{2}$/.test(finalTargetDate)) {
        return setFormError("Target date must be YYYY-MM-DD.");
      }
    }

    setSaving(true);

    // base payload
    const payload = {
      user_id: user.id,
      title: finalTitle,
      type: finalType,
      current_value: cur,
      target_value: tgt,
      unit: finalUnit,
      updated_at: new Date().toISOString(),
    };

    // only attach date if enabled + selected
    if (useTargetDate && finalTargetDate) {
      // preferred column name:
      payload.target_date = finalTargetDate;
    }

    let res;
    if (editingGoal?.id) {
      res = await supabase
        .from("goals")
        .update(payload)
        .eq("id", editingGoal.id)
        .select()
        .maybeSingle();
    } else {
      const cap = await checkUsageCap(user.id, "goals");
      if (!cap.allowed) {
        setFormError(`Goal limit reached (${cap.limit}). Go Pro for more!`);
        setSaving(false);
        return;
      }
      res = await supabase.from("goals").insert(payload).select().maybeSingle();
    }

    const { error } = res || {};
    if (error) {
      // if DB doesn't have target_date column, user might have enabled date.
      // show clean message
      const msg = error.message || "Failed to save goal.";
      if (msg.toLowerCase().includes("target_date")) {
        setFormError(
          "Your database is missing the target_date column. Either add it, or uncheck the Target Date option."
        );
      } else {
        setFormError(msg);
      }
      setSaving(false);
      return;
    }

    setSaving(false);
    setModalOpen(false);
    await loadGoals(user.id);
  }

  /* ============================================================
     DELETE
  ============================================================ */
  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);

    const { error } = await supabase.from("goals").delete().eq("id", deleteId);

    setDeleting(false);

    if (error) {
      setFormError(error.message || "Failed to delete.");
      return;
    }

    setDeleteId(null);
    setFormError("");
    if (user) await loadGoals(user.id);
  }

  async function bulkDeleteGoals() {
    if (ms.count === 0 || !user) return;
    setBulkDeleting(true);
    try {
      const ids = [...ms.selected];
      const { error } = await supabase.from("goals").delete().in("id", ids);
      if (error) throw error;
      ms.cancel();
      setConfirmStep(0);
      await loadGoals(user.id);
      toast.success(`Deleted ${ids.length} item${ids.length !== 1 ? "s" : ""}`);
    } catch (e) {
      console.error("Bulk delete goals failed:", e);
      toast.error("Some items failed to delete");
    } finally {
      setBulkDeleting(false);
    }
  }

  /* ============================================================
     ORDERED GOALS
  ============================================================ */
  const orderedGoals = useMemo(() => {
    return order
      .map((id) => goals.find((g) => g.id === id))
      .filter(Boolean);
  }, [order, goals]);

  if (loading) return <p style={{ padding: 20, opacity: 0.7 }}>Loading…</p>;

  return (
    <div
      style={{
        padding: "20px 16px 90px",
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>
        Goals
      </h1>

      {/* ADD BUTTON — SOLID RED (NO ORANGE) */}
      <button
        onClick={() => openModal(null)}
        style={{
          padding: "14px 12px",
          width: "100%",
          background: "var(--accent)",
          borderRadius: 14,
          border: "none",
          color: "white",
          fontSize: 15,
          fontWeight: 800,
          marginBottom: 18,
          boxShadow: "0 10px 30px color-mix(in srgb, var(--accent) 90%, transparent)",
        }}
      >
        + Add New Goal
      </button>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          {orderedGoals.map((goal) => {
            const current = Number(goal.current_value || 0);
            const target = Number(goal.target_value || 0);

            const progress =
              target > 0
                ? Math.min(100, Math.max(0, Math.round((current / target) * 100)))
                : 0;

            return (
              <SortableItem key={goal.id} id={goal.id} disabled={ms.active}>
                <div
                  style={{
                    background: "var(--card)",
                    borderRadius: 14,
                    padding: 16,
                    border: "1px solid var(--border)",
                    marginBottom: 14,
                    position: "relative",
                    overflow: "hidden",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    ...getSelectStyle(ms.active, ms.selected.has(goal.id)),
                  }}
                  onPointerDown={(e) => { if (!ms.active && e.button === 0) ms.onPointerDown(goal.id, e); }}
                  onPointerMove={ms.onPointerMove}
                  onPointerUp={ms.endLP}
                  onPointerCancel={ms.endLP}
                  onContextMenu={(e) => e.preventDefault()}
                  onClick={() => { if (ms.consumeLP()) return; if (ms.active) ms.toggle(goal.id); }}
                >
                  {ms.active && <SelectCheck show={ms.selected.has(goal.id)} />}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 10,
                    }}
                  >
                    <div style={{ flex: 1, paddingRight: 10 }}>
                      <div
                        style={{
                          margin: 0,
                          fontSize: 16,
                          fontWeight: 800,
                          lineHeight: "20px",
                        }}
                      >
                        {goal.title}
                      </div>

                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 12,
                          opacity: 0.75,
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        <span>
                          {current} / {target} {goal.unit}
                        </span>

                        {goal.type === "bodyweight" && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              padding: "4px 8px",
                              borderRadius: 999,
                              background: "color-mix(in srgb, var(--accent) 90%, transparent)",
                              border: "1px solid color-mix(in srgb, var(--accent) 90%, transparent)",
                              color: "#fff",
                            }}
                          >
                            Bodyweight
                          </span>
                        )}

                        {goal.type === "strength" && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              padding: "4px 8px",
                              borderRadius: 999,
                              background: "color-mix(in srgb, var(--accent) 18%, transparent)",
                              border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)",
                              color: "var(--text)",
                            }}
                          >
                            Strength
                          </span>
                        )}

                        {/* OPTIONAL DATE CHIP (only if exists) */}
                        {(goal.target_date ||
                          goal.goal_date ||
                          goal.deadline ||
                          goal.target_deadline) && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              padding: "4px 8px",
                              borderRadius: 999,
                              background: "color-mix(in srgb, var(--accent) 14%, transparent)",
                              border: "1px solid color-mix(in srgb, var(--accent) 28%, transparent)",
                              color: "var(--text)",
                            }}
                          >
                            Target:{" "}
                            {String(
                              goal.target_date ||
                                goal.goal_date ||
                                goal.deadline ||
                                goal.target_deadline
                            ).includes("T")
                              ? String(
                                  goal.target_date ||
                                    goal.goal_date ||
                                    goal.deadline ||
                                    goal.target_deadline
                                ).split("T")[0]
                              : String(
                                  goal.target_date ||
                                    goal.goal_date ||
                                    goal.deadline ||
                                    goal.target_deadline
                                )}
                          </span>
                        )}
                      </div>
                    </div>

                    {ms.active ? (
                      <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} style={{ paddingLeft: 10 }}>
                        <ViewBtn onClick={() => openModal(goal)} />
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          gap: 14,
                          paddingLeft: 10,
                          pointerEvents: "auto",
                        }}
                      >
                        <FaEdit
                          style={{ cursor: "pointer", fontSize: 16 }}
                          onClick={() => openModal(goal)}
                        />
                        <FaTrash
                          style={{
                            cursor: "pointer",
                            color: "var(--accent)",
                            fontSize: 16,
                          }}
                          onClick={() => {
                            setFormError("");
                            setDeleteId(goal.id);
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* PROGRESS BAR */}
                  <div style={{ marginTop: 14 }}>
                    <div
                      style={{
                        height: 7,
                        width: "100%",
                        background: "var(--border)",
                        borderRadius: 999,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${progress}%`,
                          height: "100%",
                          background: "var(--accent)",
                          borderRadius: 999,
                          transition: "width 0.25s ease",
                          boxShadow: "0 0 18px color-mix(in srgb, var(--accent) 90%, transparent)",
                        }}
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        marginTop: 8,
                        fontSize: 13,
                        opacity: 0.85,
                        fontWeight: 800,
                      }}
                    >
                      {progress}%
                    </div>
                  </div>
                </div>
              </SortableItem>
            );
          })}
        </SortableContext>
      </DndContext>

      {/* ========================= MODAL: ADD/EDIT ========================= */}
      {modalOpen && (
        <div style={backdrop} onClick={closeModal}>
          <div style={card} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, fontSize: 22, fontWeight: 900 }}>
              {editingGoal ? "Edit Goal" : "New Goal"}
            </h2>

            {formError ? (
              <div
                style={{
                  background: "color-mix(in srgb, var(--accent) 90%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--accent) 90%, transparent)",
                  color: "#fff",
                  padding: 10,
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 12,
                }}
              >
                {formError}
              </div>
            ) : null}

            <label style={label}>Title</label>
            <input
              style={input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bench, Squat, Bodyweight, etc."
            />

            <label style={label}>Goal Type</label>
            <select
              style={input}
              value={type}
              onChange={(e) => {
                const next = e.target.value;
                setType(next);

                if (next === "bodyweight") {
                  setUnit("lb");
                  if (!title.trim()) setTitle("Bodyweight");
                }
              }}
            >
              <option value="custom">Custom</option>
              <option value="bodyweight">Bodyweight</option>
              <option value="strength">Strength</option>
            </select>

            <label style={label}>Current Value</label>
            <input
              style={input}
              type="number"
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              placeholder={type === "bodyweight" ? "188" : "315"}
            />

            <label style={label}>Target Value</label>
            <input
              style={input}
              type="number"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder={type === "bodyweight" ? "180" : "405"}
            />

            <label style={label}>Unit</label>
            <input
              style={{
                ...input,
                opacity: type === "bodyweight" ? 0.7 : 1,
              }}
              value={type === "bodyweight" ? "lb" : unit}
              disabled={type === "bodyweight"}
              onChange={(e) => setUnit(e.target.value)}
              placeholder={type === "bodyweight" ? "lb" : "lb"}
            />

            {/* OPTIONAL TARGET DATE */}
            <div
              style={{
                marginTop: 6,
                marginBottom: 12,
                padding: 12,
                borderRadius: 12,
                background: "var(--border)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 13 }}>
                  Target Date (optional)
                </div>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12,
                    opacity: 0.9,
                    fontWeight: 800,
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={useTargetDate}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setUseTargetDate(checked);
                      if (!checked) setTargetDate("");
                    }}
                    style={{ transform: "scale(1.1)" }}
                  />
                  Enable
                </label>
              </div>

              {useTargetDate && (
                <div style={{ marginTop: 10 }}>
                  <label style={{ ...label, marginBottom: 6 }}>Pick a date</label>
                  <input
                    style={input}
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                  />
                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                    If you don’t want a timeline, uncheck “Enable”.
                  </div>
                </div>
              )}
            </div>

            <button
              style={{
                ...saveBtn,
                background: saving ? "color-mix(in srgb, var(--text) 20%, transparent)" : "var(--accent)",
                cursor: saving ? "not-allowed" : "pointer",
              }}
              onClick={saveGoal}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Goal"}
            </button>

            <button
              style={{
                ...cancelBtn,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.6 : 1,
              }}
              onClick={closeModal}
              disabled={saving}
            >
              Cancel
            </button>
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
        onConfirm={bulkDeleteGoals}
        deleting={bulkDeleting}
      />

      {/* ========================= CONFIRM DELETE ========================= */}
      {deleteId && (
        <div
          style={backdrop}
          onClick={() => (deleting ? null : setDeleteId(null))}
        >
          <div style={card} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, color: "var(--accent)", fontWeight: 900 }}>
              Confirm Delete?
            </h2>
            <p style={{ opacity: 0.75, marginTop: 6 }}>
              This action cannot be undone.
            </p>

            {formError ? (
              <div
                style={{
                  background: "color-mix(in srgb, var(--accent) 90%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--accent) 90%, transparent)",
                  color: "#fff",
                  padding: 10,
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 700,
                  marginTop: 10,
                }}
              >
                {formError}
              </div>
            ) : null}

            <button
              style={{
                ...cancelBtn,
                cursor: deleting ? "not-allowed" : "pointer",
                opacity: deleting ? 0.6 : 1,
              }}
              onClick={() => setDeleteId(null)}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              style={{
                ...deleteBtn,
                background: deleting ? "color-mix(in srgb, var(--text) 20%, transparent)" : "var(--accent)",
                cursor: deleting ? "not-allowed" : "pointer",
              }}
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   STYLES
============================================================ */
const backdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.65)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: 20,
  zIndex: 999,
};

const card = {
  background: "var(--card)",
  borderRadius: 16,
  border: "1px solid var(--border)",
  padding: 18,
  width: "100%",
  maxWidth: 440,
};

const input = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  background: "var(--card-2)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  marginBottom: 12,
  fontSize: 14,
};

const label = {
  fontSize: 12,
  opacity: 0.85,
  marginBottom: 6,
  display: "block",
  fontWeight: 700,
};

const saveBtn = {
  width: "100%",
  padding: 12,
  borderRadius: 14,
  background: "var(--accent)",
  color: "white",
  border: "none",
  fontWeight: 900,
  marginBottom: 10,
};

const cancelBtn = {
  width: "100%",
  padding: 12,
  borderRadius: 14,
  background: "color-mix(in srgb, var(--text) 22%, transparent)",
  color: "white",
  border: "none",
  marginBottom: 10,
  fontWeight: 800,
};

const deleteBtn = {
  width: "100%",
  padding: 12,
  borderRadius: 14,
  background: "var(--accent)",
  color: "white",
  border: "none",
  fontWeight: 900,
};
