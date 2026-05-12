// Per-workout one-shot local notifications (Capacitor). Reminder config is
// device-local (localStorage). IDs are deterministic from workout UUID.
// Core workout CRUD must never depend on this module throwing.

import { LocalNotifications } from "@capacitor/local-notifications";
import {
  isNativeNotificationsSupported,
  checkPermissions,
  requestPermissions,
} from "./nativeLocalNotifications";

const WLOG = "[ArmPal.WorkoutReminder]";

const STORAGE_KEY_PREFIX = "armpal_workout_ntf_cfg_v1_";

export const DEFAULT_CUSTOM_REMINDER_MINUTES = 15;
export const MAX_CUSTOM_REMINDER_MINUTES = 10080; // 7 days

const CUSTOM_DEFAULT_MINUTES = DEFAULT_CUSTOM_REMINDER_MINUTES;
const MAX_OFFSET_MINUTES = MAX_CUSTOM_REMINDER_MINUTES;

/** Keep IDs away from global reminder IDs (1001–1004) and stay in 32-bit range */
const ID_BIAS = 3_000_000;
const ID_SPAN = 2_100_000_000;

// ---------------------------------------------------------------------------
// Notification ID — deterministic from workout UUID
// ---------------------------------------------------------------------------

export function workoutNotificationId(workoutId) {
  const key = workoutId != null && workoutId !== "" ? String(workoutId) : "";
  if (!key) return ID_BIAS;
  let h = 5381;
  for (let i = 0; i < key.length; i++) {
    h = (h * 33) ^ key.charCodeAt(i);
    h |= 0;
  }
  return ID_BIAS + (Math.abs(h) % ID_SPAN);
}

// ---------------------------------------------------------------------------
// Local-storage config persistence (per user)
// ---------------------------------------------------------------------------

function storageKey(userId) {
  return STORAGE_KEY_PREFIX + (userId || "anon");
}

