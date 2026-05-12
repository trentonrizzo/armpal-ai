// src/services/progressPhotosLocal.js
//
// Local-device-only progress-photo store. No uploads, no Supabase Storage,
// no Firebase, no external service. Photos and their metadata live in
// IndexedDB on the user's device.
//
// Schema (object store "photos"):
//   {
//     id:        string      // generated locally
//     userId:    string      // current Supabase user id (or "anon")
//     date:      string      // YYYY-MM-DD (local)
//     note:      string
//     createdAt: string      // ISO timestamp
//     blob:      Blob        // the actual image bytes
//   }

const DB_NAME = "armpal_progress_photos_v1";
const STORE = "photos";

function isBrowser() {
  return typeof window !== "undefined" && !!window.indexedDB;
}

function openDb() {
  if (!isBrowser()) return Promise.reject(new Error("indexedDB unavailable"));
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("by_userId_createdAt", ["userId", "createdAt"], {
          unique: false,
        });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("indexedDB open failed"));
  });
}

function tx(db, mode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getCurrentUserId() {
  try {
    const mod = await import("../supabaseClient");
    const { data } = await mod.supabase.auth.getUser();
    return data?.user?.id || "anon";
  } catch {
    return "anon";
  }
}

function makeId() {
  return `pp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function addProgressPhoto({ blob, date, note }) {
  if (!isBrowser()) return null;
  const db = await openDb();
  const userId = await getCurrentUserId();
  const row = {
    id: makeId(),
    userId,
    date: date || new Date().toISOString().slice(0, 10),
    note: (note || "").slice(0, 500),
    createdAt: new Date().toISOString(),
    blob,
  };
  await reqToPromise(tx(db, "readwrite").add(row));
  return row;
}

export async function listProgressPhotos() {
  if (!isBrowser()) return [];
  const db = await openDb();
  const userId = await getCurrentUserId();
  const all = await reqToPromise(tx(db, "readonly").getAll());
  return (all || [])
    .filter((row) => row.userId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function deleteProgressPhoto(id) {
  if (!isBrowser() || !id) return;
  const db = await openDb();
  await reqToPromise(tx(db, "readwrite").delete(id));
}

export async function updateProgressPhotoNote(id, note) {
  if (!isBrowser() || !id) return null;
  const db = await openDb();
  const store = tx(db, "readwrite");
  const existing = await reqToPromise(store.get(id));
  if (!existing) return null;
  const updated = { ...existing, note: (note || "").slice(0, 500) };
  await reqToPromise(tx(db, "readwrite").put(updated));
  return updated;
}

export async function countProgressPhotosSince(sinceIso) {
  if (!isBrowser()) return 0;
  try {
    const userId = await getCurrentUserId();
    const db = await openDb();
    const all = await reqToPromise(tx(db, "readonly").getAll());
    return (all || []).filter(
      (row) => row.userId === userId && row.createdAt >= sinceIso
    ).length;
  } catch {
    return 0;
  }
}
