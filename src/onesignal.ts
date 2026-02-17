// src/onesignal.ts
/// <reference types="vite/client" />
//
// OneSignal Web SDK integration (v16-style) for React + Supabase.
//
// Responsibilities:
// - Initialize the OneSignal Web SDK for the current Supabase user
// - Request push permission (slidedown/native prompt)
// - When granted, obtain the current push Subscription ID
//   and save it into `profiles.onesignal_player_id`
// - Avoid duplicate prompts within a single browser session
//
// IMPORTANT:
// - Do NOT expose the OneSignal REST API key here. Only the App ID is public.
// - Configure VITE_ONESIGNAL_APP_ID in your Vite frontend env.

declare global {
  interface Window {
    OneSignalDeferred?: any[];
    OneSignal?: any;
  }
}

import { supabase } from "./supabaseClient";

const ONESIGNAL_APP_ID = import.meta.env?.VITE_ONESIGNAL_APP_ID;

// Track which user we have already queued initialization for
let queuedForUserId: string | null = null;

// Prevent duplicate permission prompts per browser session
let promptShownThisSession = false;

function ensureDeferred(): any[] {
  if (typeof window === "undefined") return [];
  if (!window.OneSignalDeferred) {
    window.OneSignalDeferred = [];
  }
  return window.OneSignalDeferred;
}

/**
 * Initialize OneSignal for the current authenticated Supabase user.
 * Safe to call multiple times; the real work is queued once per user per session.
 */
export async function initOneSignalForCurrentUser(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!ONESIGNAL_APP_ID) {
    console.warn("VITE_ONESIGNAL_APP_ID is not set; skipping OneSignal init.");
    return;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.warn("Supabase getUser error (OneSignal init skipped):", error.message);
    return;
  }

  const userId = user?.id;
  if (!userId) {
    return;
  }

  if (queuedForUserId === userId) return;
  queuedForUserId = userId;

  const OneSignalDeferred = ensureDeferred();

  OneSignalDeferred.push(async function (OneSignal: any) {
    try {
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true,
        notifyButton: { enable: false },
      });

      try {
        await OneSignal.login(userId);
      } catch (e: any) {
        console.debug("OneSignal.login warning:", e?.message || e);
      }

      if (!promptShownThisSession) {
        promptShownThisSession = true;
        try {
          await OneSignal.Slidedown.promptPush();
        } catch (e: any) {
          console.debug("OneSignal Slidedown prompt may be throttled:", e?.message || e);
        }
      }

      async function saveCurrentSubscriptionId() {
        const subId = OneSignal?.User?.PushSubscription?.id;
        if (!subId) return false;

        const { error: updateError } = await supabase
          .from("profiles")
          .update({ onesignal_player_id: subId })
          .eq("id", userId);

        if (updateError) {
          console.error("Failed to save OneSignal subscription id:", updateError.message);
        }
        return !updateError;
      }

      const savedNow = await saveCurrentSubscriptionId();
      if (savedNow) return;

      try {
        OneSignal?.User?.PushSubscription?.addEventListener?.(
          "change",
          async (event: any) => {
            const currentId = event?.current?.id;
            if (!currentId) return;

            const { error: updateError } = await supabase
              .from("profiles")
              .update({ onesignal_player_id: currentId })
              .eq("id", userId);

            if (updateError) {
              console.error("Failed to save OneSignal subscription id (change):", updateError.message);
            }
          }
        );
      } catch (e: any) {
        console.debug("OneSignal PushSubscription change listener error:", e?.message || e);
      }
    } catch (err: any) {
      console.error("OneSignal init flow failed:", err?.message || err);
    }
  });
}

/**
 * Backwards‑compatible helper: keep existing calls working.
 */
export async function initOneSignal(): Promise<void> {
  return initOneSignalForCurrentUser();
}

/**
 * Request notification permission.
 * For compatibility with EnableNotifications page.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  await initOneSignalForCurrentUser();

  if (typeof Notification === "undefined") return false;
  if (Notification.permission !== "default" && Notification.permission !== "denied") return true;

  try {
    const result = await Notification.requestPermission();
    return result !== "default" && result !== "denied";
  } catch {
    return Notification.permission !== "default" && Notification.permission !== "denied";
  }
}

/**
 * Returns whether push notifications are currently enabled for this browser.
 */
export async function getSubscriptionState(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  return Notification.permission !== "default" && Notification.permission !== "denied";
}

/**
 * Opt the current browser out of receiving push.
 * Uses the OneSignal v16 PushSubscription optOut API when available.
 */
export async function unsubscribe(): Promise<void> {
  if (typeof window === "undefined") return;
  const OneSignal = window.OneSignal;
  if (!OneSignal?.User?.PushSubscription?.optOut) return;

  try {
    await OneSignal.User.PushSubscription.optOut();
  } catch (e: any) {
    console.debug("OneSignal unsubscribe error:", e?.message || e);
  }
}
