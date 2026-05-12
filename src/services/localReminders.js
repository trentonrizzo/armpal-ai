// src/services/localReminders.js
//
// Native iOS local reminders via @capacitor/local-notifications. No Firebase,
// no APNs, no paid push service, no remote delivery. Everything is scheduled
// on the device and fires locally — fully offline.
//
// Public API:
//   getReminderSettings(userId)            -> { enabled, kinds: { workouts, weighIns, weeklyCheckIn, streaks } }
//   setReminderSettings(userId, partial)   -> persists + reschedules
//   requestPermission()                    -> { granted: boolean }
//   isNativeAvailable()                    -> true on native iOS with plugin installed
//   refreshAllReminders(userId)            -> re-applies whatever the user has enabled
//   disableAllReminders(userId)            -> cancels every reminder scheduled by us
//
// The plugin is imported dynamically so a missing install / non-native env
// degrades gracefully into a no-op instead of breaking the bundle.

import { Capacitor } from "@capacitor/core";

const STORAGE_PREFIX = "armpal_reminders_v1_";

// Stable integer notification IDs, per kind. Re-scheduling the same id
// REPLACES the existing notification (the plugin's documented behavior),
// so there's no risk of duplicates.
const REMINDER_IDS = {
  workouts: 1001,
  weighIns: 1002,
  weeklyCheckIn: 1003,
  streaks: 1004,
};

const DEFAULT_SETTINGS = {
  enabled: false,
  kinds: {
    workouts: { on: false, hour: 19, minute: 0 }, // daily 7:00 PM
    weighIns: { on: false, hour: 7, minute: 0 }, // daily 7:00 AM
    weeklyCheckIn: { on: false, hour: 9, minute: 0, weekday: 1 }, // Sun 9:00 AM (1 = Sunday in iOS)
    streaks: { on: false, hour: 21, minute: 0 }, // daily 9:00 PM
  },
};

// ---------- Plugin loader -------------------------------------------------

let pluginPromise = null;

async function getPlugin() {
  if (!isNativeAvailable()) return null;
  if (!pluginPromise) {
    pluginPromise = import("@capacitor/local-notifications")
      .then((m) => m.LocalNotifications || null)
      .catch((err) => {
        console.warn("[reminders] @capacitor/local-notifications not installed:", err?.message);
        return null;
      });
  }
  return pluginPromise;
}

export function isNativeAvailable() {
  try {
    return Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

// ---------- Settings persistence (localStorage, per user) -----------------

function storageKey(userId) {
  return STORAGE_PREFIX + (userId || "anon");
}

function deepMergeSettings(base, partial) {
  if (!partial || typeof partial !== "object") return base;
  const merged = { ...base, ...partial };
  if (partial.kinds) {
    merged.kinds = { ...base.kinds };
    for (const k of Object.keys(partial.kinds)) {
      merged.kinds[k] = { ...(base.kinds[k] || {}), ...(partial.kinds[k] || {}) };
    }
  }
  return merged;
}

export function getReminderSettings(userId) {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return deepMergeSettings(DEFAULT_SETTINGS, parsed);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveReminderSettings(userId, settings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(settings));
  } catch (err) {
    console.warn("[reminders] failed to save settings:", err?.message);
  }
}

// ---------- Permissions ---------------------------------------------------

export async function checkPermission() {
  const plugin = await getPlugin();
  if (!plugin) return { granted: false, available: false };
  try {
    const res = await plugin.checkPermissions();
    return { granted: res?.display === "granted", available: true };
  } catch (err) {
    console.warn("[reminders] checkPermissions failed:", err?.message);
    return { granted: false, available: true };
  }
}

export async function requestPermission() {
  const plugin = await getPlugin();
  if (!plugin) return { granted: false, available: false };
  try {
    const res = await plugin.requestPermissions();
    return { granted: res?.display === "granted", available: true };
  } catch (err) {
    console.warn("[reminders] requestPermissions failed:", err?.message);
    return { granted: false, available: true };
  }
}

// ---------- Scheduling helpers --------------------------------------------

// Returns the next Date instance at the given local hour/minute today; if that
// time has already passed today, returns the same hour/minute tomorrow.
function nextDailyAt(hour, minute) {
  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

// Returns the next Date instance at the given weekday/hour/minute, where
// weekday matches the iOS LocalNotifications weekday convention: 1 = Sunday,
// 2 = Monday, ..., 7 = Saturday. JS Date.getDay() also returns 0..6 with
// 0 = Sunday, so we map: jsDay = weekday - 1.
function nextWeeklyAt(weekday, hour, minute) {
  const now = new Date();
  const targetJsDay = (weekday - 1 + 7) % 7;
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(hour, minute, 0, 0);
  const diff = (targetJsDay - next.getDay() + 7) % 7;
  next.setDate(next.getDate() + diff);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 7);
  }
  return next;
}