function readMap(userId) {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return {};
    const o = JSON.parse(raw);
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

function writeMap(userId, map) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(map));
  } catch (e) {
    console.warn(WLOG, "save map failed:", e?.message);
  }
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Parse YYYY-MM-DDTHH:mm (datetime-local) as wall-clock local time. */
export function parseLocalDatetimeInput(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const da = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const se = m[6] != null ? Number(m[6]) : 0;
  if ([y, mo, da, h, mi, se].some((n) => !Number.isFinite(n))) return null;
  const d = new Date(y, mo, da, h, mi, se, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function defaultCustomReminderDatetimeLocal(offsetMs = 60 * 60 * 1000) {
  const d = new Date(Date.now() + Math.max(60_000, offsetMs));
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function shiftDatetimeLocalByMinutes(base, deltaMinutes) {
  const baseDate = parseLocalDatetimeInput(base != null ? String(base) : "") || new Date();
  const add = Number(deltaMinutes);
  if (Number.isFinite(add)) {
    baseDate.setMinutes(baseDate.getMinutes() + add);
  }
  const pad = (n) => String(n).padStart(2, "0");
  return `${baseDate.getFullYear()}-${pad(baseDate.getMonth() + 1)}-${pad(baseDate.getDate())}T${pad(baseDate.getHours())}:${pad(baseDate.getMinutes())}`;
}

function sliceDatetimeLocal16(v) {
  if (v == null || typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.length >= 16 ? t.slice(0, 16) : t;
}

function toLocalISO(d) {
  if (!d || !(d instanceof Date)) return String(d);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ---------------------------------------------------------------------------
// Config CRUD
// ---------------------------------------------------------------------------

export function getWorkoutReminderConfig(userId, workoutId) {
  try {
    if (!userId || workoutId == null || workoutId === "") {
      return { mode: "none", customOffsetMinutes: CUSTOM_DEFAULT_MINUTES, customFireAt: null };
    }
    const wid = String(workoutId);
    const map = readMap(userId);
    const row = map?.[wid];
    const mode = row?.mode && typeof row.mode === "string" ? row.mode : "none";
    const stored = Number(row?.customOffsetMinutes);
    const hasStoredCustom = mode === "custom" && Number.isFinite(stored) && stored > 0;
    const customOffsetMinutes =
      mode === "custom"
        ? hasStoredCustom
          ? Math.round(Math.min(MAX_OFFSET_MINUTES, Math.max(1, stored)))
          : CUSTOM_DEFAULT_MINUTES
        : CUSTOM_DEFAULT_MINUTES;
    const customFireAt =
      mode === "custom" && typeof row?.customFireAt === "string" && row.customFireAt.trim()
        ? sliceDatetimeLocal16(row.customFireAt)
        : null;
    return { mode, customOffsetMinutes, customFireAt };
  } catch {
    return { mode: "none", customOffsetMinutes: CUSTOM_DEFAULT_MINUTES, customFireAt: null };
  }
}

export function saveWorkoutReminderConfig(userId, workoutId, partial) {
  try {
    if (!userId || workoutId == null || workoutId === "" || !partial || typeof partial !== "object") return;
    const wid = String(workoutId);
    const map = readMap(userId);
    const mode = typeof partial.mode === "string" && partial.mode ? partial.mode : "none";
    const rawFire =
      mode === "custom" && partial.customFireAt != null
        ? String(partial.customFireAt).trim()
        : "";
    const row = {
      mode,
      customOffsetMinutes: Math.max(1, Math.min(MAX_OFFSET_MINUTES, Math.round(Number(partial.customOffsetMinutes) || CUSTOM_DEFAULT_MINUTES))),
      customFireAt: mode === "custom" && rawFire ? sliceDatetimeLocal16(rawFire) : null,
    };
    if (mode !== "custom") row.customFireAt = null;
    map[wid] = row;
    writeMap(userId, map);
  } catch (e) {
    console.warn(WLOG, "saveWorkoutReminderConfig:", e?.message);
  }
}

export function removeWorkoutReminderConfig(userId, workoutId) {
  try {
    if (!userId || workoutId == null || workoutId === "") return;
    const wid = String(workoutId);
    const map = readMap(userId);
    if (map[wid]) {
      delete map[wid];
      writeMap(userId, map);
    }
  } catch (e) {
    console.warn(WLOG, "removeWorkoutReminderConfig:", e?.message);
  }
}

export function isLocalNotificationsRuntimeUsable() {
  return isNativeNotificationsSupported();
}

export const isLocalNotificationsAvailable = isLocalNotificationsRuntimeUsable;

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

export async function cancelWorkoutScheduledNotification(workoutId) {
  try {
    if (workoutId == null || workoutId === "") return;
    if (!isNativeNotificationsSupported()) return;
    const id = workoutNotificationId(String(workoutId));
    console.log(WLOG, "cancel", { workoutId, notificationId: id });
    await LocalNotifications.cancel({ notifications: [{ id }] });
    console.log(WLOG, "cancel OK", { id });
  } catch (e) {
    console.warn(WLOG, "cancel failed (non-fatal):", e?.message);
  }
}

/**
 * Remove device-local reminder prefs and cancel native notification without
 * blocking callers. Never throws.
 */
export function safeStripWorkoutReminderAfterDelete(userId, workoutId) {
  try {
    if (userId != null && workoutId != null && workoutId !== "") {
      removeWorkoutReminderConfig(String(userId), String(workoutId));
    }
  } catch (e) {
    console.warn(WLOG, "safeStrip storage:", e?.message);
  }
  void cancelWorkoutScheduledNotification(workoutId).catch((e) =>
    console.warn(WLOG, "safeStrip cancel:", e?.message)
  );
}

export function pruneWorkoutReminderConfigs(userId, validWorkoutIds) {
  try {
    if (!userId || !validWorkoutIds) return;
    const set = new Set(
      (Array.isArray(validWorkoutIds) ? validWorkoutIds : [])
        .filter((id) => id != null && id !== "")
        .map((id) => String(id))
    );
    const map = readMap(userId);
    let changed = false;
    for (const k of Object.keys(map)) {
      if (!set.has(k)) { delete map[k]; changed = true; }
    }
    if (changed) writeMap(userId, map);
  } catch (e) {
    console.warn(WLOG, "pruneWorkoutReminderConfigs:", e?.message);
  }
}

// ---------------------------------------------------------------------------
// Offset / title helpers
// ---------------------------------------------------------------------------

function offsetMinutesForPreset(mode) {
  switch (mode) {
    case "at": return 0;
    case "m15": return 15;
    case "m30": return 30;
    case "h1": return 60;
    default: return null;
  }
}

function presetLabel(mode) {
  switch (mode) {
    case "at": return "At workout time";
    case "m15": return "15 min before";
    case "m30": return "30 min before";
    case "h1": return "1 hour before";
    case "custom": return "Custom";
    default: return mode;
  }
}

function buildTitleBody(workoutName, mode, offsetMin, fireAt) {
  const name = (workoutName || "Workout").trim() || "Workout";
  if (mode === "at") return { title: "Workout reminder", body: name };
  if (mode === "custom") {
    const when = fireAt.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
    return { title: "Workout reminder", body: `${name} — ${when}` };
  }
  if (offsetMin === 15) return { title: name, body: `${name} starts in 15 minutes` };
  if (offsetMin === 30) return { title: name, body: `${name} starts in 30 minutes` };
  if (offsetMin === 60) return { title: name, body: `${name} starts in 1 hour` };
  return { title: name, body: `${name} — reminder` };
}

// ---------------------------------------------------------------------------
// computeWorkoutReminderPreview — for the diagnostic display in modal
// ---------------------------------------------------------------------------

export function computeWorkoutReminderPreview({
  workoutId,
  scheduledFor,
  reminderMode,
  customOffsetMinutes,
  customFireAt,
}) {
  const mode = typeof reminderMode === "string" ? reminderMode : "none";
  if (mode === "none" || workoutId == null || workoutId === "") {
    return { fireAt: null, isFuture: false, notificationId: null, reason: "mode-none" };
  }

  const wid = String(workoutId);
  const nid = workoutNotificationId(wid);
  const now = Date.now();

  if (mode === "custom") {
    const rawC = customFireAt != null ? String(customFireAt).trim() : "";
    const abs = rawC ? parseLocalDatetimeInput(rawC) : null;
    if (abs && abs.getTime() > now) {
      return { fireAt: abs, isFuture: true, notificationId: nid, reason: null };
    }
    const start = parseLocalDatetimeInput(scheduledFor != null ? String(scheduledFor).trim() : "");
    if (!start) {
      return { fireAt: null, isFuture: false, notificationId: nid, reason: "custom-needs-time" };
    }
    const offMin = Math.max(1, Math.min(MAX_OFFSET_MINUTES, Math.round(Number(customOffsetMinutes) || CUSTOM_DEFAULT_MINUTES)));
    const f = new Date(start.getTime() - offMin * 60_000);
    return { fireAt: f, isFuture: f.getTime() > now, notificationId: nid, reason: f.getTime() <= now ? "reminder-past" : null };
  }

  const offsetMin = offsetMinutesForPreset(mode);
  if (offsetMin === null) {
    return { fireAt: null, isFuture: false, notificationId: nid, reason: "unknown-mode" };
  }
  const start = parseLocalDatetimeInput(scheduledFor != null ? String(scheduledFor).trim() : "");
  if (!start) {
    return { fireAt: null, isFuture: false, notificationId: nid, reason: "no-scheduled-for" };
  }
  const f = new Date(start.getTime() - offsetMin * 60_000);
  return { fireAt: f, isFuture: f.getTime() > now, notificationId: nid, reason: f.getTime() <= now ? "reminder-past" : null };
}

// ---------------------------------------------------------------------------
// syncWorkoutScheduledNotification — the REAL scheduling pipeline
// ---------------------------------------------------------------------------

export async function syncWorkoutScheduledNotification({
  workoutId,
  workoutName,
  scheduledFor,
  reminderMode,
  customOffsetMinutes,
  customFireAt,
}) {
  const now = Date.now();
  const step = (n, msg, data) => console.log(WLOG, `sync step${n}: ${msg}`, data ?? "");

  step(0, "ENTRY", {
    workoutId,
    workoutName,
    scheduledFor,
    reminderMode,
    customOffsetMinutes,
    customFireAt,
    nowLocal: toLocalISO(new Date(now)),
    nowUTC: new Date(now).toISOString(),
  });

  // STEP 1 — cancel existing
  try {
    await cancelWorkoutScheduledNotification(workoutId);
    step(1, "cancelled existing notification");
  } catch (e) {
    step(1, "cancel failed (non-fatal)", e?.message);
  }

  // STEP 2 — bail if mode is none or no workoutId
  if (workoutId == null || workoutId === "" || reminderMode === "none") {
    step(2, "BAIL: no workoutId or mode=none");
    return { ok: true, scheduled: false, reason: "mode-none" };
  }

  const wid = String(workoutId);
  const mode = typeof reminderMode === "string" ? reminderMode : "none";

  // STEP 3 — compute fireAt
  let fireAt = null;
  let offsetUsed = null;
  let titleBody = null;

  if (mode === "custom") {
    const rawC = customFireAt != null ? String(customFireAt).trim() : "";
    const abs = rawC ? parseLocalDatetimeInput(rawC) : null;
    step(3, "custom mode", { rawC, absValid: !!abs, absFuture: abs ? abs.getTime() > now : false });

    if (abs && abs.getTime() > now) {
      fireAt = abs;
      titleBody = buildTitleBody(workoutName, "custom", 0, abs);
    } else {
      const start = parseLocalDatetimeInput(scheduledFor != null ? String(scheduledFor).trim() : "");
      if (!start) {
        step(3, "BAIL: custom mode, no abs and no scheduledFor");
        return { ok: true, scheduled: false, reason: "custom-needs-time" };
      }
      offsetUsed = Math.max(1, Math.min(MAX_OFFSET_MINUTES, Math.round(Number(customOffsetMinutes) || CUSTOM_DEFAULT_MINUTES)));
      fireAt = new Date(start.getTime() - offsetUsed * 60_000);
      titleBody = buildTitleBody(workoutName, "custom", offsetUsed, fireAt);
      step(3, "custom mode: computed from scheduledFor minus offset", {
        startLocal: toLocalISO(start),
        offsetMinutes: offsetUsed,
        fireAtLocal: toLocalISO(fireAt),
      });
    }
  } else {
    offsetUsed = offsetMinutesForPreset(mode);
    if (offsetUsed === null) {
      step(3, "BAIL: unknown preset mode", { mode });
      return { ok: true, scheduled: false, reason: "unknown-mode" };
    }
    const start = parseLocalDatetimeInput(scheduledFor != null ? String(scheduledFor).trim() : "");
    if (!start) {
      step(3, "BAIL: preset mode but no scheduledFor", { mode, scheduledFor });
      return { ok: true, scheduled: false, reason: "bad-date" };
    }
    fireAt = new Date(start.getTime() - offsetUsed * 60_000);
    titleBody = buildTitleBody(workoutName, mode, offsetUsed, fireAt);
    step(3, `preset mode "${mode}" (${presetLabel(mode)})`, {
      startLocal: toLocalISO(start),
      startISO: start.toISOString(),
      offsetMinutes: offsetUsed,
      fireAtLocal: toLocalISO(fireAt),
      fireAtISO: fireAt.toISOString(),
    });
  }

  // STEP 4 — validate fireAt is future
  const isFuture = fireAt && fireAt.getTime() > now;
  step(4, "fireAt check", {
    fireAtLocal: fireAt ? toLocalISO(fireAt) : null,
    fireAtMs: fireAt?.getTime(),
    nowMs: now,
    diffMs: fireAt ? fireAt.getTime() - now : null,
    diffSeconds: fireAt ? Math.round((fireAt.getTime() - now) / 1000) : null,
    isFuture,
  });

  if (!isFuture) {
    step(4, "BAIL: reminder time is in the past");
    return { ok: true, scheduled: false, reason: "reminder-past", fireAt: fireAt ? toLocalISO(fireAt) : null };
  }

  // STEP 5 — native platform check
  if (!isNativeNotificationsSupported()) {
    step(5, "BAIL: not native platform");
    return { ok: true, scheduled: false, reason: "not-native" };
  }
  step(5, "native platform OK");

  // STEP 6 — permission check
  let permResult;
  try {
    permResult = await checkPermissions();
    step(6, "checkPermissions", permResult);
    if (!permResult.granted) {
      if (permResult.display === "denied") {
        step(6, "BAIL: permission denied");
        return { ok: true, scheduled: false, reason: "denied" };
      }
      const reqResult = await requestPermissions();
      step(6, "requestPermissions", reqResult);
      if (!reqResult.granted) {
        step(6, "BAIL: permission not granted after request");
        return { ok: true, scheduled: false, reason: "denied" };
      }
    }
  } catch (e) {
    step(6, "BAIL: permission check threw", e?.message);
    return { ok: true, scheduled: false, reason: "denied", nativeError: e?.message };
  }

  // STEP 7 — build notification payload
  const notificationId = workoutNotificationId(wid);
  const { title, body } = titleBody || { title: "Workout reminder", body: workoutName || "Workout" };
  const payload = {
    id: notificationId,
    title: String(title).slice(0, 200),
    body: String(body).slice(0, 500),
    schedule: { at: fireAt, allowWhileIdle: true },
    extra: { source: "armpal-workout-reminder", workoutId: wid },
  };

  step(7, "notification payload", {
    id: payload.id,
    title: payload.title,
    body: payload.body,
    scheduleAt: fireAt.toISOString(),
    scheduleAtLocal: toLocalISO(fireAt),
    firesInSeconds: Math.round((fireAt.getTime() - Date.now()) / 1000),
  });

  // STEP 8 — call LocalNotifications.schedule() DIRECTLY
  try {
    console.log(WLOG, "step8: calling LocalNotifications.schedule() …");
    await LocalNotifications.schedule({ notifications: [payload] });
    step(8, "LocalNotifications.schedule() SUCCESS");
  } catch (e) {
    const msg = e?.message || String(e);
    console.error(WLOG, "step8: LocalNotifications.schedule() EXACT THROW", e, msg);
    return { ok: false, scheduled: false, reason: "schedule-error", nativeError: msg };
  }

  // STEP 9 — verify pending
  let pendingCount = null;
  try {
    const pending = await LocalNotifications.getPending();
    pendingCount = pending?.notifications?.length ?? 0;
    const ours = pending?.notifications?.find((n) => n.id === notificationId);
    step(9, "getPending after schedule", { pendingCount, ourNotificationFound: !!ours });
  } catch (e) {
    step(9, "getPending failed (non-fatal)", e?.message);
  }

  console.log(WLOG, "syncWorkoutScheduledNotification DONE — notification is scheduled", {
    notificationId,
    fireAtLocal: toLocalISO(fireAt),
    firesInSeconds: Math.round((fireAt.getTime() - Date.now()) / 1000),
    pendingCount,
  });

  return { ok: true, scheduled: true, notificationId, fireAt: toLocalISO(fireAt), pendingCount };
}

// ---------------------------------------------------------------------------
// applyWorkoutReminderAfterSave — persists config then schedules
// ---------------------------------------------------------------------------

export async function applyWorkoutReminderAfterSave({
  userId,
  workoutId,
  workoutName,
  scheduledFor,
  reminderMode,
  customOffsetMinutes,
  customFireAt,
}) {
  try {
    if (!userId || workoutId == null || workoutId === "") return { ok: true };

    const wid = String(workoutId);
    const mode = typeof reminderMode === "string" ? reminderMode : "none";
    if (mode === "none") {
      removeWorkoutReminderConfig(userId, wid);
      void cancelWorkoutScheduledNotification(wid).catch(() => {});
      return { ok: true };
    }

    const hasSchedule = !!(scheduledFor && String(scheduledFor).trim());
    const presetModes = new Set(["at", "m15", "m30", "h1"]);
    if (presetModes.has(mode) && !hasSchedule) {
      removeWorkoutReminderConfig(userId, wid);
      void cancelWorkoutScheduledNotification(wid).catch(() => {});
      return { ok: true, skipped: true, reason: "preset-needs-schedule" };
    }

    const safeOffset = Number(customOffsetMinutes) > 0 ? Number(customOffsetMinutes) : DEFAULT_CUSTOM_REMINDER_MINUTES;

    let fireSlice = null;
    if (mode === "custom") {
      const raw = customFireAt != null ? String(customFireAt).trim() : "";
      const abs = raw ? parseLocalDatetimeInput(raw) : null;
      if (abs && abs.getTime() > Date.now()) {
        fireSlice = sliceDatetimeLocal16(raw);
      }
    }

    if (mode === "custom" && !fireSlice && !hasSchedule) {
      removeWorkoutReminderConfig(userId, wid);
      void cancelWorkoutScheduledNotification(wid).catch(() => {});
      return { ok: true, skipped: true, reason: "custom-needs-time" };
    }

    saveWorkoutReminderConfig(userId, wid, {
      mode,
      customOffsetMinutes: safeOffset,
      customFireAt: fireSlice,
    });

    const syncRes = await syncWorkoutScheduledNotification({
      workoutId: wid,
      workoutName,
      scheduledFor,
      reminderMode: mode,
      customOffsetMinutes: safeOffset,
      customFireAt: fireSlice,
    });

    return { ok: true, syncRes };
  } catch (e) {
    console.error(WLOG, "applyWorkoutReminderAfterSave:", e?.message, e);
    return { ok: false, error: true };
  }
}

// ---------------------------------------------------------------------------
// testWorkoutReminderPipeline15s — uses the REAL pipeline with 15s fire time
// ---------------------------------------------------------------------------

export async function testWorkoutReminderPipeline15s({ workoutId, workoutName }) {
  console.log(WLOG, "testWorkoutReminderPipeline15s ENTRY", { workoutId, workoutName });

  if (!workoutId) {
    return { ok: false, reason: "no-workoutId", detail: "Save the workout first to get an ID." };
  }

  const fireAt = new Date(Date.now() + 15_000);
  const scheduledFor = toLocalISO(fireAt);

  const result = await syncWorkoutScheduledNotification({
    workoutId,
    workoutName: workoutName || "Test Workout",
    scheduledFor,
    reminderMode: "at",
    customOffsetMinutes: DEFAULT_CUSTOM_REMINDER_MINUTES,
    customFireAt: null,
  });

  console.log(WLOG, "testWorkoutReminderPipeline15s RESULT", result);
  return result;
}

/** Stable names for callers; never throw into workout CRUD. */
export async function safeScheduleWorkoutReminder(opts) {
  return applyWorkoutReminderAfterSave(opts);
}

export async function safeCancelWorkoutReminder(workoutId) {
  return cancelWorkoutScheduledNotification(workoutId);
}
