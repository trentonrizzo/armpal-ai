import React, { useState } from "react";
import { registerForPush } from "../utils/push";

export default function EnableNotifications() {
  const [status, setStatus] = useState("");

  async function handleEnable() {
    setStatus("Requesting permission…");
    try {
      await registerForPush();
      setStatus("Notifications enabled ✅");
    } catch (e) {
      console.error(e);
      setStatus("Failed to enable notifications");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 12 }}>
        Enable Notifications
      </h1>

      <p style={{ opacity: 0.7, marginBottom: 24, maxWidth: 320 }}>
        Turn on notifications so messages and updates can reach your phone.
      </p>

      <button
        onClick={handleEnable}
        style={{
          background: "#ff2f2f",
          border: "none",
          color: "#fff",
          padding: "14px 24px",
          borderRadius: 14,
          fontSize: 18,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Enable Notifications
      </button>

      {status && (
        <div style={{ marginTop: 18, fontSize: 14, opacity: 0.85 }}>
          {status}
        </div>
      )}
    </div>
  );
}
