import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useNavigate } from "react-router-dom";

export default function FriendQRModal({ onClose }) {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  const [uid, setUid] = useState(null);
  const [scanning, setScanning] = useState(false);
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

  // ---------- CAMERA SCAN ----------
  const startCameraScan = async () => {
    setError("");
    if (!("BarcodeDetector" in window)) {
      setError("Camera scanning not supported on this device.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setScanning(true);

      const detector = new BarcodeDetector({ formats: ["qr_code"] });

      const scanLoop = async () => {
        if (!videoRef.current || !scanning) return;

        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0) {
            stopCamera();
            handleQR(barcodes[0].rawValue);
            return;
          }
        } catch (e) {}

        requestAnimationFrame(scanLoop);
      };

      scanLoop();
    } catch (e) {
      setError("Camera permission denied.");
    }
  };

  const stopCamera = () => {
    setScanning(false);
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
  };

  // ---------- IMAGE SCAN ----------
  const scanFromImage = async (file) => {
    setError("");
    if (!("BarcodeDetector" in window)) {
      setError("Image scanning not supported on this device.");
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
        setError("No QR code found in image.");
      }
    } catch {
      setError("Failed to scan image.");
    }
  };

  // ---------- HANDLE QR ----------
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
          {!scanning ? (
            <>
              <div style={qrWrap}>
                {qrImg ? <img src={qrImg} alt="QR" width={260} height={260} /> : <p>Loading…</p>}
              </div>

              <p style={hint}>Scan to add you as a friend</p>

              {error && <p style={{ color: "red" }}>{error}</p>}

              <div style={actions}>
                <button style={actionBtn} onClick={() => fileInputRef.current.click()}>
                  Scan from image
                </button>
                <button style={actionBtn} onClick={startCameraScan}>
                  Scan with camera
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => e.target.files && scanFromImage(e.target.files[0])}
              />
            </>
          ) : (
            <>
              <video ref={videoRef} style={video} />
              <button style={stopBtn} onClick={stopCamera}>
                Stop scanning
              </button>
            </>
          )}
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

const content = { padding: 16, textAlign: "center" };

const qrWrap = {
  background: "#fff",
  padding: 16,
  borderRadius: 12,
  display: "inline-block",
};

const hint = { marginTop: 12, opacity: 0.8 };

const actions = {
  display: "flex",
  gap: 10,
  justifyContent: "center",
  marginTop: 16,
};

const actionBtn = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--card-2)",
  color: "var(--text)",
  cursor: "pointer",
};

const video = {
  width: "100%",
  borderRadius: 12,
};

const stopBtn = {
  marginTop: 12,
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  background: "red",
  color: "#fff",
  cursor: "pointer",
};
