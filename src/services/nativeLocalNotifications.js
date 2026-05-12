/**
 * Capacitor Local Notifications — single implementation for ArmPal.
 * Uses a static import so `registerPlugin('LocalNotifications', …)` runs at module load
 * (required for correct native bridge binding; dynamic import() can defer registration).
 */

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const LOG = "[ArmPal.NativeLocalNotifications]";

/** Reserved test ids (avoid reminder 1001–1004 and workout-derived ids). */
export const NATIVE_LOCAL_TEST_NOTIFICATION_ID = 900_000_001;
export const NATIVE_DIRECT_TEST_15S_ID = 900_000_002;

let logListenersAttached = false;

export function isNativeNotificationsSupported() {
  try {
    return Capacitor.isNativePlatform() === true;
  } catch {
    return false;
  }
}

/** Re-export for diagnostics / “direct native” buttons (same singleton as registerPlugin). */
export { LocalNotifications };

/**
 * @returns {import('@capacitor/local-notifications').LocalNotificationsPlugin | null}
 */
export function getLocalNotificationsPlugin() {
  if (!isNativeNotificationsSupported()) {
    console.log(LOG, "getLocalNotificationsPlugin: skip (not native)", {
      platform: Capacitor.getPlatform(),
    });
    return null;
  }
  if (!LocalNotifications) {
    console.error(LOG, "getLocalNotificationsPlugin: LocalNotifications export is null/undefined");
    return null;
  }
  return LocalNotifications;
}

/** Why the native bridge may be inactive (exact strings for UI / logs). */
export function explainLocalNotificationsBridgeIssue() {
  const platform = Capacitor.getPlatform();
  const isNative = Capacitor.isNativePlatform();
  if (!isNative) {
    return "Not a native Capacitor host (Capacitor.isNativePlatform() is false). Web/PWA cannot use iOS UNUserNotificationCenter via this plugin.";
  }
  const headers = typeof window !== "undefined" ? window.Capacitor?.PluginHeaders : undefined;
  if (!Array.isArray(headers)) {
    return "window.Capacitor.PluginHeaders is missing or not an array — JavaScript bridge not initialized like a Capacitor WebView.";
  }
  const ln = headers.find((h) => h?.name === "LocalNotifications");
  if (!ln) {
    return `PluginHeaders has no "LocalNotifications" entry (count=${headers.length}). The iOS app is not registering LocalNotificationsPlugin with the native bridge. Fix: run "npx cap sync ios", open ios/App/CapApp-SPM/Package.swift and confirm CapacitorLocalNotifications is a dependency, then Xcode Product → Clean Build Folder and rebuild.`;
  }
  if (!Array.isArray(ln.methods) || ln.methods.length === 0) {
    return "LocalNotifications is listed in PluginHeaders but has no methods — native registration is incomplete; reinstall pods/SPM and rebuild.";
  }
  const need = ["checkPermissions", "requestPermissions", "schedule"];
  const names = new Set(ln.methods.map((m) => m?.name).filter(Boolean));
  const missing = need.filter((n) => !names.has(n));
  if (missing.length) {
    return `LocalNotifications PluginHeaders is missing methods: ${missing.join(", ")}. Re-sync Capacitor iOS.`;
  }
  return null;
}

export function logLocalNotificationsBridgeSnapshot(context = "snapshot") {
  try {
    const platform = Capacitor.getPlatform();
    const isNative = Capacitor.isNativePlatform();
    const headers = typeof window !== "undefined" ? window.Capacitor?.PluginHeaders : undefined;
    const ln = Array.isArray(headers)
      ? headers.find((h) => h?.name === "LocalNotifications")
      : null;
    const pluginAvailable =
      typeof Capacitor.isPluginAvailable === "function"
        ? Capacitor.isPluginAvailable("LocalNotifications")
        : "n/a";
    console.log(LOG, `bridge:${context}`, {
      platform,
      isNative,
      pluginAvailable,
      hasLocalNotificationsHeader: !!ln,
      methodCount: ln?.methods?.length ?? 0,
      explain: explainLocalNotificationsBridgeIssue(),
    });
    if (ln?.methods) {
      console.log(
        LOG,
        `bridge:${context} LocalNotifications methods`,
        ln.methods.map((m) => `${m.name}:${m.rtype}`)
      );
    }
  } catch (e) {
    console.error(LOG, `bridge:${context} log failed`, e?.message, e);
  }
}

