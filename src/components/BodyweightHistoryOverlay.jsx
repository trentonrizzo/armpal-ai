import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { FaArrowLeft, FaEdit, FaTrash } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import { useToast } from "./ToastProvider";
import useMultiSelect from "../hooks/useMultiSelect";
import {
  getSelectStyle,
  SelectCheck,
  ViewBtn,
  SelectionBar,
  DoubleConfirmModal,
} from "./MultiSelectUI";

function safeDateOnly(ts) {
  if (!ts) return new Date().toISOString().slice(0, 10);
  if (typeof ts === "string" && ts.includes("T")) return ts.slice(0, 10);
  return ts;
}

export default function BodyweightHistoryOverlay({
  open,
  onClose,
  bwHistory,
  onReload,
}) {
  const toast = useToast();
  const ms = useMultiSelect();
  const [confirmStep, setConfirmStep] = useState(0);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [editRow, setEditRow] = useState(null);
  const [editWeight, setEditWeight] = useState("");
  const [editDate, setEditDate] = useState("");

  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    if (!open) {
      ms.cancel();
      setConfirmStep(0);
      setEditRow(null);
      setDeleteId(null);
    }
  }, [open]);

  function openEdit(row) {
    setEditRow(row);
    setEditWeight(String(row.weight));
    setEditDate(safeDateOnly(row.logged_at));
  }

  async function saveEdit() {
    if (!editRow) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const n = Number(editWeight);
    if (!editWeight || Number.isNaN(n) || n <= 0) return;
    const iso = new Date(`${editDate}T12:00:00.000Z`).toISOString();
    await supabase
      .from("bodyweight_logs")
      .update({ weight: n, unit: "lbs", logged_at: iso })
      .eq("id", editRow.id);
    setEditRow(null);
    onReload();
  }

  async function confirmSingleDelete() {
    if (!deleteId) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("bodyweight_logs").delete().eq("id", deleteId);
    setDeleteId(null);
    onReload();
  }

  async function bulkDelete() {
    if (ms.count === 0) return;
    setBulkDeleting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");
      const ids = [...ms.selected];
      const { error } = await supabase
        .from("bodyweight_logs")
        .delete()
        .eq("user_id", user.id)
        .in("id", ids);
      if (error) throw error;
      ms.cancel();
      setConfirmStep(0);
      onReload();
      toast.success(
        `Deleted ${ids.length} entr${ids.length !== 1 ? "ies" : "y"}`
      );
    } catch (e) {
      console.error("Bulk delete bodyweight failed:", e);
      toast.error("Some entries failed to delete");
    } finally {
      setBulkDeleting(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div style={OV}>
      <div style={HDR}>
        <button
          onClick={() => {
            ms.cancel();
            onClose();
          }}
          style={BACK}
        >
          <FaArrowLeft size={18} />
        </button>
        <h2 style={HDR_TITLE}>Bodyweight History</h2>
      </div>

      <div style={LIST}>
        {bwHistory.length === 0 && (
          <p style={{ padding: 20, opacity: 0.6, textAlign: "center" }}>
            No entries yet.
          </p>
        )}

        {bwHistory.map((b) => {
          const isSel = ms.selected.has(b.id);
          return (
            <div
              key={b.id}
              style={{
                ...ENTRY,
                ...getSelectStyle(ms.active, isSel),
              }}
              onPointerDown={(e) => {
                if (!ms.active && e.button === 0) ms.onPointerDown(b.id, e);
              }}
              onPointerMove={ms.onPointerMove}
              onPointerUp={ms.endLP}
              onPointerCancel={ms.endLP}
              onContextMenu={(e) => e.preventDefault()}
              onClick={() => {
                if (ms.consumeLP()) return;
                if (ms.active) {
                  ms.toggle(b.id);
                  return;
                }
              }}
            >
              {ms.active && <SelectCheck show={isSel} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={E_WEIGHT}>{b.weight} lbs</div>
                <div style={E_DATE}>
                  {new Date(b.logged_at).toLocaleDateString()}
                </div>
              </div>
              {ms.active ? (
                <div
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <ViewBtn onClick={() => openEdit(b)} />
                </div>
              ) : (
                <div
                  style={{ display: "flex", gap: 14, alignItems: "center" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <FaEdit
                    style={{ fontSize: 14, cursor: "pointer" }}
                    onClick={() => openEdit(b)}
                  />
                  <FaTrash
                    style={{
                      fontSize: 14,
                      cursor: "pointer",
                      color: "var(--accent)",
                    }}
                    onClick={() => setDeleteId(b.id)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

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
        onConfirm={bulkDelete}
        deleting={bulkDeleting}
      />

      {editRow && (
        <div style={MODAL_BG} onClick={() => setEditRow(null)}>
          <div style={MODAL} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, color: "var(--text)" }}>
              Edit Bodyweight
            </h2>
            <label style={LBL}>Weight (lbs)</label>
            <input
              style={INP}
              type="number"
              value={editWeight}
              onChange={(e) => setEditWeight(e.target.value)}
            />
            <label style={LBL}>Date</label>
            <input
              style={INP}
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
            />
            <button style={SAVE_BTN} onClick={saveEdit}>
              Save
            </button>
          </div>
        </div>
      )}

      {deleteId && (
        <div style={MODAL_BG} onClick={() => setDeleteId(null)}>
          <div style={MODAL} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, color: "var(--accent)" }}>
              Delete entry?
            </h2>
            <p style={{ opacity: 0.7, marginBottom: 16 }}>
              This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={CANCEL_BTN} onClick={() => setDeleteId(null)}>
                Cancel
              </button>
              <button style={SAVE_BTN} onClick={confirmSingleDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

const OV = {
  position: "fixed",
  inset: 0,
  zIndex: 10000,
  background: "var(--bg)",
  display: "flex",
  flexDirection: "column",
};

const HDR = {
  flexShrink: 0,
  height: 56,
  background: "var(--accent)",
  color: "var(--text)",
  display: "flex",
  alignItems: "center",
  gap: 12,
  paddingLeft: 12,
  paddingRight: 12,
  paddingTop: "env(safe-area-inset-top, 0px)",
};

const BACK = {
  width: 36,
  height: 36,
  borderRadius: 18,
  background: "rgba(255,255,255,0.2)",
  border: "none",
  color: "var(--text)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const HDR_TITLE = {
  margin: 0,
  fontSize: 18,
  fontWeight: 800,
};

const LIST = {
  flex: 1,
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
  padding: "12px 16px",
  paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
};

const ENTRY = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: 14,
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  marginBottom: 8,
  position: "relative",
  userSelect: "none",
  WebkitUserSelect: "none",
};

const E_WEIGHT = { fontSize: 16, fontWeight: 700, color: "var(--text)" };
const E_DATE = { fontSize: 12, opacity: 0.7, color: "var(--text)" };

const MODAL_BG = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.65)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: 20,
  zIndex: 10002,
};

const MODAL = {
  background: "var(--card)",
  borderRadius: 14,
  border: "1px solid var(--border)",
  padding: 20,
  width: "100%",
  maxWidth: 400,
  color: "var(--text)",
};

const LBL = {
  display: "block",
  fontSize: 12,
  opacity: 0.85,
  marginBottom: 4,
  fontWeight: 600,
};

const INP = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--card-2)",
  color: "var(--text)",
  marginBottom: 12,
  fontSize: 14,
  boxSizing: "border-box",
};

const SAVE_BTN = {
  flex: 1,
  width: "100%",
  padding: 12,
  borderRadius: 10,
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const CANCEL_BTN = {
  flex: 1,
  width: "100%",
  padding: 12,
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text)",
  fontWeight: 700,
  cursor: "pointer",
};
