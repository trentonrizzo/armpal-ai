import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useNavigate } from "react-router-dom";

export default function FriendQRModal({ onClose }) {
  const navigate = useNavigate();

  const cameraInputRef = useRef(null);
  const uploadInputRef = useRef(null);

  const [uid, setUid] = useState(null);
  const [error, setError] = useState("");

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
    return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(qrValue)}`;
  }, [qrValue]);

  const scanFromImage = async (file) => {
    setError("");
    if (!file) return;

    if (!("BarcodeDetector" in window)) {
      setError("QR scanning not supported on this device.");
      return;
    }

    try {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await img.decode();

      const detector = new BarcodeDetector({ formats: ["qr_code"] });
      const barcodes = await detector.detect(img);

      if (barcodes.length > 0) {
        handleQR(barcodes[0].rawValue);
      } else {
        setError("No QR code found.");
      }
    } catch {
      setError("Failed to scan QR code.");
    }
  };

  const handleQR = (value) => {
    try {
      const url = new URL(value);
      if (url.pathname === "/add-friend" && url.searchParams.get("uid")) {
        onClose();
        navigate(`/add-friend?uid=${url.searchParams.get("uid")}`);
      } else {
        setError("Invalid QR code.");
      }
    } catch {
      setError("Invalid QR code.");
    }
  };

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
              <img src={qrImg} alt="QR" width={260} height={260} />
            ) : (
              <p>Loading…</p>
            )}
          </div>

          <p style={hint}>Scan to add you as a friend</p>

          {error && <p style={{ color: "red" }}>{error}</p>}

          <div style={actions}>
            <button
              style={actionBtn}
              onClick={() => cameraInputRef.current.click()}
            >
              Scan QR Code
            </button>

            <button
              style={secondaryBtn}
              onClick={() => uploadInputRef.current.click()}
            >
              Upload QR Image
            </button>
          </div>

          {/* Camera capture */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) =>
              e.target.files && scanFromImage(e.target.files[0])
            }
          />

          {/* Photo library / files */}
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) =>
              e.target.files && scanFromImage(e.target.files[0])
            }
          />
        </div>
      </div>
    </div>
  );
}

// ---------- styles ----------
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
  flexDirection: "column",
  gap: 10,
  marginTop: 16,
};

const actionBtn = {
  padding: "12px 18px",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--card-2)",
  color: "var(--text)",
  fontSize: 16,
  cursor: "pointer",
};

const secondaryBtn = {
  padding: "12px 18px",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text)",
  fontSize: 15,
  cursor: "pointer",
};
