// src/pages/ProgressPhotos.jsx
//
// Private, local-only Progress Photos vault. Completely separate from the
// Profile photo system. All image bytes live in IndexedDB on this device.
// Saving to the vault does not use Supabase or count toward daily upload quotas.
// Only "Send to friends" uses the chat-images pipeline + chat_photo quota.
//
// Features:
//   - Take photo (camera) + library multi-select
//   - Per-photo edit note / delete
//   - Sort control (upload date / photo date, ascending / descending)
//   - Explicit "Select" button → multi-select mode (tap to toggle, bulk delete,
//     send to friends via the existing chat-image system)
//   - Tap a photo to open the fullscreen viewer (swipe + pinch-zoom + native
//     iOS long-press preserved on the image itself)

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaTrash,
  FaCamera,
  FaImages,
  FaEdit,
  FaCheck,
  FaPaperPlane,
} from "react-icons/fa";
import {
  addProgressPhoto,
  listProgressPhotos,
  deleteProgressPhoto,
  updateProgressPhotoNote,
} from "../services/progressPhotosLocal";
import ProgressPhotoViewer from "../components/ProgressPhotoViewer";
import ShareProgressPhotosModal from "../components/ShareProgressPhotosModal";

function todayLocalDate() {
  return new Date().toISOString().slice(0, 10);
}

const SORT_OPTIONS = [
  { value: "newest", label: "Newest to oldest" },
  { value: "oldest", label: "Oldest to newest" },
  { value: "uploadDesc", label: "Upload date — newest" },
  { value: "uploadAsc", label: "Upload date — oldest" },
  { value: "photoDesc", label: "Photo date — newest" },
  { value: "photoAsc", label: "Photo date — oldest" },
];

function compareByCreatedAt(a, b, asc) {
  const av = a.createdAt || "";
  const bv = b.createdAt || "";
  if (av === bv) return 0;
  return asc ? (av < bv ? -1 : 1) : av > bv ? -1 : 1;
}

function compareByDate(a, b, asc) {
  const av = a.date || "";
  const bv = b.date || "";
  if (av === bv) return compareByCreatedAt(a, b, asc);
  return asc ? (av < bv ? -1 : 1) : av > bv ? -1 : 1;
}

function sortPhotos(list, mode) {
  const arr = [...list];
  switch (mode) {
    case "oldest":
    case "uploadAsc":
      arr.sort((a, b) => compareByCreatedAt(a, b, true));
      break;
    case "photoDesc":
      arr.sort((a, b) => compareByDate(a, b, false));
      break;
    case "photoAsc":
      arr.sort((a, b) => compareByDate(a, b, true));
      break;
    case "newest":
    case "uploadDesc":
    default:
      arr.sort((a, b) => compareByCreatedAt(a, b, false));
      break;
  }
  return arr;
}

