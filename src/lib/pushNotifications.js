import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "../supabaseClient";

const LOG = "[ArmPal.APNs]";

let listenersAttached = false;
let listenersAttachPromise = null;
let activeUserId = null;
let lastRegisteredToken = null;

function logStep(message, extra) {
  if (extra !== undefined) {
    console.log(LOG, message, extra);
  } else {
    console.log(LOG, message);
  }
}

function logWarn(message, extra) {
  if (extra !== undefined) {
    console.warn(LOG, message, extra);
  } else {
    console.warn(LOG, message);
  }
}

function devNotify(message) {
  logStep(`DEV NOTIFY: ${message}`);
  if (import.meta.env.DEV) {
    alert(message);
  }
}

export function getApnsPlatformDebug() {
  let isNative = false;
  let platform = "unknown";
  try {
    isNative = Capacitor.isNativePlatform();
    platform = Capacitor.getPlatform();
  } catch (err) {
    logWarn("platform detection failed", err?.message || err);
  }
  return { isNative, platform };
}

export function isNativeApnsSupported() {
  const { isNative, platform } = getApnsPlatformDebug();
  return isNative && platform === "ios";
}

/**
 * Attach Capacitor push listeners once (safe to call multiple times).
 */
export async function attachApnsPushListeners() {
  if (listenersAttached) return;
  if (listenersAttachPromise) return listenersAttachPromise;

  listenersAttachPromise = (async () => {
    logStep("Attaching PushNotifications listeners…");

    await PushNotifications.addListener("registration", (token) => {
      const value = token?.value || "";
      lastRegisteredToken = value;
      logStep("APNs registration SUCCESS", { token: value });
      devNotify("APNs token registered");
      const userId = activeUserId;
      if (!userId) {
        logWarn("registration success but no active user id yet — token not saved");
        return;
      }
      void savePushToken(value, userId);
    });

    await PushNotifications.addListener("registrationError", (err) => {
      logWarn("APNs registration ERROR", err);
    });

    await PushNotifications.addListener("pushNotificationReceived", (notification) => {
      console.log("[ArmPal.Push] FOREGROUND PUSH RECEIVED", notification);
      logStep("pushNotificationReceived (foreground/background delivery)", notification);
      try {
        const title =
          notification?.title ||
          notification?.notification?.title ||
          notification?.data?.title ||
          "ArmPal";
        const body =
          notification?.body ||
          notification?.notification?.body ||
          notification?.data?.body ||
          "";
        window.dispatchEvent(
          new CustomEvent("armpal-apns-foreground", { detail: { title, body } })
        );
      } catch {
        /* ignore */
      }
    });

    await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      console.log("[ArmPal.Push] PUSH OPENED", action);
      logStep("pushNotificationActionPerformed (push tapped)", action);
    });

    listenersAttached = true;
    logStep("PushNotifications listeners attached");
  })();

  try {
    await listenersAttachPromise;
  } finally {
    listenersAttachPromise = null;
  }
}

/**
 * Persist an APNs device token for the signed-in user.
 * @param {string} token
 * @param {string} userId
 */
export async function savePushToken(token, userId) {
  if (!token || !userId) {
    logWarn("savePushToken skipped — missing token or userId", { token: !!token, userId });
    return { ok: false, error: "missing_token_or_user" };
  }

  logStep("Saving APNs token to Supabase push_tokens…", {
    userId,
    tokenPreview: `${token.slice(0, 8)}…${token.slice(-8)}`,
  });

  const { error } = await supabase.from("push_tokens").upsert(
    {
      user_id: userId,
      token,
      platform: "ios",
      enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,token" }
  );

  if (error) {
    logWarn("token save FAILURE", error.message);
    devNotify(`Push token save failed: ${error.message}`);
    return { ok: false, error: error.message };
  }

  logStep("token save SUCCESS");
  devNotify("Push token saved");
  return { ok: true };
}

export async function getApnsPushStatus(userId) {
  const { isNative, platform } = getApnsPlatformDebug();
  const supported = isNative && platform === "ios";

  if (!supported) {
    return {
      supported: false,
      permission: "unsupported",
      hasToken: false,
      tokenPreview: null,
    };
  }

  let permission = "unknown";
  try {
    const perm = await PushNotifications.checkPermissions();
    permission = perm?.receive || "unknown";
  } catch (err) {
    logWarn("checkPermissions failed", err?.message || err);
  }

  let hasToken = !!lastRegisteredToken;
  if (userId) {
    try {
      const { data, error } = await supabase
        .from("push_tokens")
        .select("token")
        .eq("user_id", userId)
        .eq("enabled", true)
        .eq("platform", "ios")
        .limit(1);
      if (!error && data?.length) {
        hasToken = true;
        lastRegisteredToken = data[0].token;
      }
    } catch (err) {
      logWarn("push_tokens lookup failed", err?.message || err);
    }
  }

  return {
    supported: true,
    permission,
    hasToken,
    tokenPreview: lastRegisteredToken
      ? `${lastRegisteredToken.slice(0, 8)}…${lastRegisteredToken.slice(-8)}`
      : null,
  };
}

export async function disableApnsPush(userId) {
  if (!userId) return;
  logStep("Disabling APNs tokens for user", { userId });
  const { error } = await supabase
    .from("push_tokens")
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("platform", "ios");
  if (error) logWarn("disableApnsPush failed", error.message);
}

/**
 * Register for native iOS APNs push (Capacitor only). No-op on web.
 * @param {{ id: string } | null | undefined} user
 * @param {{ force?: boolean }} [options]
 */
export async function initPushNotifications(user, options = {}) {
  const debug = getApnsPlatformDebug();
  logStep("initPushNotifications START", {
    userId: user?.id || null,
    force: !!options.force,
    ...debug,
  });

  if (!user?.id) {
    logWarn("initPushNotifications aborted — no user");
    return { ok: false, reason: "no_user" };
  }

  if (!debug.isNative) {
    logStep("initPushNotifications skipped — not a native Capacitor platform", debug);
    return { ok: false, reason: "not_native" };
  }

  if (debug.platform !== "ios") {
    logStep("initPushNotifications skipped — platform is not ios", debug);
    return { ok: false, reason: "not_ios" };
  }

  activeUserId = user.id;

  try {
    await attachApnsPushListeners();

    logStep("Checking push permission…");
    let perm = await PushNotifications.checkPermissions();
    logStep("Permission check result", perm);

    if (perm.receive === "prompt") {
      logStep("Requesting push permission…");
      perm = await PushNotifications.requestPermissions();
      logStep("Permission request result", perm);
    }

    if (perm.receive !== "granted") {
      logWarn("Push permission NOT granted — skipping register()", perm);
      return { ok: false, reason: "permission_denied", permission: perm.receive };
    }

    logStep("Calling PushNotifications.register()…");
    await PushNotifications.register();
    logStep("PushNotifications.register() call completed — awaiting registration event");

    if (lastRegisteredToken && activeUserId === user.id) {
      await savePushToken(lastRegisteredToken, user.id);
    }

    return { ok: true, permission: perm.receive };
  } catch (err) {
    logWarn("initPushNotifications FAILED", err?.message || err);
    return { ok: false, reason: "error", error: err?.message || String(err) };
  }
}
