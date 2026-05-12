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

const NUDGE_LOG = "[ArmPal.Nudge]";

const NUDGE_CONTENT = {
  workouts: { title: "Track your progress", body: "A short session in ArmPal counts.", defaultH: 19, defaultM: 0 },
  weighIns: { title: "Log today's weight", body: "Quick log keeps your trend accurate.", defaultH: 7, defaultM: 0 },
  streaks:  { title: "Don't lose your streak", body: "A quick log today keeps it going.", defaultH: 21, defaultM: 0 },
};

async function cancelByIds(ids) {
  await cancelLocalNotification(ids);
}

/**
 * Schedule a daily repeating nudge using `schedule.on` (hour + minute).
 * Capacitor treats `at`, `every`, and `on` as mutually exclusive — using `on`
 * with only hour + minute produces a reliable daily trigger on both iOS and Android.
 */
async function scheduleDailyNudge({ id, title, body, hour, minute }) {
  const plugin = getLocalNotificationsPlugin();
  if (!plugin) {
    console.warn(NUDGE_LOG, "scheduleDailyNudge: no plugin", { id });
    return false;
  }

  const payload = {
    id: Number(id),
    title: String(title).slice(0, 200),
    body: String(body).slice(0, 500),
    schedule: {
      on: { hour, minute },
      allowWhileIdle: true,
    },
    extra: { source: "armpal-daily-nudge" },
  };

  try {
    await plugin.schedule({ notifications: [payload] });
    console.log(NUDGE_LOG, "scheduled daily", {
      id: payload.id,
      hour,
      minute,
      title,
    });
    return true;
  } catch (err) {
    console.error(NUDGE_LOG, "schedule FAILED", {
      id: payload.id,
      hour,
      minute,
      error: err?.message || String(err),
    });
    return false;
  }
}

async function applyKind(kindKey, kindCfg) {
  const id = REMINDER_IDS[kindKey];
  if (!id) return false;

  await cancelByIds([id]);

  if (!kindCfg?.on) {
    console.log(NUDGE_LOG, "applyKind: OFF", { kind: kindKey, id });
    return false;
  }

  const content = NUDGE_CONTENT[kindKey];
  if (!content) {
    console.warn(NUDGE_LOG, "applyKind: unknown kind", kindKey);
    return false;
  }

  const hour = kindCfg.hour ?? content.defaultH;
  const minute = kindCfg.minute ?? content.defaultM;

  console.log(NUDGE_LOG, "applyKind: scheduling", { kind: kindKey, id, hour, minute });

  const ok = await scheduleDailyNudge({
    id,
    title: content.title,
    body: content.body,
    hour,
    minute,
  });

  console.log(NUDGE_LOG, "applyKind: result", { kind: kindKey, id, ok });
  return ok;
}

export async function refreshAllReminders(userId) {
  console.log(NUDGE_LOG, "refreshAllReminders: START", { userId: userId ?? "anon" });

  if (!isNativeNotificationsSupported()) {
    console.log(NUDGE_LOG, "refreshAllReminders: SKIP (not native)");
    return { applied: false, reason: "not-native" };
  }
  const plugin = getLocalNotificationsPlugin();
  if (!plugin) {
    console.warn(NUDGE_LOG, "refreshAllReminders: SKIP (no plugin)");
    return { applied: false, reason: "plugin-missing" };
  }

  const settings = getReminderSettings(userId);
  if (!settings.enabled) {
    console.log(NUDGE_LOG, "refreshAllReminders: master toggle OFF — cancelling all");
    await disableAllReminders(userId);
    return { applied: false, reason: "disabled" };
  }

  const perm = await checkPermissions();
  if (!perm.granted) {
    const req = await requestPermissions();
    if (!req.granted) {
      console.warn(NUDGE_LOG, "refreshAllReminders: permission denied");
      return { applied: false, reason: "permission-denied" };
    }
  }

  await cancelByIds([REMINDER_IDS.weeklyCheckIn]);

  const results = {};
  const activeKinds = ["workouts", "weighIns", "streaks"];
  for (const k of activeKinds) {
    results[k] = await applyKind(k, settings.kinds[k]);
  }
  results.weeklyCheckIn = false;

  console.log(NUDGE_LOG, "refreshAllReminders: DONE", results);

  // Log pending notifications for verification
  try {
    const pending = await plugin.getPending();
    const nudgeIds = new Set(Object.values(REMINDER_IDS));
    const nudgePending = (pending?.notifications ?? []).filter((n) => nudgeIds.has(n.id));
    console.log(NUDGE_LOG, "pending nudge notifications", nudgePending);
  } catch (e) {
    console.warn(NUDGE_LOG, "getPending failed (non-fatal)", e?.message);
  }

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

// ---------------------------------------------------------------------------
// Test: fire a one-shot nudge notification in ~15 seconds (diagnostics only)
// ---------------------------------------------------------------------------

const NUDGE_TEST_ID = 900_100;

export async function testNudgeIn15s() {
  console.log(NUDGE_LOG, "testNudgeIn15s: START");

  if (!isNativeNotificationsSupported()) {
    console.warn(NUDGE_LOG, "testNudgeIn15s: not native");
    return { ok: false, reason: "not-native" };
  }

  const plugin = getLocalNotificationsPlugin();
  if (!plugin) {
    console.warn(NUDGE_LOG, "testNudgeIn15s: no plugin");
    return { ok: false, reason: "no-plugin" };
  }

  const perm = await checkPermissions();
  if (!perm.granted) {
    const req = await requestPermissions();
    if (!req.granted) {
      console.warn(NUDGE_LOG, "testNudgeIn15s: permission denied");
      return { ok: false, reason: "permission-denied" };
    }
  }

  const fireAt = new Date(Date.now() + 15_000);

  try {
    await plugin.cancel({ notifications: [{ id: NUDGE_TEST_ID }] });
    await plugin.schedule({
      notifications: [
        {
          id: NUDGE_TEST_ID,
          title: "ArmPal nudge test",
          body: "Settings nudge test — fires in ~15 seconds. Lock the phone.",
          schedule: { at: fireAt, allowWhileIdle: true },
          extra: { source: "armpal-nudge-test-15s" },
        },
      ],
    });
    console.log(NUDGE_LOG, "testNudgeIn15s: SCHEDULED", {
      id: NUDGE_TEST_ID,
      fireAt: fireAt.toISOString(),
    });
    return { ok: true, fireAt: fireAt.toISOString() };
  } catch (err) {
    console.error(NUDGE_LOG, "testNudgeIn15s: FAILED", err?.message || String(err));
    return { ok: false, reason: err?.message || String(err) };
  }
}