/** User-facing label for Settings (local alerts row). */
export function nativeLocalPermissionUiLabel(display) {
  switch (display) {
    case "granted":
      return "Allowed";
    case "denied":
      return "Denied";
    case "prompt":
    case "prompt-with-rationale":
      return "Not requested";
    case "unsupported":
      return "Unsupported (web only)";
    case "unavailable":
      return "Unavailable";
    case "error":
      return "Error (see diagnostics)";
    default:
      return display ? String(display) : "Not requested";
  }
}

function formatPluginError(err) {
  if (!err) return "unknown error";
  const parts = [
    err.message,
    err.code ? `code=${err.code}` : null,
    err.data != null ? `data=${JSON.stringify(err.data)}` : null,
  ].filter(Boolean);
  return parts.join(" | ") || String(err);
}

/**
 * @returns {Promise<{
 *   granted: boolean,
 *   available: boolean,
 *   display: string,
 *   uiLabel: string,
 *   nativeError?: string
 * }>}
 */
export async function checkPermissions() {
  if (!isNativeNotificationsSupported()) {
    const row = {
      granted: false,
      available: false,
      display: "unsupported",
      uiLabel: nativeLocalPermissionUiLabel("unsupported"),
      nativeError: explainLocalNotificationsBridgeIssue(),
    };
    console.log(LOG, "checkPermissions", row);
    return row;
  }

  const bridgeIssue = explainLocalNotificationsBridgeIssue();
  if (bridgeIssue) {
    console.error(LOG, "checkPermissions: bridge issue", bridgeIssue);
    return {
      granted: false,
      available: false,
      display: "unavailable",
      uiLabel: "Unavailable (native bridge)",
      nativeError: bridgeIssue,
    };
  }

  const plugin = getLocalNotificationsPlugin();
  if (!plugin) {
    const row = {
      granted: false,
      available: false,
      display: "unavailable",
      uiLabel: nativeLocalPermissionUiLabel("unavailable"),
      nativeError: "getLocalNotificationsPlugin() returned null",
    };
    console.error(LOG, "checkPermissions: no plugin object", row);
    return row;
  }

  try {
    const res = await plugin.checkPermissions();
    const display = res?.display ?? "prompt";
    const granted = display === "granted";
    const row = {
      granted,
      available: true,
      display,
      uiLabel: nativeLocalPermissionUiLabel(display),
    };
    console.log(LOG, "checkPermissions", {
      ...row,
      platform: Capacitor.getPlatform(),
      raw: res,
    });
    return row;
  } catch (err) {
    const msg = formatPluginError(err);
    console.error(LOG, "checkPermissions EXACT native error", err, msg);
    return {
      granted: false,
      available: true,
      display: "error",
      uiLabel: nativeLocalPermissionUiLabel("error"),
      nativeError: msg,
    };
  }
}

/**
 * @returns {Promise<{
 *   granted: boolean,
 *   available: boolean,
 *   display: string,
 *   uiLabel: string,
 *   nativeError?: string
 * }>}
 */
