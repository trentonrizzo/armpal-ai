// src/onesignal.ts
/// <reference types="vite/client" />
//
// OneSignal Web SDK integration (v16) for React + Supabase.
// - Init and login run on session load; permission prompt is NOT auto-triggered
//   (iOS requires user interaction). Use promptPushIfNeeded() from first tap or Settings.
// - When permission is granted, subscription id is saved to profiles.onesignal_player_id.

declare global {
  interface Window {
    OneSignalDeferred?: any[];
    OneSignal?: any;
  }
}

import { supabase } from "./supabaseClient";

const ONESIGNAL_APP_ID = import.meta.env?.VITE_ONESIGNAL_APP_ID;

let queuedForUserId: string | null = null;

function ensureDeferred(): any[] {
  if (typeof window === "undefined") return [];
  if (!window.OneSignalDeferred) {
    window.OneSignalDeferred = [];
  }
  return window.OneSignalDeferred;
}

/**
 * Trigger OneSignal Slidedown permission prompt. Call only from user interaction (e.g. first tap, Settings toggle).
 * No-op if permission already granted or OneSignal not ready.
 */
export async function promptPushIfNeeded(): Promise<void> {
  if (typeof window === "undefined") return;
  if (typeof Notification !== "undefined" && Notification.permission === "granted") return;

  const OneSignal = window.OneSignal;
  if (!OneSignal || !OneSignal.Slidedown || !OneSignal.Slidedown.promptPush) return;

  try {
    await OneSignal.Slidedown.promptPush();
  } catch (e) {
    console.debug("OneSignal Slidedown promptPush error:", e);
  }
}

/**
 * Initialize OneSignal for the current authenticated user (init + login + save subscription id).
 * Does NOT trigger the permission prompt (use promptPushIfNeeded on first user interaction).
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
  if (!userId) return;

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

export async function initOneSignal(): Promise<void> {
  return initOneSignalForCurrentUser();
}

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

export async function getSubscriptionState(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  return Notification.permission !== "default" && Notification.permission !== "denied";
}

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