export default function ProgressPhotos() {
  const navigate = useNavigate();
  const cameraInputRef = useRef(null);
  const libraryInputRef = useRef(null);

  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState("newest");

  // Pending upload batch
  const [pendingFiles, setPendingFiles] = useState([]);
  const [pendingDate, setPendingDate] = useState(todayLocalDate());
  const [pendingNote, setPendingNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete + edit
  const [confirmDelete, setConfirmDelete] = useState(null); // single id
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteDraft, setEditingNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Viewer
  const [viewerIndex, setViewerIndex] = useState(null);

  // Multi-select state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());

  // Share-to-friends
  const [shareOpen, setShareOpen] = useState(false);

  // ---------- Load + cleanup -----------------------------------------------

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const all = await listProgressPhotos();
        if (cancelled) return;
        const withUrls = all.map((row) => ({
          ...row,
          url: row.blob ? URL.createObjectURL(row.blob) : null,
        }));
        setPhotos(withUrls);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      for (const p of photos) {
        if (p.url) URL.revokeObjectURL(p.url);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pending preview URLs
  const pendingPreviews = useMemo(() => {
    return pendingFiles.map((f) => ({
      key: `${f.name || "img"}-${f.size}-${f.lastModified || 0}`,
      url: URL.createObjectURL(f),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFiles]);

  useEffect(() => {
    return () => {
      for (const p of pendingPreviews) URL.revokeObjectURL(p.url);
    };
  }, [pendingPreviews]);

  // ---------- Sorted photos -----------------------------------------------

  const sortedPhotos = useMemo(
    () => sortPhotos(photos, sortMode),
    [photos, sortMode]
  );

  // ---------- File pickers ------------------------------------------------

  function clearInputs() {
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (libraryInputRef.current) libraryInputRef.current.value = "";
  }

  function onPickFiles(e) {
    const files = Array.from(e.target.files || []).filter((f) =>
      (f.type || "").startsWith("image/")
    );
    if (files.length === 0) return;
    setPendingFiles((prev) => [...prev, ...files]);
    if (!pendingFiles.length) {
      setPendingDate(todayLocalDate());
      setPendingNote("");
    }
    clearInputs();
  }

  function removePending(idx) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function cancelPending() {
    setPendingFiles([]);
    setPendingNote("");
    clearInputs();
  }

  async function savePending() {
    if (pendingFiles.length === 0 || saving) return;
    setSaving(true);
    try {
      const date = pendingDate || todayLocalDate();
      const note = pendingNote;
      const saved = [];
      for (const file of pendingFiles) {
        try {
          const row = await addProgressPhoto({ blob: file, date, note });
          if (row) {
            const url = URL.createObjectURL(row.blob);
            saved.push({ ...row, url });
          }
        } catch (err) {
          console.warn("[progress-photos] save failed for one file:", err?.message);
        }
      }
      if (saved.length > 0) {
        setPhotos((prev) => [...saved, ...prev]);
      }
      setPendingFiles([]);
      setPendingNote("");
      clearInputs();
    } catch (err) {
      alert(err?.message || "Could not save photos.");
    } finally {
      setSaving(false);
    }
  }

  // ---------- Edit / delete -----------------------------------------------

  function beginEditNote(photo) {
    setEditingNoteId(photo.id);
    setEditingNoteDraft(photo.note || "");
  }

  function cancelEditNote() {
    setEditingNoteId(null);
    setEditingNoteDraft("");
  }

  async function saveEditNote() {
    if (!editingNoteId || savingNote) return;
    setSavingNote(true);
    try {
      const updated = await updateProgressPhotoNote(
        editingNoteId,
        editingNoteDraft
      );
      if (updated) {
        setPhotos((prev) =>
          prev.map((p) =>
            p.id === editingNoteId ? { ...p, note: updated.note } : p
          )
        );
      }
      cancelEditNote();
    } catch (err) {
      alert(err?.message || "Could not save note.");
    } finally {
      setSavingNote(false);
    }
  }

  async function doDelete(id) {
    await deleteProgressPhoto(id);
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.url) URL.revokeObjectURL(target.url);
      return prev.filter((p) => p.id !== id);
    });
    setConfirmDelete(null);
  }

  async function doBulkDelete() {
    const ids = Array.from(selected);
    for (const id of ids) {
      try {
        await deleteProgressPhoto(id);
      } catch (err) {
        console.warn("[progress-photos] bulk delete failed for id:", id, err?.message);
      }
    }
    setPhotos((prev) => {
      for (const p of prev) {
        if (selected.has(p.id) && p.url) URL.revokeObjectURL(p.url);
      }
      return prev.filter((p) => !selected.has(p.id));
    });
    exitSelectionMode();
    setConfirmBulkDelete(false);
  }

  // ---------- Multi-select -----------------------------------------------

  function enterSelectionMode() {
    setSelectionMode(true);
    setSelected(new Set());
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelected(new Set());
  }

  function toggleSelected(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onCardClick(photo, displayIndex) {
    if (selectionMode) {
      toggleSelected(photo.id);
      return;
    }
    setViewerIndex(displayIndex);
  }

  const selectedPhotos = useMemo(
    () => sortedPhotos.filter((p) => selected.has(p.id)),
    [sortedPhotos, selected]
  );

  function openShare() {
    if (selectedPhotos.length === 0) return;
    setShareOpen(true);
  }

  // ---------- Render -------------------------------------------------------

  const hasPending = pendingFiles.length > 0;
  const selectedCount = selected.size;

  return (
    <div
      style={{
        padding: 16,
        paddingTop: "calc(16px + var(--safe-area-top))",
        paddingBottom: "calc(80px + var(--safe-area-bottom))",
        color: "var(--text)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Back"
          style={iconBtn}
        >
          <FaArrowLeft />
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, flex: 1 }}>
          Progress Photos
        </h1>
        {photos.length > 0 && !selectionMode && !hasPending && (
          <button
            type="button"
            onClick={enterSelectionMode}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--card-2)",
              color: "var(--text)",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Select
          </button>
        )}
      </header>

      <div
        style={{
          fontSize: 12,
          opacity: 0.75,
          marginTop: -4,
          marginBottom: 14,
          lineHeight: 1.45,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div>Upload progress photos anytime.</div>
        <div>
          Many users upload at least one photo weekly to track changes over time.
        </div>
        <div style={{ opacity: 0.85 }}>
          Photos are stored privately on this device.
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPickFiles}
        style={{ display: "none" }}
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onPickFiles}
        style={{ display: "none" }}
      />

      {/* Add / batch upload */}
      <div
        style={{
          background: "var(--card-2)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: 12,
          marginBottom: 14,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {!hasPending && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              style={primaryBtn}
            >
              <FaCamera style={{ marginRight: 8 }} />
              Take photo
            </button>
            <button
              type="button"
              onClick={() => libraryInputRef.current?.click()}
              style={secondaryBtn}
            >
              <FaImages style={{ marginRight: 8 }} />
              Choose from library
            </button>
          </div>
        )}

        {hasPending && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              {pendingPreviews.map((p, idx) => (
                <div
                  key={p.key + idx}
                  style={{
                    position: "relative",
                    borderRadius: 10,
                    overflow: "hidden",
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                  }}
                >
                  <img
                    src={p.url}
                    alt={`Selected ${idx + 1}`}
                    style={{
                      width: "100%",
                      aspectRatio: "1 / 1",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                  <button
                    type="button"
                    aria-label="Remove selection"
                    onClick={() => removePending(idx)}
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      width: 24,
                      height: 24,
                      borderRadius: 999,
                      border: "none",
                      background: "rgba(0,0,0,0.65)",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: 12,
                      lineHeight: 1,
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                style={subtleBtn}
              >
                <FaCamera style={{ marginRight: 6 }} />
                Add from camera
              </button>
              <button
                type="button"
                onClick={() => libraryInputRef.current?.click()}
                style={subtleBtn}
              >
                <FaImages style={{ marginRight: 6 }} />
                Add from library
              </button>
            </div>

            <label style={fieldLabel}>Date</label>
            <input
              type="date"
              value={pendingDate}
              onChange={(e) => setPendingDate(e.target.value)}
              style={inputStyle}
            />
            <label style={fieldLabel}>Note (optional)</label>
            <textarea
              rows={2}
              value={pendingNote}
              onChange={(e) => setPendingNote(e.target.value)}
              placeholder="A short note for this batch"
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={cancelPending}
                style={secondaryBtn}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={savePending}
                disabled={saving}
                style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}
              >
                {saving
                  ? "Saving…"
                  : pendingFiles.length > 1
                  ? `Save ${pendingFiles.length} photos`
                  : "Save photo"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Sort control */}
      {photos.length > 0 && !selectionMode && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <label
            htmlFor="pp-sort"
            style={{ fontSize: 12, opacity: 0.7 }}
          >
            Sort
          </label>
          <select
            id="pp-sort"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
            style={{
              padding: "6px 8px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--card-2)",
              color: "var(--text)",
              fontSize: 13,
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Multi-select toolbar */}
      {selectionMode && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "8px 10px",
            marginBottom: 10,
            borderRadius: 12,
            border: "1px solid var(--accent)",
            background: "color-mix(in srgb, var(--accent) 12%, transparent)",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {selectedCount} selected
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={exitSelectionMode}
              style={{ ...subtleBtn, padding: "6px 10px" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={openShare}
              disabled={selectedCount === 0}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--card)",
                color: "var(--text)",
                fontWeight: 800,
                cursor: selectedCount === 0 ? "default" : "pointer",
                opacity: selectedCount === 0 ? 0.5 : 1,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <FaPaperPlane />
              Send
            </button>
            <button
              type="button"
              onClick={() => setConfirmBulkDelete(true)}
              disabled={selectedCount === 0}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "none",
                background: "var(--accent)",
                color: "var(--text)",
                fontWeight: 800,
                cursor: selectedCount === 0 ? "default" : "pointer",
                opacity: selectedCount === 0 ? 0.5 : 1,
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Gallery */}
      {loading ? (
        <div style={{ fontSize: 13, opacity: 0.7 }}>Loading…</div>
      ) : sortedPhotos.length === 0 ? (
        <div
          style={{
            fontSize: 13,
            opacity: 0.7,
            padding: 16,
            textAlign: "center",
            border: "1px dashed var(--border)",
            borderRadius: 12,
          }}
        >
          No photos yet. Use "Take photo" or "Choose from library" to add your first one.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          {sortedPhotos.map((p, displayIndex) => {
            const isSelected = selected.has(p.id);
            return (
              <div
                key={p.id}
                style={{
                  position: "relative",
                  borderRadius: 12,
                  overflow: "hidden",
                  border: isSelected
                    ? "2px solid var(--accent)"
                    : "1px solid var(--border)",
                  background: "var(--card)",
                  transition: "border-color 120ms ease",
                }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onCardClick(p, displayIndex)}
                  style={{
                    cursor: "pointer",
                    position: "relative",
                  }}
                >
                  {p.url ? (
                    <img
                      src={p.url}
                      alt={p.date}
                      draggable={false}
                      style={{
                        width: "100%",
                        aspectRatio: "1 / 1",
                        objectFit: "cover",
                        display: "block",
                        opacity: selectionMode && !isSelected ? 0.78 : 1,
                        transition: "opacity 120ms ease",
                        // Preserve native iOS long-press (Save/Copy/Share) when
                        // we're NOT in selection mode. In selection mode we
                        // suppress it so taps register cleanly.
                        WebkitTouchCallout: selectionMode ? "none" : "default",
                        WebkitUserSelect: selectionMode ? "none" : "auto",
                        userSelect: selectionMode ? "none" : "auto",
                        pointerEvents: selectionMode ? "none" : "auto",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        aspectRatio: "1 / 1",
                        background: "var(--card-2)",
                      }}
                    />
                  )}

                  {selectionMode && (
                    <div
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        top: 6,
                        left: 6,
                        width: 24,
                        height: 24,
                        borderRadius: 999,
                        background: isSelected
                          ? "var(--accent)"
                          : "rgba(0,0,0,0.55)",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: isSelected
                          ? "2px solid #fff"
                          : "2px solid rgba(255,255,255,0.6)",
                        fontSize: 12,
                        fontWeight: 900,
                        pointerEvents: "none",
                      }}
                    >
                      {isSelected ? <FaCheck /> : ""}
                    </div>
                  )}
                </div>

                {!selectionMode && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 8px",
                      fontSize: 12,
                      background: "var(--card-2)",
                      gap: 8,
                    }}
                  >
                    <span style={{ opacity: 0.85 }}>{p.date}</span>
                    <span style={{ display: "flex", gap: 10 }}>
                      <button
                        type="button"
                        aria-label="Edit note"
                        onClick={(e) => {
                          e.stopPropagation();
                          beginEditNote(p);
                        }}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "var(--text)",
                          cursor: "pointer",
                          opacity: 0.85,
                        }}
                      >
                        <FaEdit />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete photo"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDelete(p.id);
                        }}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "var(--accent)",
                          cursor: "pointer",
                        }}
                      >
                        <FaTrash />
                      </button>
                    </span>
                  </div>
                )}

                {!selectionMode && editingNoteId === p.id ? (
                  <div
                    style={{
                      padding: 8,
                      background: "var(--card-2)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <textarea
                      rows={2}
                      value={editingNoteDraft}
                      onChange={(e) => setEditingNoteDraft(e.target.value)}
                      placeholder="Add a note"
                      style={{
                        ...inputStyle,
                        fontSize: 12,
                        padding: 6,
                        resize: "vertical",
                      }}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        onClick={cancelEditNote}
                        style={{ ...subtleBtn, padding: "6px 8px" }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={saveEditNote}
                        disabled={savingNote}
                        style={{
                          ...primaryBtn,
                          padding: "6px 8px",
                          opacity: savingNote ? 0.6 : 1,
                        }}
                      >
                        {savingNote ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                ) : (
                  !selectionMode &&
                  p.note && (
                    <div
                      style={{
                        padding: "4px 8px 8px 8px",
                        fontSize: 11,
                        opacity: 0.7,
                        background: "var(--card-2)",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {p.note}
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Single delete confirm */}
      {confirmDelete && (
        <div style={modalBackdrop} onClick={() => setConfirmDelete(null)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Delete this photo?</h3>
            <p style={{ fontSize: 13, opacity: 0.7 }}>
              This will remove the photo from this device.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                style={secondaryBtn}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => doDelete(confirmDelete)}
                style={primaryBtn}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk delete confirm */}
      {confirmBulkDelete && (
        <div style={modalBackdrop} onClick={() => setConfirmBulkDelete(false)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>
              Delete {selectedCount} photo{selectedCount === 1 ? "" : "s"}?
            </h3>
            <p style={{ fontSize: 13, opacity: 0.7 }}>
              This will remove the selected photos from this device.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setConfirmBulkDelete(false)}
                style={secondaryBtn}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={doBulkDelete}
                style={primaryBtn}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen viewer */}
      {viewerIndex !== null && sortedPhotos[viewerIndex] && (
        <ProgressPhotoViewer
          photos={sortedPhotos}
          startIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}

      {/* Send-to-friends modal (uses the existing chat-images bucket + messages
          table — no parallel media system) */}
      <ShareProgressPhotosModal
        open={shareOpen}
        photos={selectedPhotos}
        onClose={() => setShareOpen(false)}
        onSent={() => exitSelectionMode()}
      />
    </div>
  );
}

const iconBtn = {
  width: 36,
  height: 36,
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--card-2)",
  color: "var(--text)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const inputStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--text)",
  fontSize: 14,
  boxSizing: "border-box",
};

const fieldLabel = {
  fontSize: 12,
  opacity: 0.7,
  marginBottom: -4,
};

const primaryBtn = {
  flex: 1,
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  background: "var(--accent)",
  color: "var(--text)",
  fontWeight: 800,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const secondaryBtn = {
  flex: 1,
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--text)",
  fontWeight: 700,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const subtleBtn = {
  flex: 1,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--text)",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const modalBackdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  zIndex: 10000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const modal = {
  width: "100%",
  maxWidth: 360,
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  padding: 16,
  color: "var(--text)",
};