async function scheduleOne({ id, title, body, at, repeats, every }) {
  const plugin = await getPlugin();
  if (!plugin) return false;
  try {
    await plugin.schedule({
      notifications: [
        {
          id,
          title,
          body,
          schedule: { at, repeats: !!repeats, every: every || undefined, allowWhileIdle: true },
          smallIcon: "ic_stat_icon_config_sample",
          sound: null,
          extra: { source: "armpal-local-reminder" },
        },
      ],
    });
    return true;
  } catch (err) {
    console.warn("[reminders] schedule failed for id", id, err?.message);
    return false;
  }
}

async function cancelByIds(ids) {
  const plugin = await getPlugin();
  if (!plugin) return;
  try {
    await plugin.cancel({ notifications: ids.map((id) => ({ id })) });
  } catch (err) {
    console.warn("[reminders] cancel failed:", err?.message);
  }
}

// ---------- Public scheduling API ----------------------------------------

async function applyKind(kindKey, kindCfg) {
  const id = REMINDER_IDS[kindKey];
  if (!id) return false;

  // Always clear the previous one first so a settings change replaces cleanly.
  await cancelByIds([id]);
  if (!kindCfg?.on) return false;

  switch (kindKey) {
    case "workouts":
      return scheduleOne({
        id,
        title: "Track your progress",
        body: "A short session in ArmPal counts.",
        at: nextDailyAt(kindCfg.hour ?? 19, kindCfg.minute ?? 0),
        repeats: true,
        every: "day",
      });
    case "weighIns":
      return scheduleOne({
        id,
        title: "Log today's weight",
        body: "Quick log keeps your trend accurate.",
        at: nextDailyAt(kindCfg.hour ?? 7, kindCfg.minute ?? 0),
        repeats: true,
        every: "day",
      });
    case "weeklyCheckIn":
      // Feature removed from user-facing UI; kept here only so previously
      // scheduled reminders can still be cancelled cleanly. No new
      // notifications of this kind are scheduled from the app today.
      return scheduleOne({
        id,
        title: "Track your progress",
        body: "Open ArmPal when you have a moment.",
        at: nextWeeklyAt(kindCfg.weekday ?? 1, kindCfg.hour ?? 9, kindCfg.minute ?? 0),
        repeats: true,
        every: "week",
      });
    case "streaks":
      return scheduleOne({
        id,
        title: "Don't lose your streak",
        body: "A quick log today keeps it going.",
        at: nextDailyAt(kindCfg.hour ?? 21, kindCfg.minute ?? 0),
        repeats: true,
        every: "day",
      });
    default:
      return false;
  }
}

export async function refreshAllReminders(userId) {
  if (!isNativeAvailable()) return { applied: false, reason: "not-native" };
  const plugin = await getPlugin();
  if (!plugin) return { applied: false, reason: "plugin-missing" };

  const settings = getReminderSettings(userId);
  if (!settings.enabled) {
    await disableAllReminders(userId);
    return { applied: false, reason: "disabled" };
  }

  const perm = await checkPermission();
  if (!perm.granted) {
    const req = await requestPermission();
    if (!req.granted) return { applied: false, reason: "permission-denied" };
  }

  const results = {};
  for (const k of Object.keys(REMINDER_IDS)) {
    results[k] = await applyKind(k, settings.kinds[k]);
  }
  return { applied: true, results };
}

export async function disableAllReminders(/* userId */) {
  if (!isNativeAvailable()) return;
  await cancelByIds(Object.values(REMINDER_IDS));
}

export async function setReminderSettings(userId, partial) {
  const current = getReminderSettings(userId);
  const wasEnablingMaster =
    partial.enabled === true && current.enabled === false;

  const next = deepMergeSettings(current, partial);
  saveReminderSettings(userId, next);
  const refresh = await refreshAllReminders(userId);

  // Only roll back on a failed *first* master enable — not when tweaking times
  // while already enabled (partial often repeats enabled: true from callers).
  if (
    wasEnablingMaster &&
    next.enabled &&
    (refresh?.reason === "permission-denied" || refresh?.reason === "plugin-missing")
  ) {
    const reverted = deepMergeSettings(next, { enabled: false });
    saveReminderSettings(userId, reverted);
    return reverted;
  }
  return next;
}
