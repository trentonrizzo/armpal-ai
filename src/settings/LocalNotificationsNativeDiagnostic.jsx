/**
 * Temporary native local-notifications bridge diagnostics (Capacitor iOS).
 * Remove or gate behind a feature flag when no longer needed.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import {
  checkPermissions,
  explainLocalNotificationsBridgeIssue,
  logLocalNotificationsBridgeSnapshot,
  directLocalNotificationsRequestThenSchedule15s,
  NATIVE_DIRECT_TEST_15S_ID,
} from "../services/nativeLocalNotifications";

const LOG = "[ArmPal.LNDiagPanel]";

function safeStringify(x) {
  try {
    return JSON.stringify(x, null, 2);
  } catch (e) {
    return String(e?.message || e);
  }
}

export default function LocalNotificationsNativeDiagnostic() {
  const [lines, setLines] = useState([]);
  const [busy, setBusy] = useState(false);
  const [lastDirectPerm, setLastDirectPerm] = useState(null);
  const [lastDirectErr, setLastDirectErr] = useState("");

  const refresh = useCallback(async () => {
    logLocalNotificationsBridgeSnapshot("panel-refresh");
    const platform = Capacitor.getPlatform();
    const isNative = Capacitor.isNativePlatform();
    const headers = typeof window !== "undefined" ? window.Capacitor?.PluginHeaders : undefined;
    const lnHeader = Array.isArray(headers)
      ? headers.find((h) => h?.name === "LocalNotifications")
      : null;
    const bridgeExplain = explainLocalNotificationsBridgeIssue();

    let perm = null;
    let permErr = "";
    try {
      perm = await checkPermissions();
    } catch (e) {
      permErr = e?.message || String(e);
      console.error(LOG, "checkPermissions threw", e);
    }

    let pending = null;
    let pendingErr = "";
    try {
      pending = await LocalNotifications.getPending();
    } catch (e) {
      pendingErr = e?.message || String(e);
      console.error(LOG, "getPending EXACT", e?.code, e?.message, e);
    }

    const pluginAvail =
      typeof Capacitor.isPluginAvailable === "function"
        ? String(Capacitor.isPluginAvailable("LocalNotifications"))
        : "n/a (no isPluginAvailable)";
    const nextLines = [
      `Capacitor.getPlatform() = ${platform}`,
      `Capacitor.isNativePlatform() = ${String(isNative)}`,
      `Capacitor.isPluginAvailable('LocalNotifications') = ${pluginAvail}`,
      `typeof LocalNotifications = ${typeof LocalNotifications}`,
      `PluginHeaders is array = ${String(Array.isArray(headers))}`,
      `PluginHeaders count = ${Array.isArray(headers) ? headers.length : "n/a"}`,
      `LocalNotifications header present = ${String(!!lnHeader)}`,
      lnHeader ? `LocalNotifications method count = ${lnHeader.methods?.length ?? 0}` : "",
      bridgeExplain ? `BRIDGE ISSUE: ${bridgeExplain}` : "BRIDGE: OK (header + methods look present)",
      perm ? `checkPermissions() → ${safeStringify(perm)}` : "",
      permErr ? `checkPermissions THREW: ${permErr}` : "",
      pending ? `getPending() → count=${pending.notifications?.length ?? 0}` : "",
      pendingErr ? `getPending EXACT ERROR: ${pendingErr}` : "",
    ].filter(Boolean);

    setLines(nextLines);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Permission call path is only LocalNotifications.requestPermissions() */
  async function handleRequestPermissionButton() {
    setBusy(true);
    setLastDirectErr("");
    setLastDirectPerm(null);
    try {
      const r = await LocalNotifications.requestPermissions();
      setLastDirectPerm(r);
      console.log(LOG, "BUTTON: direct LocalNotifications.requestPermissions() result", r);

      if (r?.display === "granted") {
        const at = new Date(Date.now() + 15_000);
        await LocalNotifications.cancel({ notifications: [{ id: NATIVE_DIRECT_TEST_15S_ID }] });
        await LocalNotifications.schedule({
          notifications: [
            {
              id: NATIVE_DIRECT_TEST_15S_ID,
              title: "ArmPal permission test",
              body: "Fires 15s after you allowed notifications (direct LocalNotifications.schedule).",
              schedule: { at, allowWhileIdle: true },
              extra: { source: "armpal-ln-direct-after-perm" },
            },
          ],
        });
        console.log(LOG, "BUTTON: LocalNotifications.schedule 15s after grant", at.toISOString());
      }
    } catch (e) {
      const msg = e?.message || String(e);
      setLastDirectErr(msg);
      console.error(LOG, "BUTTON: LocalNotifications.requestPermissions() EXACT throw", e?.code, e?.message, e);
    } finally {
      setBusy(false);
      void refresh();
    }
  }

  async function handleDirect15sPipeline() {
    setBusy(true);
    setLastDirectErr("");
    try {
      const out = await directLocalNotificationsRequestThenSchedule15s();
      if (!out.ok) {
        setLastDirectErr(out.nativeError || safeStringify(out));
        console.error(LOG, "direct15s failed", out);
      } else {
        console.log(LOG, "direct15s OK", out);
      }
    } catch (e) {
      const msg = e?.message || String(e);
      setLastDirectErr(msg);
      console.error(LOG, "direct15s EXACT throw", e?.code, e?.message, e);
    } finally {
      setBusy(false);
      void refresh();
    }
  }

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        background: "rgba(255,80,0,0.08)",
        border: "1px solid rgba(255,120,40,0.35)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 13 }}>Native bridge diagnostics (temporary)</div>
      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, lineHeight: 1.45, opacity: 0.92 }}>
        {lines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void handleRequestPermissionButton();
          }}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "#ff5a1f",
            color: "#fff",
            fontWeight: 800,
            fontSize: 13,
            cursor: busy ? "wait" : "pointer",
          }}
        >
          Request iOS Notification Permission (direct LocalNotifications.requestPermissions only)
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void handleDirect15sPipeline();
          }}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--card)",
            color: "var(--text)",
            fontWeight: 700,
            fontSize: 12,
            cursor: busy ? "wait" : "pointer",
          }}
        >
          Direct: requestPermissions + schedule 15s (diagnostic pipeline)
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--card-2)",
            color: "var(--text)",
            fontWeight: 600,
            fontSize: 12,
            cursor: busy ? "wait" : "pointer",
          }}
        >
          Refresh diagnostics
        </button>
      </div>

      {lastDirectPerm != null && (
        <div style={{ fontSize: 11, opacity: 0.85 }}>
          Last direct requestPermissions result: {safeStringify(lastDirectPerm)}
        </div>
      )}
      {lastDirectErr ? (
        <div style={{ fontSize: 11, color: "#ff6b6b", fontWeight: 700 }}>Error: {lastDirectErr}</div>
      ) : null}
    </div>
  );
}