export async function requestPermissions() {
  if (!isNativeNotificationsSupported()) {
    const row = {
      granted: false,
      available: false,
      display: "unsupported",
      uiLabel: nativeLocalPermissionUiLabel("unsupported"),
      nativeError: explainLocalNotificationsBridgeIssue(),
    };
    console.log(LOG, "requestPermissions: skip (not native)", row);
    return row;
  }

  const bridgeIssue = explainLocalNotificationsBridgeIssue();
  if (bridgeIssue) {
    console.error(LOG, "requestPermissions: bridge issue", bridgeIssue);
    return {
      granted: false,
      available: false,
      display: "unavailable",
      uiLabel: "Unavailable (native bridge)",
      nativeError: bridgeIssue,
    };
  }

  const plugin = getLocalNotificationsPlugin();
  if (!plugin) {
    const row = {
      granted: false,
      available: false,
      display: "unavailable",
      uiLabel: nativeLocalPermissionUiLabel("unavailable"),
      nativeError: "getLocalNotificationsPlugin() returned null",
    };
    console.warn(LOG, "requestPermissions: plugin unavailable");
    return row;
  }

  try {
    const res = await plugin.requestPermissions();
    const display = res?.display ?? "prompt";
    const granted = display === "granted";
    const row = {
      granted,
      available: true,
      display,
      uiLabel: nativeLocalPermissionUiLabel(display),
    };
    console.log(LOG, "requestPermissions result", {
      ...row,
      platform: Capacitor.getPlatform(),
      raw: res,
    });
    return row;
  } catch (err) {
    const msg = formatPluginError(err);
    console.error(LOG, "requestPermissions EXACT native error", err, msg);
    return {
      granted: false,
      available: true,
      display: "error",
      uiLabel: nativeLocalPermissionUiLabel("error"),
      nativeError: msg,
    };
  }
}

export async function scheduleLocalNotification({
  id,
  title,
  body,
  at,
  repeats = false,
  every,
  extra,
}) {
  const plugin = getLocalNotificationsPlugin();
  if (!plugin) {
    console.warn(LOG, "scheduleLocalNotification: no plugin", { id });
    return { ok: false, reason: "no-plugin", nativeError: explainLocalNotificationsBridgeIssue() };
  }

  const schedule = { at, allowWhileIdle: true };
  if (repeats) {
    schedule.repeats = true;
    if (every) schedule.every = every;
  }

  try {
    await plugin.schedule({
      notifications: [
        {
          id: Number(id),
          title: String(title ?? "").slice(0, 200),
          body: String(body ?? "").slice(0, 500),
          schedule,
          smallIcon: "ic_stat_icon_config_sample",
          extra: extra && typeof extra === "object" ? extra : { source: "armpal-local" },
        },
      ],
    });
    console.log(LOG, "scheduled", {
      id: Number(id),
      at: at instanceof Date ? at.toISOString() : at,
      repeats: !!repeats,
      every: every ?? null,
    });
    return { ok: true };
  } catch (err) {
    const msg = formatPluginError(err);
    console.error(LOG, "scheduleLocalNotification EXACT native error", err, msg, { id });
    return { ok: false, reason: msg, nativeError: msg };
  }
}

/** @param {number|number[]} idOrIds */
export async function cancelLocalNotification(idOrIds) {
  const ids = (Array.isArray(idOrIds) ? idOrIds : [idOrIds])
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n));
  if (!ids.length) return { ok: true };

  const plugin = getLocalNotificationsPlugin();
  if (!plugin) {
    console.warn(LOG, "cancelLocalNotification: no plugin", ids);
    return { ok: false, reason: "no-plugin", nativeError: explainLocalNotificationsBridgeIssue() };
  }

  try {
    await plugin.cancel({ notifications: ids.map((id) => ({ id })) });
    console.log(LOG, "cancelled", ids);
    return { ok: true };
  } catch (err) {
    const msg = formatPluginError(err);
    console.error(LOG, "cancelLocalNotification EXACT native error", err, msg, ids);
    return { ok: false, reason: msg, nativeError: msg };
  }
}

async function attachNativeLocalNotificationLogListeners() {
  if (logListenersAttached) return;
  const LN = getLocalNotificationsPlugin();
  if (!LN?.addListener) {
    console.warn(LOG, "attach listeners: addListener missing");
    return;
  }
  try {
    await LN.addListener("localNotificationReceived", (notification) => {
      console.log(LOG, "fired / received (foreground or delivery hook)", notification);
    });
    await LN.addListener("localNotificationActionPerformed", (action) => {
      console.log(LOG, "fired / action (tap)", action);
    });
    logListenersAttached = true;
    console.log(LOG, "listener registration complete");
  } catch (err) {
    console.error(LOG, "attach listeners EXACT native error", err, formatPluginError(err));
  }
}

