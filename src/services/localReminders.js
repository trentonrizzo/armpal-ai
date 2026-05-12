// src/services/localReminders.js
//
// Native iOS/Android local reminders via @capacitor/local-notifications. No Firebase,
// no APNs, no paid push service, no remote delivery. Everything is scheduled
// on the device and fires locally — fully offline.
//
// Public API:
//   getReminderSettings(userId)            -> { enabled, kinds: { workouts, weighIns, weeklyCheckIn, streaks } }
//   setReminderSettings(userId, partial)   -> persists + reschedules
//   requestPermission()                    -> { granted: boolean, display, ... } (delegates to native service)
//   isNativeAvailable()                    -> true on native Capacitor host (same as isNativeNotificationsSupported)
//   refreshAllReminders(userId)            -> re-applies whatever the user has enabled
//   disableAllReminders(userId)            -> cancels every reminder scheduled by us
//
// Plugin access is centralized in `nativeLocalNotifications.js`.

import { Capacitor } from "@capacitor/core";
import {
  isNativeNotificationsSupported,
  getLocalNotificationsPlugin,
  checkPermissions,
  requestPermissions,
  scheduleLocalNotification,
  cancelLocalNotification,
} from "./nativeLocalNotifications";

const STORAGE_PREFIX = "armpal_reminders_v1_";

const REMINDER_IDS = {
  workouts: 1001,
  weighIns: 1002,
  weeklyCheckIn: 1003,
  streaks: 1004,
};

const DEFAULT_SETTINGS = {
  enabled: false,
  kinds: {
    workouts: { on: false, hour: 19, minute: 0 },
    weighIns: { on: false, hour: 7, minute: 0 },
    weeklyCheckIn: { on: false, hour: 9, minute: 0, weekday: 1 },
    streaks: { on: false, hour: 21, minute: 0 },
  },
};

export { isNativeNotificationsSupported as isNativeAvailable };

export { checkPermissions, requestPermissions };

/** Legacy singular names used across the app */
export async function checkPermission() {
  return checkPermissions();
}

export async function requestPermission() {
  return requestPermissions();
}

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

/** For optimistic UI in settings — same merge as persistence. */
export function mergeReminderSettings(base, partial) {
  return deepMergeSettings(base, partial);
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

/**
 * Opens the app’s page in system Settings (iOS/Android). User gesture required.
 */
export function openAppNotificationSettings() {
  if (typeof window === "undefined") return;
  try {
    const p = Capacitor?.getPlatform?.();
    if (p === "ios" || p === "android") {
      window.location.assign("app-settings:");
    }
  } catch (err) {
    console.warn("[reminders] open settings failed:", err?.message);
  }
}

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

async function scheduleOne({ id, title, body, at, repeats, every }) {
  const res = await scheduleLocalNotification({
    id,
    title,
    body,
    at,
    repeats: !!repeats,
    every,
    extra: { source: "armpal-local-reminder" },
  });
  return !!res?.ok;
}

async function cancelByIds(ids) {
  await cancelLocalNotification(ids);
}

async function applyKind(kindKey, kindCfg) {
  const id = REMINDER_IDS[kindKey];
  if (!id) return false;

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
      return false;
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
  if (!isNativeNotificationsSupported()) return { applied: false, reason: "not-native" };
  const plugin = getLocalNotificationsPlugin();
  if (!plugin) return { applied: false, reason: "plugin-missing" };

  const settings = getReminderSettings(userId);
  if (!settings.enabled) {
    await disableAllReminders(userId);
    return { applied: false, reason: "disabled" };
  }

  const perm = await checkPermissions();
  if (!perm.granted) {
    const req = await requestPermissions();
    if (!req.granted) return { applied: false, reason: "permission-denied" };
  }

  await cancelByIds([REMINDER_IDS.weeklyCheckIn]);

  const results = {};
  const activeKinds = ["workouts", "weighIns", "streaks"];
  for (const k of activeKinds) {
    results[k] = await applyKind(k, settings.kinds[k]);
  }
  results.weeklyCheckIn = false;
  return { applied: true, results };
}

export async function disableAllReminders(/* userId */) {
  if (!isNativeNotificationsSupported()) return;
  await cancelByIds(Object.values(REMINDER_IDS));
}

export async function setReminderSettings(userId, partial) {
  const current = getReminderSettings(userId);
  const wasEnablingMaster = partial.enabled === true && current.enabled === false;

  const next = deepMergeSettings(current, partial);
  saveReminderSettings(userId, next);
  const refresh = await refreshAllReminders(userId);

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
