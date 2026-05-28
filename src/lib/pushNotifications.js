import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "../supabaseClient";

const LOG = "[ArmPal.APNs]";

let listenersAttached = false;
let listenersAttachPromise = null;
let authSyncAttached = false;
let activeUserId = null;
let lastSyncedAuthUserId = null;
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
      void (async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const authUserId = user?.id || activeUserId;
        console.log("[ArmPal.Push] TOKEN SAVE auth user", {
          authUserId,
          activeUserId,
          match: authUserId === activeUserId,
        });
        if (!authUserId) {
          logWarn("registration success but no auth user — token not saved");
          return;
        }
        activeUserId = authUserId;
        await savePushToken(value, authUserId);
        lastSyncedAuthUserId = authUserId;
      })();
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
 * DEV: log push_tokens ownership for the current auth user.
 */
export async function logCurrentPushTokenState() {
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  const authUserId = user?.id || null;

  let rows = [];
  let queryError = null;

  if (authUserId) {
    const { data, error } = await supabase
      .from("push_tokens")
      .select("id, user_id, token, enabled, platform, created_at, updated_at")
      .eq("user_id", authUserId)
      .order("updated_at", { ascending: false });

    rows = data || [];
    queryError = error?.message || null;
  }

  const payload = {
    authUserId,
    activeUserId,
    lastSyncedAuthUserId,
    authMatchesActive: authUserId === activeUserId,
    authMatchesLastSync: authUserId === lastSyncedAuthUserId,
    lastRegisteredTokenPreview: lastRegisteredToken
      ? `${lastRegisteredToken.slice(0, 10)}…${lastRegisteredToken.slice(-6)}`
      : null,
    rowCount: rows.length,
    rows: rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      user_idMatchesAuth: r.user_id === authUserId,
      enabled: r.enabled,
      platform: r.platform,
      tokenPreview: `${String(r.token || "").slice(0, 10)}…`,
      created_at: r.created_at,
      updated_at: r.updated_at,
    })),
    queryError: queryError || authErr?.message || null,
  };

  console.log("[ArmPal.Push] CURRENT PUSH TOKEN STATE", payload);
  return payload;
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authUserId = user?.id || null;

  if (authUserId && authUserId !== userId) {
    console.warn("[ArmPal.Push] TOKEN SAVE USER MISMATCH — using auth user id", {
      requestedUserId: userId,
      authUserId,
    });
    userId = authUserId;
  }

  logStep("Saving APNs token to Supabase push_tokens…", {
    userId,
    tokenPreview: `${token.slice(0, 8)}…${token.slice(-8)}`,
  });

  console.log("[ArmPal.Push] UPSERT push_tokens", {
    user_id: userId,
    platform: "ios",
    enabled: true,
    tokenPreview: `${token.slice(0, 10)}…`,
  });

  const { data: upserted, error } = await supabase
    .from("push_tokens")
    .upsert(
      {
        user_id: userId,
        token,
        platform: "ios",
        enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,token" }
    )
    .select("id, user_id, created_at, updated_at")
    .maybeSingle();

  if (error) {
    logWarn("token save FAILURE", error.message);
    devNotify(`Push token save failed: ${error.message}`);
    return { ok: false, error: error.message };
  }

  console.log("[ArmPal.Push] TOKEN SAVE SUCCESS", {
    user_id: userId,
    rowId: upserted?.id || null,
    created_at: upserted?.created_at || null,
    updated_at: upserted?.updated_at || null,
    tokenPreview: `${token.slice(0, 10)}…`,
  });

  lastSyncedAuthUserId = userId;
  activeUserId = userId;
  logStep("token save SUCCESS");
  devNotify("Push token saved");
  void logCurrentPushTokenState();
  return { ok: true, userId, rowId: upserted?.id || null };
}

/**
 * Bind the current device APNs token to the CURRENT auth user (account switch safe).
 */