/** Cold start: bridge snapshot + permission probe. Does not prompt. */
export async function bootstrapNativeLocalNotifications() {
  try {
    logLocalNotificationsBridgeSnapshot("bootstrap");
    const platform = Capacitor.getPlatform();
    const native = isNativeNotificationsSupported();
    console.log(LOG, "bootstrap", { platform, native });
    if (!native) return;
    await attachNativeLocalNotificationLogListeners();
    const perm = await checkPermissions();
    console.log(LOG, "startup permission snapshot", perm);
  } catch (err) {
    console.error(LOG, "bootstrap EXACT error", err, formatPluginError(err));
  }
}

/** QA: one-shot ~60s from now. Uses service wrappers after permission. */
export async function scheduleLocalNotificationTestInOneMinute() {
  const prep = await checkPermissions();
  if (!prep.available) {
    console.warn(LOG, "test schedule: unavailable", prep);
    return { ok: false, reason: prep.display, nativeError: prep.nativeError };
  }
  if (!prep.granted) {
    const req = await requestPermissions();
    if (!req.granted) {
      console.warn(LOG, "test schedule: permission not granted", req);
      return { ok: false, reason: req.display, nativeError: req.nativeError };
    }
  }

  await cancelLocalNotification(NATIVE_LOCAL_TEST_NOTIFICATION_ID);
  const at = new Date(Date.now() + 60_000);
  const res = await scheduleLocalNotification({
    id: NATIVE_LOCAL_TEST_NOTIFICATION_ID,
    title: "ArmPal test",
    body: "Lock the phone or send the app to the background — this should appear in ~1 minute.",
    at,
    extra: { source: "armpal-local-test" },
  });
  if (res.ok) {
    console.log(LOG, "test notification scheduled for", at.toISOString());
  }
  return { ...res, fireAt: at.toISOString() };
}

/**
 * Guaranteed native permission + 15s alert — for diagnostics only.
 * Caller must invoke from a button (user gesture). Uses LocalNotifications.* directly.
 */
export async function directLocalNotificationsRequestThenSchedule15s() {
  if (!isNativeNotificationsSupported()) {
    return {
      ok: false,
      phase: "native",
      nativeError: explainLocalNotificationsBridgeIssue(),
    };
  }

  const LOGD = "[ArmPal.LNDirect]";
  logLocalNotificationsBridgeSnapshot("direct-test");

  let result;
  try {
    result = await LocalNotifications.requestPermissions();
  } catch (e) {
    const msg = formatPluginError(e);
    console.error(LOGD, "LocalNotifications.requestPermissions() EXACT throw", e, msg);
    return { ok: false, phase: "requestPermissions", nativeError: msg };
  }
  console.log(LOGD, "LocalNotifications.requestPermissions() raw result", result);

  if (result?.display !== "granted") {
    return {
      ok: false,
      phase: "requestPermissions",
      result,
      nativeError: `Permission not granted after direct request (display=${result?.display})`,
    };
  }

  const at = new Date(Date.now() + 15_000);
  try {
    await LocalNotifications.cancel({ notifications: [{ id: NATIVE_DIRECT_TEST_15S_ID }] });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: NATIVE_DIRECT_TEST_15S_ID,
          title: "ArmPal direct test",
          body: "15s direct LocalNotifications.schedule — lock or background the phone.",
          schedule: { at, allowWhileIdle: true },
          extra: { source: "armpal-ln-direct-15s" },
        },
      ],
    });
  } catch (e) {
    const msg = formatPluginError(e);
    console.error(LOGD, "LocalNotifications.schedule EXACT throw", e, msg);
    return { ok: false, phase: "schedule", nativeError: msg, result };
  }
  console.log(LOGD, "LocalNotifications.schedule() 15s OK", at.toISOString());

  let pending = null;
  try {
    pending = await LocalNotifications.getPending();
    console.log(LOGD, "getPending after schedule", pending);
  } catch (e) {
    console.error(LOGD, "getPending EXACT error", e, formatPluginError(e));
  }

  return { ok: true, result, fireAt: at.toISOString(), pending };
}
