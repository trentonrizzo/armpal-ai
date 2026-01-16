import jsQR from "jsqr";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useNavigate } from "react-router-dom";

// =================================================================================================
// ARM PAL — FRIEND QR MODAL (iOS PWA SAFE)
// - Option B PRIMARY: internal routing via react-router
// - Option A FALLBACK: anchor-click escape hatch (iOS WebKit safe)
// - ZERO deps, ZERO App.jsx changes
// =================================================================================================

// ======================================================
// QR DECODING HELPERS (iOS PWA SAFE)
// ======================================================
async function decodeCanvasForQR(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);

  const result = jsQR(imageData.data, width, height);
  if (result && result.data) return result.data;
  return null;
}

async function decodeImageFileForQR(file) {
  const img = new Image();
  const url = URL.createObjectURL(file);

  return new Promise((resolve) => {
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const data = await decodeCanvasForQR(canvas);
      URL.revokeObjectURL(url);
      resolve(data);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export default function FriendQRModal({ onClose }) {
  const navigate = useNavigate();

  const cameraInputRef = useRef(null);
  const uploadInputRef = useRef(null);

  const [meId, setMeId] = useState(null);
  const [myHandle, setMyHandle] = useState(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // -----------------------------------------------------------------------------------------------
  // Auth + profile
  // -----------------------------------------------------------------------------------------------
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id || null;
      setMeId(uid);

      if (uid) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("handle")
          .eq("id", uid)
          .maybeSingle();
        setMyHandle(prof?.handle || null);
      }
    })();
  }, []);

  // -----------------------------------------------------------------------------------------------
  // QR payload
  // -----------------------------------------------------------------------------------------------
  const qrLink = useMemo(() => {
    if (!myHandle) return "";
    return `https://www.armpal.net/add/@${encodeURIComponent(myHandle)}`;
  }, [myHandle]);

  const qrImg = useMemo(() => {
    if (!qrLink) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(
      qrLink
    )}`;
  }, [qrLink]);

  // -----------------------------------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------------------------------
  function isStandalonePWA() {
    return (
      window.matchMedia?.("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  function hardNavigate(url) {
    // OPTION A FALLBACK — iOS SAFE
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener noreferrer";
    a.target = "_self";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function extractTarget(raw) {
    if (!raw) return { uid: null, handle: null };

    try {
      const u = new URL(raw);
      if (u.pathname === "/add-friend" || u.pathname.startsWith("/add/")) {
        const parts = u.pathname.split("/").filter(Boolean);
        if (parts[0] === "add" && parts[1]?.startsWith("@")) {
          return { uid: null, handle: parts[1].slice(1) };
        }
        return {
          uid: u.searchParams.get("uid"),
          handle: u.searchParams.get("handle"),
        };
      }

      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "u" && parts[1]) {
        return { uid: null, handle: parts[1] };
      }
    } catch {}

    let s = String(raw).trim();
    if (s.startsWith("ARMPAL:")) s = s.slice(7).trim();
    if (s.startsWith("@")) s = s.slice(1);

    const uuidish =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidish.test(s)) return { uid: s, handle: null };

    return { uid: null, handle: s || null };
  }

  // -----------------------------------------------------------------------------------------------
  // QR decode flow (Option B primary, Option A fallback)
  // -----------------------------------------------------------------------------------------------
  async function decodeImageFile(file) {
    if (!file) return;

    setErr("");
    setBusy(true);

    try {
      if (!("BarcodeDetector" in window)) {
        throw new Error(
          "QR scanning isn't supported here. Open the QR in Photos and tap the link."
        );
      }

      const img = new Image();
      img.src = URL.createObjectURL(file);
      await img.decode();

      const detector = new BarcodeDetector({ formats: ["qr_code"] });
      const codes = await detector.detect(img);

      if (!codes?.length) {
        throw new Error("No QR code found.");
      }

      const raw = codes[0].rawValue || "";
      const { uid, handle } = extractTarget(raw);

      if (uid && uid === meId) throw new Error("That's your own QR.");
      if (
        handle &&
        myHandle &&
        handle.toLowerCase() === myHandle.toLowerCase()
      ) {
        throw new Error("That's your own QR.");
      }

      onClose?.();

      // ---------------------------------
      // OPTION B — internal routing FIRST
      // ---------------------------------
      const target =
        uid
          ? `/add-friend?uid=${encodeURIComponent(uid)}`
          : handle
          ? `/add-friend?handle=${encodeURIComponent(handle)}`
          : null;

      if (!target) throw new Error("Invalid QR.");

      try {
        navigate(target);
      } catch {
        // ---------------------------------
        // OPTION A — HARD FALLBACK
        // ---------------------------------
        hardNavigate(`https://armpal.net${target}`);
      }
    } catch (e) {
      setErr(e?.message || "Failed to scan QR.");
    } finally {
      setBusy(false);
    }
  }

  // -----------------------------------------------------------------------------------------------
  // UI
  // -----------------------------------------------------------------------------------------------
  return (
    <div style={backdrop} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <div style={title}>Your QR Code</div>
          <button style={closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={body}>
          <div style={qrWrap}>
            {qrImg ? (
              <img src={qrImg} alt="Your QR" style={qrImage} />
            ) : (
              <div style={{ opacity: 0.7 }}>Loading…</div>
            )}
          </div>

          <div style={hint}>Scan to add you as a friend</div>
          {err && <div style={errText}>{err}</div>}

          <div style={btnRow}>
            <button
              style={{ ...btn, opacity: busy ? 0.6 : 1 }}
              disabled={busy}
              onClick={() => cameraInputRef.current?.click()}
            >
              Scan QR (Camera)
            </button>

            <button
              style={{ ...btn, opacity: busy ? 0.6 : 1 }}
              disabled={busy}
              onClick={() => uploadInputRef.current?.click()}
            >
              Upload QR Image
            </button>
          </div>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => decodeImageFile(e.target.files?.[0])}
          />

          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => decodeImageFile(e.target.files?.[0])}
          />

          {busy && <div style={busyText}>Scanning…</div>}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------------------------
const backdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  zIndex: 10000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 12,
};

const modal = {
  width: "100%",
  maxWidth: 460,
  background: "var(--card)",
  borderRadius: 18,
  border: "1px solid var(--border)",
  boxShadow: "0 20px 70px rgba(0,0,0,0.7)",
  overflow: "hidden",
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  padding: "14px 16px",
  borderBottom: "1px solid var(--border)",
};

const title = {
  fontSize: 22,
  fontWeight: 900,
  color: "var(--text)",
};

const closeBtn = {
  width: 40,
  height: 40,
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--card-2)",
  color: "var(--text)",
  fontSize: 18,
  fontWeight: 900,
};

const body = { padding: 16, textAlign: "center" };

const qrWrap = {
  background: "#fff",
  borderRadius: 18,
  padding: 14,
  display: "inline-block",
};

const qrImage = {
  width: 320,
  height: 320,
  maxWidth: "78vw",
  maxHeight: "78vw",
  borderRadius: 12,
};

const hint = { marginTop: 14, fontSize: 14, opacity: 0.75 };
const errText = { marginTop: 10, fontSize: 13, color: "#ff6b6b" };

const btnRow = {
  marginTop: 16,
  display: "flex",
  gap: 10,
  justifyContent: "center",
  flexWrap: "wrap",
};

const btn = {
  padding: "12px 16px",
  borderRadius: 14,
  border: "1px solid var(--border)",
  background: "var(--card-2)",
  fontWeight: 900,
  minWidth: 150,
};

const busyText = { marginTop: 10, fontSize: 12, opacity: 0.7 };