export async function syncPushTokenToAuthUser(options = {}) {
  if (!isNativeApnsSupported()) {
    return { ok: false, reason: "not_ios" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authUserId = user?.id || null;

  if (!authUserId) {
    console.warn("[ArmPal.Push] syncPushTokenToAuthUser — no auth user");
    return { ok: false, reason: "no_auth_user" };
  }

  if (options.expectedUserId && options.expectedUserId !== authUserId) {
    console.warn("[ArmPal.Push] syncPushTokenToAuthUser — session/auth mismatch", {
      expectedUserId: options.expectedUserId,
      authUserId,
    });
  }

  const force = !!options.force;
  if (!force && lastSyncedAuthUserId === authUserId && lastRegisteredToken) {
    console.log("[ArmPal.Push] syncPushTokenToAuthUser — already synced", { authUserId });
    return { ok: true, skipped: true, userId: authUserId };
  }

  activeUserId = authUserId;
  console.log("[ArmPal.Push] SYNC TOKEN TO AUTH USER", {
    authUserId,
    previousSyncedUserId: lastSyncedAuthUserId,
    hasDeviceToken: !!lastRegisteredToken,
  });

  if (lastRegisteredToken) {
    return savePushToken(lastRegisteredToken, authUserId);
  }

  return initPushNotifications({ id: authUserId }, { force: true });
}

/**
 * Re-associate the current device APNs token with the signed-in user (account switch).
 */
export async function rebindApnsTokenForUser(userId) {
  return syncPushTokenToAuthUser({ force: true, expectedUserId: userId });
}

/**
 * Listen for auth changes and re-bind device token to the new account.
 */
export function attachPushAuthSync() {
  if (authSyncAttached) return;
  authSyncAttached = true;

  supabase.auth.onAuthStateChange((event, session) => {
    const userId = session?.user?.id;
    if (!userId || !isNativeApnsSupported()) return;

    const userChanged = lastSyncedAuthUserId !== userId;
    const shouldSync =
      userChanged ||
      event === "SIGNED_IN" ||
      event === "INITIAL_SESSION" ||
      event === "USER_UPDATED";

    if (!shouldSync) return;

    console.log("[ArmPal.Push] AUTH CHANGE — sync push token", {
      event,
      userId,
      previousSyncedUserId: lastSyncedAuthUserId,
    });

    void syncPushTokenToAuthUser({ force: userChanged, expectedUserId: userId });
  });
}

/**
 * DEV: inspect push token state for the current or specified user.
 */
export async function getPushTokenDebugInfo(userId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authUserId = user?.id || null;
  const targetUserId = userId || authUserId;

  let rows = [];
  let lookupError = null;

  if (targetUserId) {
    const { data, error } = await supabase
      .from("push_tokens")
      .select("id, token, enabled, platform, updated_at, user_id")
      .eq("user_id", targetUserId);
    rows = data || [];
    lookupError = error?.message || null;
  }

  const enabledIos = rows.filter((r) => r.enabled && r.platform === "ios");

  return {
    authUserId,
    targetUserId,
    activeUserId,
    authMatchesTarget: authUserId === targetUserId,
    lastRegisteredTokenPreview: lastRegisteredToken
      ? `${lastRegisteredToken.slice(0, 10)}…${lastRegisteredToken.slice(-6)}`
      : null,
    dbRowCount: rows.length,
    enabledIosCount: enabledIos.length,
    hasEnabledIosRow: enabledIos.length > 0,
    rows: rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      enabled: r.enabled,
      platform: r.platform,
      tokenPreview: `${String(r.token || "").slice(0, 10)}…`,
      updated_at: r.updated_at,
    })),
    lookupError,
  };
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
    } else if (lastRegisteredToken) {
      await syncPushTokenToAuthUser({ force: true, expectedUserId: user.id });
    }

    return { ok: true, permission: perm.receive };
  } catch (err) {
    logWarn("initPushNotifications FAILED", err?.message || err);
    return { ok: false, reason: "error", error: err?.message || String(err) };
  }
}
