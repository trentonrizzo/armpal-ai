import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";

export default function FriendQRModal({ onClose }) {
  const [uid, setUid] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUid(data?.user?.id || null);
    })();
  }, []);

  const qrValue = useMemo(() => {
    if (!uid) return "";
    return `https://armpal.app/add-friend?uid=${uid}`;
  }, [uid]);

  const qrImg = useMemo(() => {
    if (!qrValue) return "";
    const encoded = encodeURIComponent(qrValue);
    // Google Charts QR — no JS deps, build-safe
    return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encoded}`;
  }, [qrValue]);

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <h2 style={{ margin: 0 }}>Your QR Code</h2>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        <div style={content}>
          <div style={qrWrap}>
            {qrImg ? (
              <img src={qrImg} alt="Your QR code" width={260} height={260} />
            ) : (
              <p>Loading…</p>
            )}
          </div>

          <p style={hint}>Scan to add you as a friend</p>

          <div style={actions}>
            <button style={actionBtn} disabled>
              Scan from image (next)
            </button>
            <button style={actionBtn} disabled>
              Scan with camera (next)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const backdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const modal = {
  width: "90%",
  maxWidth: 420,
  background: "var(--card)",
  borderRadius: 16,
  border: "1px solid var(--border)",
  boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
};

const header = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 16px",
  borderBottom: "1px solid var(--border)",
};

const closeBtn = {
  background: "transparent",
  border: "none",
  color: "var(--text)",
  fontSize: 20,
  cursor: "pointer",
};

const content = {
  padding: 16,
  textAlign: "center",
};

const qrWrap = {
  background: "#fff",
  padding: 16,
  borderRadius: 12,
  display: "inline-block",
};

const hint = {
  marginTop: 12,
  opacity: 0.8,
};

const actions = {
  display: "flex",
  gap: 10,
  justifyContent: "center",
  marginTop: 16,
  flexWrap: "wrap",
};

const actionBtn = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--card-2)",
  color: "var(--text)",
  cursor: "not-allowed",
};
